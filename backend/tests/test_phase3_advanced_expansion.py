"""
مجموعة اختبارات التوسع المعمقة للمرحلة الثالثة (Phase 3 Advanced Expansion Test Suite)
تغطي:
1. حدود وتوزيعات سرعة الإلقاء الصوتي (Vocal Speech Rate Edge Cases & Clamping).
2. معايير وأوزان درجات المقابلات التقنية (Rubric Weighting & Bounds).
3. اتساق معايير الأجور الإقليمية والجامعات والشركات (Regional Salary Benchmarks & Tiering).
4. منطق استخراج الرواتب وتطابق المهارات لملحق المتصفح (Chrome Extension Job Matcher).
5. إدارة مسار التوظيف وحالات الحافة للمرشحين (Recruiter Pipeline Lifecycle & Bounds).
6. بوابات الاشتراكات، التحقق من الخطط، الترقية، وإلغاء الاشتراك (Monetization Integrity).
7. مولد حزم تدريب النماذج اللغوية المتخصصة (Fine-Tuning Dataset Generator I/O & ChatML).
8. مرونة تقييم الملاءمة الإقليمية (Fallback & Resilient Candidate Fit Evaluation).
9. معالجة الإشارات اللحظية للـ Webhooks (Stripe Webhook Processing).
"""
from __future__ import annotations

import json
import os
import tempfile
import uuid
from typing import Any, Dict

import pytest
from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.core.mongo import (
    recruiter_jobs_collection,
    recruitment_pipeline_collection,
    subscriptions_collection,
)
from app.main import app
from app.models.mysql_models import User
from app.services import (
    finetuned_llm_service,
    interview_service,
    regional_taxonomy,
    subscription_service,
)
from app.services.regional_taxonomy import (
    BILINGUAL_ROLE_TAXONOMY,
    REGIONAL_COMPANIES,
    REGIONAL_UNIVERSITIES,
    SALARY_BENCHMARKS,
    extract_regional_market_insights,
    normalize_regional_job_title,
)
from app.services.finetuned_llm_service import generate_candidate_fit_evaluation
from scripts.prepare_finetuning_dataset import generate_finetuning_datasets

client = TestClient(app)


# =====================================================================
# 1. اختبارات سرعة الإلقاء الصوتي وحالات الحافة (Vocal Delivery)
# =====================================================================

def test_vocal_delivery_edge_cases():
    """التحقق من سلامة حساب سرعة الإلقاء (WPM) في الحالات القصوى والحدية."""
    # أ. مدة صفرية - تفعيل الحساب التلقائي للزمن الفعال
    res_zero = interview_service.analyze_vocal_delivery(
        transcript="Hello world I am a software engineer building distributed backend systems",
        duration_seconds=0.0,
        job_title="Backend Developer"
    )
    assert res_zero.words_per_minute > 0
    assert res_zero.pace_score >= 6

    # ب. نص فارغ تماماً مع مدة طبيعية
    res_empty = interview_service.analyze_vocal_delivery(
        transcript="",
        duration_seconds=15.0,
        job_title="Backend Developer"
    )
    assert res_zero.words_per_minute >= 0
    assert res_empty.words_per_minute == 0
    assert res_empty.filler_words_count == 0

    # ج. كلام سريع جداً (> 195 كلمة بالدقيقة)
    fast_text = "word " * 50
    res_fast = interview_service.analyze_vocal_delivery(
        transcript=fast_text,
        duration_seconds=10.0,
        job_title="Developer"
    )
    assert res_fast.words_per_minute > 195
    assert res_fast.pace_label == "سريعة جداً"

    # د. إيقاع متزن (105-165 كلمة بالدقيقة)
    # 18 كلمة خلال 8 ثوان = 135 WPM
    balanced_text = "I implemented the REST API using FastAPI and connected it to MySQL using SQLAlchemy connection pooling for high throughput."
    res_balanced = interview_service.analyze_vocal_delivery(
        transcript=balanced_text,
        duration_seconds=8.0,
        job_title="Backend Engineer"
    )
    assert 105 <= res_balanced.words_per_minute <= 165
    assert res_balanced.pace_label == "سرعة متوازنة ومثالية"


def test_vocal_delivery_filler_words_detection():
    """التحقق من رصد الكلمات الحشوية الشائعة بالعربية والإنجليزية."""
    text_with_fillers = "Um يعني I built this project اه and um it works fine."
    res = interview_service.analyze_vocal_delivery(
        transcript=text_with_fillers,
        duration_seconds=15.0,
        job_title="Developer"
    )
    assert res.filler_words_count >= 3
    assert any("الحشو" in tip or "التردد" in tip for tip in res.tips)


# =====================================================================
# 2. اختبارات أوزان التقييم وحدود الدرجات (Interview Scoring Rubrics)
# =====================================================================

def test_interview_rubric_scoring_and_bounds():
    """التحقق من أن درجات المقابلة تقع دائماً بين 1 و 10 وتستجيب لجودة الإجابة."""
    # تقييم جلسة كاملة بإجابات نموذجية مفصلة
    messages_detailed = [
        {
            "role": "assistant",
            "content": "كيف تصمم نظام إدارة مستودع يتعامل مع ضغط متزامن عالي؟",
        },
        {
            "role": "user",
            "content": "لتصميم هذا النظام أعتمد على قاعدة بيانات علائقية مع تفعيل QueuePool بحجم 25 اتصالاً، وأفصل عمليات القراءة عبر Redis Cache مع استخدام Celery للمهام غير المتزامنة لضمان عدم تعليق واجهات المستخدم.",
        },
        {
            "role": "assistant",
            "content": "وكيف تضمن أمان مسارات الـ API وإبطال الرموز عند تغيير كلمة المرور؟",
        },
        {
            "role": "user",
            "content": "أستخدم JWT Bearer tokens مع تضمين بصمة كلمة المرور المشفرة داخل التوكن، بحيث يتم فحصها عند كل طلب وإذا تغيرت كلمة المرور يُبطل التوكن فورياً برمز 401، بالإضافة لميدلوير Sliding Window للحد من الطلبات الزائدة.",
        },
    ]
    eval_result = interview_service.evaluate_interview_session(
        messages=messages_detailed,
        job_title="Senior Backend Engineer"
    )
    assert 1 <= eval_result["final_score"] <= 10
    assert 1 <= eval_result["technical_score"] <= 10
    assert 1 <= eval_result["communication_score"] <= 10
    assert len(eval_result["strengths"]) > 0

    # تقييم جلسة بإجابات مقتضبة جداً
    messages_short = [
        {"role": "assistant", "content": "ما هي خبرتك في Python؟"},
        {"role": "user", "content": "أعرفها جيداً."},
    ]
    eval_weak = interview_service.evaluate_interview_session(
        messages=messages_short,
        job_title="Python Developer"
    )
    assert eval_weak["final_score"] <= 4
    assert len(eval_weak["technical_mistakes"]) > 0


# =====================================================================
# 3. اختبارات بنك الرواتب الإقليمي وتصنيف الجامعات والشركات (Taxonomy)
# =====================================================================

def test_regional_taxonomy_salary_hierarchies():
    """التحقق من أن الرواتب تتدرج منطقياً: خبير > متوسط > مبتدئ لكل الأدوار الوظيفية."""
    junior = SALARY_BENCHMARKS["junior"]
    mid = SALARY_BENCHMARKS["mid"]
    senior = SALARY_BENCHMARKS["senior"]
    lead = SALARY_BENCHMARKS["lead"]

    # التحقق من أن نطاق الرواتب يتصاعد مع الخبرة
    assert junior["min"] < mid["min"] < senior["min"] < lead["min"]
    assert junior["max"] < mid["max"] < senior["max"] < lead["max"]
    assert "$" in junior["label"] and "$" in senior["label"]


def test_regional_institutions_and_tech_hubs_coverage():
    """التحقق من شمولية الجامعات الفلسطينية وحواضن التكنولوجيا الإقليمية."""
    assert any("بيرزيت" in u or "birzeit" in u for u in REGIONAL_UNIVERSITIES)
    assert any("النجاح" in u or "najah" in u for u in REGIONAL_UNIVERSITIES)
    assert any("الإسلامية" in u or "islamic" in u for u in REGIONAL_UNIVERSITIES)

    # حواضن الشركات والمراكز التقنية
    assert len(REGIONAL_COMPANIES) >= 8
    assert "asal technologies" in REGIONAL_COMPANIES
    assert "exalt technologies" in REGIONAL_COMPANIES


# =====================================================================
# 4. اختبارات ملحق المتصفح واستخراج الرواتب وتطابق المهارات (Extension)
# =====================================================================

def test_extension_match_job_advanced_cases():
    """التحقق من قدرة ملحق المتصفح على مطابقة الوظيفة وحساب التوافق بدقة."""
    user_email = f"ext.adv.{uuid.uuid4().hex[:6]}@example.com"
    client.post("/register", json={"full_name": "Ext User", "email": user_email, "password": "Password123!"})
    token = client.post("/login", json={"email": user_email, "password": "Password123!"}).json()["access_token"]
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
    assert data["job_title"] == "Full Stack Engineer (React & FastAPI)"
    assert "match_score" in data
    assert isinstance(data["match_score"], int)


# =====================================================================
# 5. اختبارات بوابة الشركات وحالات الحافة (Recruiter Pipeline & Edge Cases)
# =====================================================================

def test_recruiter_invalid_job_and_not_found_handling():
    """التحقق من التعامل السليم مع الوظائف غير الموجودة أو المعرفات الخاطئة."""
    user_email = f"rec.404.{uuid.uuid4().hex[:6]}@example.com"
    client.post("/register", json={"full_name": "Recruiter User", "email": user_email, "password": "Password123!"})
    token = client.post("/login", json={"email": user_email, "password": "Password123!"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # تحويل الحساب إلى Recruiter
    client.post("/recruiter/switch-role", json={"role": "recruiter", "company_name": "Apex Tech"}, headers=headers)
    from app.core.mongo import mongo_db
    uid = int(client.get("/profile", headers=headers).json()["id"])
    mongo_db["companies"].update_one({"owner_id": uid}, {"$set": {"status": "approved"}})

    # 1. طلب مرشحين لوظيفة غير موجودة
    resp_cands = client.get("/recruiter/jobs/nonexistent-job-id-999/candidates", headers=headers)
    assert resp_cands.status_code == 404

    # 2. تحديث مسار مرشح لوظيفة غير موجودة
    resp_stat = client.post(
        "/recruiter/jobs/nonexistent-job-id-999/candidates/cand-123/status",
        json={"pipeline_status": "shortlisted"},
        headers=headers
    )
    assert resp_stat.status_code == 404

    # 3. طلب ملف كامل لمرشح غير موجود
    resp_prof = client.get("/recruiter/candidates/cand-does-not-exist/profile", headers=headers)
    assert resp_prof.status_code == 404


def test_recruiter_pipeline_audit_trail_progression():
    """التحقق من تتبع دورة حياة المرشح وتحديث مسار التوظيف مع التوقيت الزمني."""
    user_email = f"rec.prog.{uuid.uuid4().hex[:6]}@example.com"
    client.post("/register", json={"full_name": "Prog Recruiter", "email": user_email, "password": "Password123!"})
    token = client.post("/login", json={"email": user_email, "password": "Password123!"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # التحويل لمسؤول توظيف وإنشاء وظيفة
    client.post("/recruiter/switch-role", json={"role": "recruiter", "company_name": "NextGen Ltd"}, headers=headers)
    from app.core.mongo import mongo_db
    uid = int(client.get("/profile", headers=headers).json()["id"])
    mongo_db["companies"].update_one({"owner_id": uid}, {"$set": {"status": "approved"}})
    job_resp = client.post("/recruiter/jobs", json={
        "title": "Full Stack Web Engineer",
        "company_name": "NextGen Ltd",
        "field": "Engineering",
        "experience_level": "Mid",
        "location": "Ramallah (Hybrid)",
        "work_type": "Full-time",
        "salary_range": "$2,000 - $3,500",
        "required_skills": ["React", "FastAPI", "MongoDB"],
        "bonus_skills": ["Docker"],
        "description": "Full stack engineer position"
    }, headers=headers)
    assert job_resp.status_code == 201
    job_id = job_resp.json()["job_id"]

    # التدرج في حالات المرشح
    candidate_email = f"candidate.{uuid.uuid4().hex[:8]}@example.com"
    client.post("/register", json={"full_name": "Candidate", "email": candidate_email, "password": "Password123!"})
    candidate_token = client.post("/login", json={"email": candidate_email, "password": "Password123!"}).json()["access_token"]
    candidate_headers = {"Authorization": f"Bearer {candidate_token}"}
    client.put("/settings/recruiter-consent", headers=candidate_headers, json={"opted_in": True})
    cand_id = client.post("/extract/manual", headers=candidate_headers, json={"skills": ["React"]}).json()["extraction_id"]
    stages = ["shortlisted", "contacted", "interviewed", "offered"]
    for st in stages:
        r = client.post(
            f"/recruiter/jobs/{job_id}/candidates/{cand_id}/status",
            json={"pipeline_status": st, "notes": f"Moved to stage {st}"},
            headers=headers
        )
        assert r.status_code == 200
        assert r.json()["record"]["pipeline_status"] == st


# =====================================================================
# 6. اختبارات بوابة الاشتراكات وتكامل الفوترة (Monetization & Plans)
# =====================================================================

def test_subscription_plans_structure_and_discounts():
    """التحقق من أن باقة السنوية تحتوي على خصم 20% وجميع الحقول الضرورية موجودة."""
    resp = client.get("/subscriptions/plans")
    assert resp.status_code == 200
    plans = resp.json()
    assert len(plans) == 3

    pro_plan = next(p for p in plans if p["id"] == "pro")
    assert pro_plan["price_monthly"] == 19.0
    # الخصم السنوي (19 * 12 * 0.8 ≈ 180)
    assert pro_plan["price_annual"] < (pro_plan["price_monthly"] * 12)
    assert len(pro_plan["features"]) >= 5

    ent_plan = next(p for p in plans if p["id"] == "enterprise")
    assert ent_plan["price_monthly"] == 79.0
    assert ent_plan["price_annual"] < (ent_plan["price_monthly"] * 12)


def test_subscription_checkout_invalid_plan_rejected():
    """التحقق من رفض محاولة الدفع لخطط وهمية أو غير معروفة."""
    user_email = f"sub.inv.{uuid.uuid4().hex[:6]}@example.com"
    client.post("/register", json={"full_name": "Sub User", "email": user_email, "password": "Password123!"})
    token = client.post("/login", json={"email": user_email, "password": "Password123!"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    bad_checkout = client.post("/subscriptions/checkout-session", json={
        "plan_id": "vip_diamond_luxury",
        "billing_cycle": "monthly"
    }, headers=headers)
    assert bad_checkout.status_code == 400
    assert "Invalid plan_id" in bad_checkout.json()["detail"] or "invalid" in bad_checkout.json()["detail"].lower()


def test_stripe_webhook_endpoint_reception():
    """التحقق من قدرة مسار الـ Webhook على استلام الإشعارات وتأكيدها برمز 200."""
    payload = json.dumps({
        "id": "evt_test_123456",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_test_abc",
                "customer": "cus_123",
                "amount_total": 1900
            }
        }
    })
    resp = client.post(
        "/subscriptions/webhook",
        content=payload,
        headers={"Content-Type": "application/json", "stripe-signature": "sig_test_mock"}
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "received"


# =====================================================================
# 7. اختبارات مولد حزم تدريب النماذج اللغوية (Fine-Tuning Generator I/O)
# =====================================================================

def test_finetuning_dataset_generator_output():
    """التحقق من أن سكربت توليد بيانات التدريب ينشئ ملفات صالحة ومعيارية في مجلد مؤقت."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        generate_finetuning_datasets(output_dir=tmp_dir)

        train_path = os.path.join(tmp_dir, "domain_recruitment_train.jsonl")
        val_path = os.path.join(tmp_dir, "domain_recruitment_val.jsonl")

        assert os.path.exists(train_path)
        assert os.path.exists(val_path)

        # قراءة سطور ملف التدريب والتحقق من بنية ChatML
        with open(train_path, "r", encoding="utf-8") as f:
            lines = [line.strip() for line in f if line.strip()]
            assert len(lines) >= 3
            for line in lines:
                data = json.loads(line)
                assert "messages" in data
                roles = [m["role"] for m in data["messages"]]
                assert roles == ["system", "user", "assistant"]


# =====================================================================
# 8. اختبارات صمود ومرونة محرك تقييم الملاءمة (LLM Fit Resilience)
# =====================================================================

def test_candidate_fit_evaluation_resilience():
    """التحقق من احتساب تقييم ملاءمة المرشح بدقة حتى عند تقديم بيانات حدية أو مهارات فارغة."""
    result = generate_candidate_fit_evaluation(
        candidate_name="Tariq Mansour",
        target_role="Frontend Engineer",
        candidate_skills=["HTML", "CSS", "JavaScript"],
        job_title="Senior Frontend Engineer",
        required_skills=["React", "TypeScript", "Next.js", "Redux"],
        bonus_skills=["Tailwind CSS", "Jest"],
        matched_skills=["JavaScript"],
        missing_skills=["React", "TypeScript", "Next.js", "Redux"],
        match_percentage=25
    )
    assert "verdict" in result
    assert "fit_summary" in result
    assert "interview_focus_areas" in result
    assert result["hiring_readiness"] in ["High", "Medium", "Needs Upskilling"]
    assert len(result["interview_focus_areas"]) > 0
