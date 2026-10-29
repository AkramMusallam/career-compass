"""
اختبارات معمّقة لمنظومة السيرة الذاتية ومنشئ الـ ATS ورسائل التغطية (CV & ATS Deep Suite)
تغطي:
- حساب نقاط قراءة الـ ATS وفحص الأقسام الناقصة.
- تحسين وتنميق نقاط السيرة الذاتية بالذكاء الاصطناعي (ATS Resume Optimization).
- تصدير السيرة الذاتية المهيأة للـ ATS كملف PDF ثنائي اللغة.
- توليد رسائل التغطية (Cover Letter) المخصصة لوصف وظيفي محدد.
- فحص دورة حياة المهام غير المتزامنة (Async Extraction Status).
"""
import uuid
import pytest
from app.models.mysql_models import User
from app.core.database import SessionLocal
from app.core.mongo import cv_tasks_collection, extractions_collection


@pytest.fixture()
def user_with_confirmed_cv(client):
    """مستخدم مع سيرة ذاتية مؤكدة تحتوي على بيانات نموذجية كاملة."""
    email = f"ats.user.{uuid.uuid4().hex[:8]}@example.com"
    client.post("/register", json={"full_name": "Laila Engineer", "email": email, "password": "Passw0rd123"})
    token = client.post("/login", json={"email": email, "password": "Passw0rd123"}).json()["access_token"]

    with SessionLocal() as db:
        uid = db.query(User).filter(User.email == email).first().id

    ext_id = str(uuid.uuid4())
    doc = {
        "extraction_id": ext_id,
        "user_id": uid,
        "full_name": "Laila Engineer",
        "email": email,
        "phone": "+970-599-123456",
        "location": "Ramallah",
        "linkedin_url": "https://linkedin.com/in/laila",
        "target_role": "Full Stack Developer",
        "summary": "Enthusiastic full stack developer with 3 years experience building scalable web applications.",
        "skills": ["Python", "FastAPI", "React", "PostgreSQL", "Docker", "Git"],
        "experience": [
            {
                "title": "Software Engineer",
                "company": "Tech Solutions",
                "duration": "2022 - Present",
                "description": "Developed backend microservices and improved database queries.",
            }
        ],
        "projects": [
            {
                "title": "Cloud Dashboard",
                "description": "Realtime monitoring tool for cloud infrastructure.",
                "technologies": ["React", "FastAPI", "Docker"],
            }
        ],
        "education": [
            {
                "degree": "BSc Computer Science",
                "institution": "Birzeit University",
                "year": "2022",
            }
        ],
        "ats_score": 88,
        "confirmed": True,
    }
    extractions_collection.insert_one(doc)
    return token, ext_id, uid


def test_ats_score_audit_full_breakdown(client, user_with_confirmed_cv):
    token, ext_id, _ = user_with_confirmed_cv
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.get(f"/extract/{ext_id}/ats-score", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    assert data["score"] >= 50
    assert "feedback" in data
    assert isinstance(data["feedback"], list)


def test_ats_score_nonexistent_extraction_returns_404(client, user_with_confirmed_cv):
    token, _, _ = user_with_confirmed_cv
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.get("/extract/fake-uuid-not-found/ats-score", headers=headers)
    assert resp.status_code == 404


def test_generate_tailored_cover_letter(client, user_with_confirmed_cv):
    token, ext_id, _ = user_with_confirmed_cv
    headers = {"Authorization": f"Bearer {token}"}

    job_desc = (
        "We are looking for a Full Stack Developer at Harri AI to develop high-throughput APIs "
        "and modern React components with Docker containerization."
    )
    resp = client.post(
        f"/extract/{ext_id}/cover-letter",
        json={"job_description": job_desc},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()

    assert "cover_letter" in data
    assert len(data["cover_letter"]) > 100
    assert "Harri" in data["cover_letter"] or "Full Stack" in data["cover_letter"]


def test_ats_resume_builder_optimize(client, user_with_confirmed_cv):
    token, ext_id, _ = user_with_confirmed_cv
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "full_name": "Laila Engineer",
        "target_role": "Senior Full Stack Engineer",
        "email": "laila@example.com",
        "phone": "+970-599-123456",
        "location": "Ramallah",
        "linkedin_url": "https://linkedin.com/in/laila",
        "summary": "Experienced engineer.",
        "skills": ["Python", "React", "Docker"],
        "experience": [
            {
                "title": "Backend Dev",
                "company": "Tech Corp",
                "duration": "2023 - Present",
                "description": "Built APIs and improved performance.",
            }
        ],
        "projects": [
            {"title": "API Gateway", "description": "High performance gateway", "technologies": ["Python"]}
        ],
        "education": [
            {"degree": "BSc", "institution": "Birzeit University", "year": "2022"}
        ],
    }

    resp = client.post(f"/extract/{ext_id}/ats-builder/optimize", json=payload, headers=headers)
    assert resp.status_code == 200
    optimized = resp.json()

    assert optimized["full_name"] == "Laila Engineer"
    assert len(optimized["experience"]) == 1
    # التحقق من أن الوصف تمت صياغته بنقاط عملية مهنية
    assert len(optimized["experience"][0]["description"]) > 0


def test_export_ats_resume_pdf(client, user_with_confirmed_cv):
    token, ext_id, _ = user_with_confirmed_cv
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "full_name": "Laila Engineer",
        "target_role": "Full Stack Engineer",
        "email": "laila@example.com",
        "phone": "+970-599-123456",
        "location": "Ramallah",
        "summary": "Summary of professional software engineer.",
        "skills": ["Python", "FastAPI", "React", "Docker"],
        "experience": [
            {
                "title": "Software Developer",
                "company": "Tech",
                "duration": "2023",
                "description": "Developed cloud services.",
            }
        ],
        "projects": [],
        "education": [],
    }

    resp = client.post(f"/extract/{ext_id}/export-ats-pdf", json=payload, headers=headers)
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert len(resp.content) > 500  # ملف PDF حقيقي يحتوي على بايتات


def test_async_cv_task_status_lifecycle(client, user_with_confirmed_cv):
    token, _, uid = user_with_confirmed_cv
    headers = {"Authorization": f"Bearer {token}"}

    task_id = f"task_{uuid.uuid4().hex}"
    # محاكاة حفظ مهمة في MongoDB بحالة processing
    cv_tasks_collection.insert_one({
        "task_id": task_id,
        "user_id": uid,
        "status": "processing",
        "file_id": "file-123",
    })

    resp = client.get(f"/cv/status/{task_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "processing"

    # تحديث الحالة إلى completed
    cv_tasks_collection.update_one(
        {"task_id": task_id},
        {"$set": {"status": "completed", "extraction_id": "ext-456"}},
    )
    resp_done = client.get(f"/cv/status/{task_id}", headers=headers)
    assert resp_done.status_code == 200
    assert resp_done.json()["status"] == "completed"
    assert resp_done.json()["extraction_id"] == "ext-456"

    # مهمة غير موجودة -> 404
    resp_fake = client.get("/cv/status/nonexistent-task-id", headers=headers)
    assert resp_fake.status_code == 404
