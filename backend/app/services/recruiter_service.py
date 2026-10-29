"""
خدمة بوابة الشركات والتوظيف B2B (Recruiter Intelligence & Candidate Discovery Service)
تُعنى بإدارة شواغر الشركات، ومطابقة وترتيب الكفاءات آلياً عبر خوارزميات الذكاء الاصطناعي.
"""
from __future__ import annotations

import datetime
import uuid
from typing import Any, Dict, List, Optional

from app.core.database import SessionLocal
from app.core.mongo import (
    analysis_results_collection,
    extractions_collection,
    recruiter_jobs_collection,
    recruitment_pipeline_collection,
)
from app.models.mysql_models import User
from app.seed.skills_data import normalize_and_dedupe_skills
from app.services.finetuned_llm_service import generate_candidate_fit_evaluation
from app.services.recommendation_engine import _is_job_skill_match
from app.services.regional_taxonomy import normalize_regional_job_title


def create_job_posting(recruiter: User, data: Dict[str, Any]) -> Dict[str, Any]:
    """نشر شاغر وظيفي جديد من قبل الشركة أو مسؤول التوظيف."""
    job_id = str(uuid.uuid4())
    norm_skills = normalize_and_dedupe_skills(data.get("required_skills", []))
    norm_bonus = normalize_and_dedupe_skills(data.get("bonus_skills", []))
    company = data.get("company_name") or getattr(recruiter, "company_name", None) or recruiter.full_name

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    doc = {
        "job_id": job_id,
        "recruiter_id": recruiter.id,
        "title": normalize_regional_job_title(data["title"]),
        "company_name": company,
        "field": data.get("field", "Engineering"),
        "experience_level": data.get("experience_level", "Junior"),
        "location": data.get("location", "Ramallah / Remote"),
        "work_type": data.get("work_type", "Full-time"),
        "salary_range": data.get("salary_range"),
        "required_skills": norm_skills,
        "bonus_skills": norm_bonus,
        "description": data["description"],
        "status": "active",
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    recruiter_jobs_collection.insert_one(doc)
    doc.pop("_id", None)
    return doc


def get_recruiter_jobs(recruiter_id: int, status_filter: Optional[str] = None) -> List[Dict[str, Any]]:
    """استرجاع قائمة الشواغر الوظيفية لمسؤول التوظيف مع إحصائيات المرشحين."""
    query: Dict[str, Any] = {"recruiter_id": recruiter_id}
    if status_filter:
        query["status"] = status_filter

    jobs = list(recruiter_jobs_collection.find(query).sort("created_at", -1))
    results = []
    for j in jobs:
        j.pop("_id", None)
        job_id = j["job_id"]
        # عد المرشحين المفرزين في المسار
        pipeline_items = list(recruitment_pipeline_collection.find({"job_id": job_id}))
        shortlisted = sum(1 for p in pipeline_items if p.get("pipeline_status") == "shortlisted")

        j["total_candidates_count"] = len(pipeline_items)
        j["shortlisted_count"] = shortlisted
        results.append(j)
    return results


def get_job_by_id(job_id: str, recruiter_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
    """جلب تفاصيل شاغر محدد."""
    query: Dict[str, Any] = {"job_id": job_id}
    if recruiter_id is not None:
        query["recruiter_id"] = recruiter_id
    doc = recruiter_jobs_collection.find_one(query)
    if doc:
        doc.pop("_id", None)
    return doc


def update_job(job_id: str, recruiter_id: int, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """تعديل بيانات شاغر وظيفي."""
    clean_data = {k: v for k, v in update_data.items() if v is not None}
    if "required_skills" in clean_data:
        clean_data["required_skills"] = normalize_and_dedupe_skills(clean_data["required_skills"])
    if "bonus_skills" in clean_data:
        clean_data["bonus_skills"] = normalize_and_dedupe_skills(clean_data["bonus_skills"])
    clean_data["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()

    res = recruiter_jobs_collection.find_one_and_update(
        {"job_id": job_id, "recruiter_id": recruiter_id},
        {"$set": clean_data},
        return_document=True,
    )
    if res:
        res.pop("_id", None)
    return res


def delete_job(job_id: str, recruiter_id: int) -> bool:
    """حذف شاغر وظيفي ومسار المتقدمين المرتبط به."""
    res = recruiter_jobs_collection.delete_one({"job_id": job_id, "recruiter_id": recruiter_id})
    if res.deleted_count > 0:
        recruitment_pipeline_collection.delete_many({"job_id": job_id})
        return True
    return False


def discover_and_rank_candidates(
    job_id: str,
    recruiter_id: int,
    min_match: int = 0,
    skill_filter: Optional[str] = None,
    limit: int = 50,
) -> Dict[str, Any]:
    """
    محرك اكتشاف وترتيب المرشحين الذكي:
    يفحص ملفات السير الذاتية المستخرجة والتحليلات المؤكدة في النظام،
    ويحسب نسبة التطابق التراكمية بناءً على المهارات المطلوبة والإضافية وخبرات المشاريع.
    """
    job = get_job_by_id(job_id, recruiter_id)
    if not job:
        return {"job_id": job_id, "job_title": "", "total_matches": 0, "candidates": []}

    req_skills = job.get("required_skills", [])
    bon_skills = job.get("bonus_skills", [])

    # جلب جميع السير الذاتية المؤكدة أو المتاحة
    extractions = list(extractions_collection.find().limit(200))
    if not extractions:
        return {"job_id": job_id, "job_title": job["title"], "total_matches": 0, "candidates": []}

    # جلب أسماء المستخدمين وإيميلاتهم من SQL دفعة واحدة
    user_ids = list({e.get("user_id") for e in extractions if e.get("user_id")})
    user_map = {}
    with SessionLocal() as db:
        users = db.query(User).filter(User.id.in_(user_ids)).all()
        for u in users:
            user_map[u.id] = {"full_name": u.full_name, "email": u.email}

    # جلب مسار التوظيف الحالي للوظيفة
    pipeline_records = {
        p["candidate_id"]: p
        for p in recruitment_pipeline_collection.find({"job_id": job_id})
    }

    candidates = []
    seen_users = set()

    for ext in extractions:
        uid = ext.get("user_id")
        # تجنب التكرار لنفس المستخدم، وأخذ أحدث استخراج
        if not uid or uid in seen_users:
            continue
        seen_users.add(uid)

        candidate_id = ext.get("extraction_id") or str(ext.get("_id"))
        cand_skills = ext.get("skills", [])
        experience_list = ext.get("experience", [])
        user_info = user_map.get(uid, {"full_name": "مرشح تقني", "email": "candidate@example.com"})

        # فلترة حسب المهارة المحددة إن وُجدت
        if skill_filter and not _is_job_skill_match(skill_filter, cand_skills):
            continue

        # حساب المهارات المتوفرة والناقصة
        matched_req = [r for r in req_skills if _is_job_skill_match(r, cand_skills)]
        missing_req = [r for r in req_skills if not _is_job_skill_match(r, cand_skills)]
        matched_bon = [b for b in bon_skills if _is_job_skill_match(b, cand_skills)]

        total_req_count = max(1, len(req_skills))
        total_bon_count = max(1, len(bon_skills))

        req_score = (len(matched_req) / total_req_count) * 80.0
        bon_score = (len(matched_bon) / total_bon_count) * 20.0
        final_percentage = int(round(req_score + bon_score))
        final_percentage = max(5, min(100, final_percentage))

        if final_percentage < min_match:
            continue

        # تقدير سنوات الخبرة
        exp_years_val = len(experience_list) * 1.5
        exp_summary = f"{len(experience_list)} أدوار وظيفية (~{int(exp_years_val)} سنوات خبرة)" if experience_list else "خريج جديد / مشاريع شخصية"

        # حالة المسار والملاحظات
        pipeline_info = pipeline_records.get(candidate_id, {})
        status_val = pipeline_info.get("pipeline_status", "discovered")
        notes_val = pipeline_info.get("notes", "")

        # تحليل الملاءمة
        fit_eval = generate_candidate_fit_evaluation(
            candidate_name=user_info["full_name"],
            target_role=job["title"],
            candidate_skills=cand_skills,
            job_title=job["title"],
            required_skills=req_skills,
            bonus_skills=bon_skills,
            matched_skills=matched_req + matched_bon,
            missing_skills=missing_req,
            match_percentage=final_percentage,
        )

        candidates.append({
            "candidate_id": candidate_id,
            "user_id": uid,
            "full_name": user_info["full_name"],
            "email": user_info["email"],
            "match_percentage": final_percentage,
            "matched_skills": matched_req + matched_bon,
            "missing_skills": missing_req,
            "experience_years_summary": exp_summary,
            "target_role": job["title"],
            "ats_score": ext.get("ats_score", 85),
            "career_score": ext.get("career_score", float(final_percentage)),
            "fit_reasoning": fit_eval.get("fit_summary", ""),
            "pipeline_status": status_val,
            "notes": notes_val,
            "updated_at": pipeline_info.get("updated_at"),
        })

    # ترتيب المرشحين تنازلياً حسب أعلى نسبة تطابق
    candidates.sort(key=lambda c: c["match_percentage"], reverse=True)
    return {
        "job_id": job_id,
        "job_title": job["title"],
        "total_matches": len(candidates),
        "candidates": candidates[:limit],
    }


def update_candidate_pipeline_status(
    job_id: str,
    candidate_id: str,
    recruiter_id: int,
    pipeline_status: str,
    notes: Optional[str] = None,
) -> Dict[str, Any]:
    """تحديث مرحلة المرشح في خط التوظيف (Shortlist, Contact, Interview, Reject)."""
    # التحقق من أن الوظيفة تتبع للمسؤول
    job = get_job_by_id(job_id, recruiter_id)
    if not job:
        raise ValueError("Job posting not found or unauthorized")

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    update_fields: Dict[str, Any] = {
        "job_id": job_id,
        "candidate_id": candidate_id,
        "recruiter_id": recruiter_id,
        "pipeline_status": pipeline_status,
        "updated_at": now_iso,
    }
    if notes is not None:
        update_fields["notes"] = notes

    recruitment_pipeline_collection.update_one(
        {"job_id": job_id, "candidate_id": candidate_id},
        {"$set": update_fields},
        upsert=True,
    )
    return update_fields


def get_candidate_profile_detail(candidate_id: str) -> Optional[Dict[str, Any]]:
    """عرض الملف التقني الكامل للمرشح (سيرة ذاتية، مهارات، مشاريع)."""
    ext = extractions_collection.find_one({"extraction_id": candidate_id})
    if not ext:
        try:
            from bson import ObjectId
            ext = extractions_collection.find_one({"_id": ObjectId(candidate_id)})
        except Exception:
            pass

    if not ext:
        return None

    uid = ext.get("user_id")
    with SessionLocal() as db:
        user = db.query(User).filter(User.id == uid).first()
        full_name = user.full_name if user else "مرشح مسجل"
        email = user.email if user else "candidate@example.com"

    return {
        "candidate_id": candidate_id,
        "user_id": uid,
        "full_name": full_name,
        "email": email,
        "target_role": ext.get("target_role", "Software Engineer"),
        "ats_score": ext.get("ats_score", 85),
        "skills": ext.get("skills", []),
        "experience": ext.get("experience", []),
        "projects": ext.get("projects", []),
        "education": ext.get("education", []),
        "career_score": ext.get("career_score", 80.0),
        "pipeline_status": "discovered",
        "notes": "",
    }
