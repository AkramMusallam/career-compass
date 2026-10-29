"""
اختبارات شاملة للمرحلة الثالثة (Phase 3: B2B Expansion & Commercialization)
تغطي:
1. بوابة الشركات والتوظيف B2B (نشر الشواغر، اكتشاف وترتيب المرشحين، وتحديث مسار التوظيف).
2. بوابات الدفع والاشتراكات المتدرجة (Stripe & Tiered Subscriptions).
3. واجهة فحص ومطابقة الوظائف لإضافة المتصفح (Chrome Browser Extension).
4. التصنيف الإقليمي وتجهيز بيانات تدريب النماذج المتخصصة (Regional Taxonomy & LLM Dataset).
"""
import uuid
import pytest
from app.models.mysql_models import User
from app.core.database import SessionLocal
from app.core.mongo import extractions_collection, recruiter_jobs_collection
from app.services.regional_taxonomy import (
    normalize_regional_job_title,
    extract_regional_market_insights,
)
from app.services.finetuned_llm_service import generate_candidate_fit_evaluation
from scripts.prepare_finetuning_dataset import generate_finetuning_datasets


@pytest.fixture()
def recruiter_token(client):
    """مستخدم مسجل بدور مسؤول توظيف (Recruiter)."""
    email = f"recruiter.{uuid.uuid4().hex[:8]}@enterprise.com"
    client.post(
        "/register",
        json={
            "full_name": "HR Director",
            "email": email,
            "password": "Passw0rd123",
            "role": "recruiter",
            "company_name": "Asal Tech",
        },
    )
    resp = client.post("/login", json={"email": email, "password": "Passw0rd123"})
    token = resp.json()["access_token"]
    return token, email


@pytest.fixture()
def candidate_profile(client, registered_user_token):
    """مرشح تقني مسجل مع سيرة ذاتية ومهارات مستخرجة في MongoDB."""
    token, email = registered_user_token
    # جلب id المستخدم
    with SessionLocal() as db:
        user = db.query(User).filter(User.email == email).first()
        uid = user.id

    extraction_id = str(uuid.uuid4())
    doc = {
        "extraction_id": extraction_id,
        "user_id": uid,
        "target_role": "Full Stack Developer",
        "skills": ["Python", "FastAPI", "React", "SQL", "Git", "Docker"],
        "experience": [
            {"title": "Software Developer", "company": "Local Tech", "description": "Built APIs"}
        ],
        "projects": [
            {"title": "E-commerce Platform", "description": "React and FastAPI store"}
        ],
        "education": [{"degree": "BSc Computer Science", "institution": "Birzeit University"}],
        "ats_score": 88,
        "career_score": 85.0,
        "confirmed": True,
    }
    extractions_collection.insert_one(doc)
    return extraction_id, uid


# ============================================================
# 1. اختبارات بوابة الشركات والتوظيف B2B
# ============================================================


def test_recruiter_job_posting_crud(client, recruiter_token):
    token, _ = recruiter_token
    headers = {"Authorization": f"Bearer {token}"}

    # 1. إنشاء شاغر وظيفي جديد
    job_payload = {
        "title": "Senior Python Backend Developer",
        "company_name": "Asal Technologies",
        "field": "Engineering",
        "experience_level": "Senior",
        "location": "Ramallah / Hybrid",
        "work_type": "Full-time",
        "salary_range": "$3,000 - $4,500",
        "required_skills": ["Python", "FastAPI", "SQL", "Docker"],
        "bonus_skills": ["Redis", "Kubernetes"],
        "description": "Looking for a seasoned backend engineer to lead microservices development.",
    }
    resp = client.post("/recruiter/jobs", json=job_payload, headers=headers)
    assert resp.status_code == 201
    job_data = resp.json()
    job_id = job_data["job_id"]
    assert job_data["title"] == "Backend Developer" or "Python" in job_data["title"]
    assert job_data["company_name"] == "Asal Technologies"

    # 2. استعراض شواغر الشركة
    resp_list = client.get("/recruiter/jobs", headers=headers)
    assert resp_list.status_code == 200
    jobs = resp_list.json()
    assert any(j["job_id"] == job_id for j in jobs)

    # 3. جلب تفاصيل الشاغر المحدد
    resp_get = client.get(f"/recruiter/jobs/{job_id}", headers=headers)
    assert resp_get.status_code == 200
    assert resp_get.json()["job_id"] == job_id

    # 4. تعديل بيانات الشاغر
    resp_update = client.put(
        f"/recruiter/jobs/{job_id}",
        json={"location": "Remote / Palestine", "salary_range": "$3,500 - $5,000"},
        headers=headers,
    )
    assert resp_update.status_code == 200
    assert resp_update.json()["location"] == "Remote / Palestine"

    # 5. حذف الشاغر
    resp_del = client.delete(f"/recruiter/jobs/{job_id}", headers=headers)
    assert resp_del.status_code == 200

    # التأكد من الحذف
    resp_after = client.get(f"/recruiter/jobs/{job_id}", headers=headers)
    assert resp_after.status_code == 404


def test_candidate_discovery_ranking_and_pipeline(client, recruiter_token, candidate_profile):
    token, _ = recruiter_token
    cand_id, uid = candidate_profile
    headers = {"Authorization": f"Bearer {token}"}

    # نشر وظيفة تطابق مهارات المرشح (Python, FastAPI, SQL)
    job_payload = {
        "title": "Backend API Engineer",
        "company_name": "Exalt Technologies",
        "required_skills": ["Python", "FastAPI", "SQL"],
        "bonus_skills": ["Docker", "Kubernetes"],
        "description": "API Engineer for high-throughput messaging backend.",
    }
    resp_job = client.post("/recruiter/jobs", json=job_payload, headers=headers)
    assert resp_job.status_code == 201
    job_id = resp_job.json()["job_id"]

    # اكتشاف وترتيب المرشحين
    resp_candidates = client.get(
        f"/recruiter/jobs/{job_id}/candidates",
        params={"min_match": 20},
        headers=headers,
    )
    assert resp_candidates.status_code == 200
    cand_list = resp_candidates.json()["candidates"]
    assert len(cand_list) > 0

    target_candidate = next((c for c in cand_list if c["candidate_id"] == cand_id), None)
    assert target_candidate is not None
    assert target_candidate["match_percentage"] >= 70
    assert "Python" in target_candidate["matched_skills"]
    assert target_candidate["pipeline_status"] == "discovered"

    # تحديث مسار المرشح إلى القائمة المختصرة (Shortlist)
    resp_status = client.post(
        f"/recruiter/jobs/{job_id}/candidates/{cand_id}/status",
        json={"pipeline_status": "shortlisted", "notes": "Strong API background"},
        headers=headers,
    )
    assert resp_status.status_code == 200
    assert resp_status.json()["record"]["pipeline_status"] == "shortlisted"

    # معاينة الملف الكامل للمرشح
    resp_profile = client.get(f"/recruiter/candidates/{cand_id}/profile", headers=headers)
    assert resp_profile.status_code == 200
    prof = resp_profile.json()
    assert prof["candidate_id"] == cand_id
    assert "FastAPI" in prof["skills"]


def test_recruiter_role_switch(client, registered_user_token):
    token, _ = registered_user_token
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.post(
        "/recruiter/switch-role",
        params={"company_name": "Harri Palestine"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["role"] == "recruiter"
    assert resp.json()["company_name"] == "Harri Palestine"


# ============================================================
# 2. اختبارات بوابات الدفع والاشتراكات المتدرجة
# ============================================================


def test_subscription_plans_and_lifecycle(client, registered_user_token):
    token, _ = registered_user_token
    headers = {"Authorization": f"Bearer {token}"}

    # 1. جلب الخطط المتاحة
    resp_plans = client.get("/subscriptions/plans")
    assert resp_plans.status_code == 200
    plans = resp_plans.json()
    assert len(plans) >= 3
    plan_ids = [p["id"] for p in plans]
    assert "free" in plan_ids and "pro" in plan_ids and "enterprise" in plan_ids

    # 2. التحقق من الاشتراك الحالي الافتراضي (Free)
    resp_sub = client.get("/subscriptions/current", headers=headers)
    assert resp_sub.status_code == 200
    assert resp_sub.json()["tier"] == "free"

    # 3. ترقية الحساب إلى AI Pro في وضع Sandbox
    resp_checkout = client.post(
        "/subscriptions/checkout-session",
        json={"plan_id": "pro", "billing_cycle": "annual", "test_token": "sandbox_upgrade"},
        headers=headers,
    )
    assert resp_checkout.status_code == 200
    assert "session_id" in resp_checkout.json()

    # التحقق من أن الحساب أصبح في باقة Pro
    resp_updated_sub = client.get("/subscriptions/current", headers=headers)
    assert resp_updated_sub.status_code == 200
    assert resp_updated_sub.json()["tier"] == "pro"
    assert resp_updated_sub.json()["limits"]["voice_interviews"] is True

    # 4. إلغاء الاشتراك والعودة للباقة المجانية
    resp_cancel = client.post("/subscriptions/cancel", headers=headers)
    assert resp_cancel.status_code == 200
    assert resp_cancel.json()["tier"] == "free"

    # التأكد من عودة الحساب للباقة المجانية
    resp_sub_after = client.get("/subscriptions/current", headers=headers)
    assert resp_sub_after.json()["tier"] == "free"


def test_stripe_webhook_listener(client):
    resp = client.post(
        "/subscriptions/webhook",
        content=b'{"type": "checkout.session.completed"}',
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "received"


# ============================================================
# 3. اختبارات إضافة المتصفح (Chrome Browser Extension API)
# ============================================================


def test_extension_job_matcher_endpoint(client, candidate_profile, registered_user_token):
    token, _ = registered_user_token
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "job_title": "Full Stack Engineer (React & FastAPI)",
        "company": "Harri Hospitality AI",
        "location": "Ramallah / Remote",
        "job_description": "We are seeking a Full Stack developer skilled in React, Python, FastAPI, and SQL.",
        "extracted_skills": ["React", "Python", "FastAPI", "SQL"],
    }

    resp = client.post("/extension/match-job", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["match_score"] >= 70
    assert "React" in data["matched_skills"]
    assert len(data["recommendations"]) > 0
    assert "Harri" in data["suggested_cover_letter_snippet"]


# ============================================================
# 4. اختبارات التصنيف الإقليمي وبيانات تدريب النماذج
# ============================================================


def test_regional_taxonomy_and_insights():
    # توحيد المسميات بالعربية والإنجليزية
    assert normalize_regional_job_title("مطوّر واجهات أمامية") == "Frontend Developer"
    assert normalize_regional_job_title("مطور باك إند") == "Backend Developer"
    assert normalize_regional_job_title("مهندس بيانات") == "Data Engineer"

    # تقييم السوق الإقليمي
    insights = extract_regional_market_insights(
        skills=["Python", "FastAPI", "Docker"],
        target_role="Backend Developer",
        years_exp=3.0,
    )
    assert insights["normalized_role"] == "Backend Developer"
    assert "Ramallah" in insights["recommended_regional_hubs"]
    assert len(insights["top_regional_employers"]) > 0


def test_finetuned_llm_eval_and_dataset_generation(tmp_path):
    # تقييم الملاءمة الحتمي السريع
    eval_res = generate_candidate_fit_evaluation(
        candidate_name="Ahmad Test",
        target_role="Backend Developer",
        candidate_skills=["Python", "SQL"],
        job_title="Junior Backend Developer",
        required_skills=["Python", "SQL", "FastAPI"],
        bonus_skills=["Docker"],
        matched_skills=["Python", "SQL"],
        missing_skills=["FastAPI"],
        match_percentage=75,
    )
    assert eval_res["hiring_readiness"] in ("High", "Medium")
    assert len(eval_res["interview_focus_areas"]) > 0

    # فحص توليد بيانات التدريب
    dataset_dir = tmp_path / "finetune_data"
    generate_finetuning_datasets(output_dir=str(dataset_dir))
    train_file = dataset_dir / "domain_recruitment_train.jsonl"
    val_file = dataset_dir / "domain_recruitment_val.jsonl"
    assert train_file.exists()
    assert val_file.exists()
    assert train_file.stat().st_size > 0
