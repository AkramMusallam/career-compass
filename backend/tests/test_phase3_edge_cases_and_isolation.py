"""
اختبارات معمّقة لحالات الحافة وعزل الصلاحيات في المرحلة الثالثة (Phase 3 Edge Cases & Recruiter Isolation)
تغطي:
- عزل الشواغر بين مسؤولي التوظيف (Multi-tenancy isolation).
- حالات الحافة في مطابقة الكفاءات (تطابق 0%، تطابق 100%، المرشحون بدون مهارات، المرشحون بمهارات متطابقة بالمرادفات).
- حالات الفلترة والفرز بالحد الأدنى للتطابق والمهارات المفتاحية.
- إدارة خط التوظيف (Pipeline state transitions) والتعامل مع الكيانات غير الموجودة.
"""
import uuid
import pytest
from app.models.mysql_models import User
from app.core.database import SessionLocal
from app.core.mongo import extractions_collection, recruiter_jobs_collection, recruitment_pipeline_collection


@pytest.fixture()
def two_recruiters(client):
    """إنشاء مسؤولي توظيف اثنين لعزل البيانات بينهما."""
    email_a = f"recruiter.a.{uuid.uuid4().hex[:8]}@company-a.com"
    email_b = f"recruiter.b.{uuid.uuid4().hex[:8]}@company-b.com"

    client.post("/register", json={"full_name": "Recruiter A", "email": email_a, "password": "Passw0rd123", "role": "recruiter", "company_name": "Company Alpha"})
    resp_a = client.post("/login", json={"email": email_a, "password": "Passw0rd123"})
    token_a = resp_a.json()["access_token"]

    client.post("/register", json={"full_name": "Recruiter B", "email": email_b, "password": "Passw0rd123", "role": "recruiter", "company_name": "Company Beta"})
    resp_b = client.post("/login", json={"email": email_b, "password": "Passw0rd123"})
    token_b = resp_b.json()["access_token"]

    return (token_a, email_a), (token_b, email_b)


@pytest.fixture()
def populated_candidates(client):
    """إنشاء 3 مرشحين بمهارات ومستويات مختلفة لفحص خوارزمية الفرز والترتيب."""
    cands = []
    skill_sets = [
        # المرشح 1: مطابق بنسبة كاملة
        ("Expert Python Dev", ["Python", "FastAPI", "SQL", "Docker", "Redis", "Git"], 95, 3),
        # المرشح 2: مطابق جزئياً بمرادفات (Postgres بدل SQL)
        ("Junior Dev", ["Python", "PostgreSQL", "Git"], 70, 1),
        # المرشح 3: غير مطابق إطلاقاً
        ("Flutter Mobile Dev", ["Flutter", "Dart", "Swift", "UI Design"], 60, 0),
    ]

    for name, skills, ats, exp_count in skill_sets:
        email = f"cand.{uuid.uuid4().hex[:8]}@test.com"
        client.post("/register", json={"full_name": name, "email": email, "password": "Passw0rd123"})
        with SessionLocal() as db:
            user = db.query(User).filter(User.email == email).first()
            uid = user.id

        ext_id = str(uuid.uuid4())
        doc = {
            "extraction_id": ext_id,
            "user_id": uid,
            "target_role": "Software Developer",
            "skills": skills,
            "experience": [{"title": "Role", "company": "Co"}] * exp_count,
            "projects": [{"title": "Proj", "technologies": skills[:2]}],
            "ats_score": ats,
            "career_score": float(ats),
            "confirmed": True,
        }
        extractions_collection.insert_one(doc)
        cands.append((ext_id, uid, name, skills))

    return cands


# ============================================================
# اختبارات عزل الشركات والبيانات (Multi-tenancy Isolation)
# ============================================================


def test_recruiter_data_isolation(client, two_recruiters):
    (token_a, _), (token_b, _) = two_recruiters
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # 1. الشركة A تنشر وظيفة
    resp = client.post(
        "/recruiter/jobs",
        json={
            "title": "Confidential AI Architect",
            "company_name": "Company Alpha",
            "required_skills": ["Python", "PyTorch"],
            "description": "Secret AI project details.",
        },
        headers=headers_a,
    )
    assert resp.status_code == 201
    job_id = resp.json()["job_id"]

    # 2. الشركة B تحاول جلب تفاصيل وظيفة الشركة A -> يجب أن تُرفض 404
    resp_b_get = client.get(f"/recruiter/jobs/{job_id}", headers=headers_b)
    assert resp_b_get.status_code == 404

    # 3. الشركة B تحاول تعديل وظيفة الشركة A -> 404
    resp_b_update = client.put(f"/recruiter/jobs/{job_id}", json={"title": "Hacked"}, headers=headers_b)
    assert resp_b_update.status_code == 404

    # 4. الشركة B تحاول حذف وظيفة الشركة A -> 404
    resp_b_delete = client.delete(f"/recruiter/jobs/{job_id}", headers=headers_b)
    assert resp_b_delete.status_code == 404

    # 5. الشركة B تحاول جلب مرشحي وظيفة الشركة A -> 404
    resp_b_cands = client.get(f"/recruiter/jobs/{job_id}/candidates", headers=headers_b)
    assert resp_b_cands.status_code == 404

    # 6. الشركة B تستعرض وظائفها -> لا يظهر شاغر الشركة A
    resp_b_list = client.get("/recruiter/jobs", headers=headers_b)
    assert resp_b_list.status_code == 200
    assert not any(j["job_id"] == job_id for j in resp_b_list.json())


# ============================================================
# حالات الحافة في الترتيب والمطابقة الخوارزمية
# ============================================================


def test_ranking_precision_and_synonym_matching(client, two_recruiters, populated_candidates):
    (token_a, _), _ = two_recruiters
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # نشر وظيفة تتطلب Python و SQL، مع مهارات إضافية Docker و Redis
    resp = client.post(
        "/recruiter/jobs",
        json={
            "title": "Backend Services Engineer",
            "company_name": "Company Alpha",
            "required_skills": ["Python", "SQL"],
            "bonus_skills": ["Docker", "Redis"],
            "description": "High performance backend services.",
        },
        headers=headers_a,
    )
    job_id = resp.json()["job_id"]

    # جلب جميع المرشحين
    resp_cands = client.get(f"/recruiter/jobs/{job_id}/candidates", headers=headers_a)
    assert resp_cands.status_code == 200
    candidates = resp_cands.json()["candidates"]

    # التحقق من أن المرشح الأول في الترتيب هو خبير البايثون (أعلى مطابقة)
    assert len(candidates) >= 3
    first_cand = candidates[0]
    assert first_cand["full_name"] == "Expert Python Dev"
    assert first_cand["match_percentage"] >= 90

    # التحقق من أن المرشح الثاني طابق PostgreSQL مع SQL عبر المرادفات الذكية
    second_cand = next(c for c in candidates if c["full_name"] == "Junior Dev")
    assert second_cand["match_percentage"] >= 50
    # SQL تمت مطابقتها بواسطة PostgreSQL
    assert any("SQL" in s or "Postgres" in s for s in second_cand["matched_skills"])

    # التحقق من أن مرشح الـ Flutter في أدنى القائمة
    last_cand = candidates[-1]
    assert last_cand["full_name"] == "Flutter Mobile Dev"
    assert last_cand["match_percentage"] < second_cand["match_percentage"]


def test_candidate_filters_min_match_and_skill_query(client, two_recruiters, populated_candidates):
    (token_a, _), _ = two_recruiters
    headers_a = {"Authorization": f"Bearer {token_a}"}

    resp = client.post(
        "/recruiter/jobs",
        json={
            "title": "Python Microservices Specialist",
            "required_skills": ["Python", "SQL"],
            "bonus_skills": ["Docker"],
            "description": "Microservices backend developer.",
        },
        headers=headers_a,
    )
    job_id = resp.json()["job_id"]

    # 1. فلترة بنسبة تطابق عالية جداً (85% فأعلى)
    resp_high = client.get(
        f"/recruiter/jobs/{job_id}/candidates",
        params={"min_match": 85},
        headers=headers_a,
    )
    assert resp_high.status_code == 200
    cands_high = resp_high.json()["candidates"]
    assert len(cands_high) >= 1
    assert all(c["match_percentage"] >= 85 for c in cands_high)
    assert any(c["full_name"] == "Expert Python Dev" for c in cands_high)

    # 2. فلترة بمهارة مفتاحية محددة: "Docker" -> يجب ألا يعود إلا من يمتلك Docker
    resp_docker = client.get(
        f"/recruiter/jobs/{job_id}/candidates",
        params={"skill_filter": "Docker"},
        headers=headers_a,
    )
    assert resp_docker.status_code == 200
    cands_docker = resp_docker.json()["candidates"]
    for c in cands_docker:
        assert "Docker" in c["matched_skills"]

    # 3. فلترة بمهارة غير متوفرة إطلاقاً -> قائمة فارغة
    resp_none = client.get(
        f"/recruiter/jobs/{job_id}/candidates",
        params={"skill_filter": "RustLangExpert"},
        headers=headers_a,
    )
    assert resp_none.status_code == 200
    assert len(resp_none.json()["candidates"]) == 0


# ============================================================
# حالات الحافة في خط التوظيف (Pipeline Transitions)
# ============================================================


def test_recruitment_pipeline_all_stages(client, two_recruiters, populated_candidates):
    (token_a, _), _ = two_recruiters
    headers_a = {"Authorization": f"Bearer {token_a}"}
    cand_id, _, _, _ = populated_candidates[0]

    resp_job = client.post(
        "/recruiter/jobs",
        json={"title": "Cloud Architect", "required_skills": ["Python"], "description": "Cloud infra role."},
        headers=headers_a,
    )
    job_id = resp_job.json()["job_id"]

    stages = ["shortlisted", "contacted", "interviewed", "offered", "rejected"]
    for stage in stages:
        resp = client.post(
            f"/recruiter/jobs/{job_id}/candidates/{cand_id}/status",
            json={"pipeline_status": stage, "notes": f"Moved to {stage} stage."},
            headers=headers_a,
        )
        assert resp.status_code == 200
        assert resp.json()["record"]["pipeline_status"] == stage
        assert resp.json()["record"]["notes"] == f"Moved to {stage} stage."

    # محاولة تحديث وظيفة غير موجودة -> 404
    resp_fake_job = client.post(
        f"/recruiter/jobs/nonexistent-job-id/candidates/{cand_id}/status",
        json={"pipeline_status": "shortlisted"},
        headers=headers_a,
    )
    assert resp_fake_job.status_code == 404


def test_recruiter_profile_deep_dive_edge_cases(client, two_recruiters, populated_candidates):
    (token_a, _), _ = two_recruiters
    headers_a = {"Authorization": f"Bearer {token_a}"}
    cand_id, _, name, skills = populated_candidates[0]

    # جلب ملف مرشح موجود
    resp = client.get(f"/recruiter/candidates/{cand_id}/profile", headers=headers_a)
    assert resp.status_code == 200
    data = resp.json()
    assert data["full_name"] == name
    assert set(skills).issubset(set(data["skills"]))
    assert len(data["projects"]) > 0

    # جلب ملف مرشح غير موجود -> 404
    resp_404 = client.get("/recruiter/candidates/nonexistent-candidate-id/profile", headers=headers_a)
    assert resp_404.status_code == 404
