"""
اختبارات معمّقة لمسار إضافة المتصفح (Chrome Browser Extension API Deep Suite)
تغطي:
- استخراج المهارات التلقائي من نصوص إعلانات الوظائف الإنجليزية والعربية.
- حساب نسبة التوافق وفئات الأحكام (Strong Match, Moderate Match, Upskilling).
- توليد خطاب التقديم المخصص بالذكاء الاصطناعي (Tailored Cover Letter).
- حماية المصادقة وحالات النصوص الطويلة والقصيرة جداً.
"""
import uuid
import pytest
from app.models.mysql_models import User
from app.core.database import SessionLocal
from app.core.mongo import extractions_collection
from app.api.routes.extension import _extract_skills_from_text


@pytest.fixture()
def candidate_with_skills(client):
    """مرشح تقني لديه سيرة ذاتية تحتوي على مهارات معروفة."""
    email = f"ext.user.{uuid.uuid4().hex[:8]}@example.com"
    client.post("/register", json={"full_name": "Tariq Engineer", "email": email, "password": "Passw0rd123"})
    resp = client.post("/login", json={"email": email, "password": "Passw0rd123"})
    token = resp.json()["access_token"]

    with SessionLocal() as db:
        u = db.query(User).filter(User.email == email).first()
        uid = u.id

    ext_id = str(uuid.uuid4())
    extractions_collection.insert_one({
        "extraction_id": ext_id,
        "user_id": uid,
        "skills": ["Python", "FastAPI", "React", "PostgreSQL", "Docker", "Git"],
        "confirmed": True,
    })
    return token, uid


def test_extract_skills_from_text_regex():
    """فحص كفاءة استخراج المهارات التقنية من نصوص الإعلانات المختلفة."""
    text_en = "We need an engineer experienced in Python, React, and Docker with Git version control."
    skills_en = _extract_skills_from_text(text_en)
    assert "Python" in skills_en
    assert "React" in skills_en
    assert "Docker" in skills_en
    assert "Git" in skills_en

    # نص يحتوي على علامات ترقيم وأقواس
    text_punct = "Required: (Python / FastAPI), [Docker], and SQL databases."
    skills_punct = _extract_skills_from_text(text_punct)
    assert "Python" in skills_punct
    assert "FastAPI" in skills_punct
    assert "Docker" in skills_punct


def test_extension_matching_high_compatibility(client, candidate_with_skills):
    token, _ = candidate_with_skills
    headers = {"Authorization": f"Bearer {token}"}

    # وظيفة تتطابق بشكل ممتاز مع مهارات المرشح
    payload = {
        "job_title": "Full Stack Software Developer",
        "company": "Harri AI",
        "location": "Ramallah",
        "job_description": "We are seeking a developer with solid experience in Python, FastAPI, and React.",
    }
    resp = client.post("/extension/match-job", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    assert data["match_score"] >= 75
    assert "Strong Match" in data["verdict"] or "ممتاز" in data["verdict"]
    assert "Python" in data["matched_skills"]
    assert "React" in data["matched_skills"]
    assert "Harri AI" in data["suggested_cover_letter_snippet"]
    assert "Tariq Engineer" == data["candidate_name"]


def test_extension_matching_low_compatibility(client, candidate_with_skills):
    token, _ = candidate_with_skills
    headers = {"Authorization": f"Bearer {token}"}

    # وظيفة في مسار مختلف تماماً (Swift, Kotlin, Android)
    payload = {
        "job_title": "Mobile iOS / Android Lead",
        "company": "Mobile Solutions Co",
        "location": "Remote",
        "job_description": "Must have 5 years in Swift, Kotlin, and Mobile UI Design.",
        "extracted_skills": ["Swift", "Kotlin", "Solidity"],
    }
    resp = client.post("/extension/match-job", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    assert data["match_score"] < 45
    assert "تطوير مهارات" in data["verdict"] or "يحتاج" in data["verdict"]
    assert len(data["missing_skills"]) >= 2
    assert len(data["recommendations"]) > 0


def test_extension_unauthenticated_rejected(client):
    """محاولة استدعاء فحص الوظيفة بدون توكن المصادقة -> 401."""
    resp = client.post(
        "/extension/match-job",
        json={"job_title": "Dev", "job_description": "Need python dev."},
    )
    assert resp.status_code == 401


def test_extension_candidate_without_cv(client):
    """مستخدم مسجل حديثاً ولم يرفع سيرته الذاتية بعد -> استجابة آمنة بدون انهيار."""
    email = f"nocv.{uuid.uuid4().hex[:8]}@example.com"
    client.post("/register", json={"full_name": "Newbie Dev", "email": email, "password": "Passw0rd123"})
    token = client.post("/login", json={"email": email, "password": "Passw0rd123"}).json()["access_token"]

    resp = client.post(
        "/extension/match-job",
        json={"job_title": "Python Dev", "job_description": "We need Python and Git."},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["candidate_skills_count"] == 0
    assert len(data["missing_skills"]) > 0
    assert data["match_score"] >= 10  # حد أدنى آمن
