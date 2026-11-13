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
    mongo_db,
)
from app.models.mysql_models import User
from app.seed.skills_data import normalize_and_dedupe_skills
from app.services.finetuned_llm_service import generate_candidate_fit_evaluation
from app.services.recommendation_engine import _is_job_skill_match
from app.services.regional_taxonomy import normalize_regional_job_title


def create_job_posting(recruiter: User, data: Dict[str, Any], company: Dict[str, Any]) -> Dict[str, Any]:
    """نشر شاغر وظيفي جديد من قبل الشركة أو مسؤول التوظيف."""
    job_id = str(uuid.uuid4())
    norm_skills = normalize_and_dedupe_skills(data.get("required_skills", []))
    norm_bonus = normalize_and_dedupe_skills(data.get("bonus_skills", []))

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    doc = {
        "job_id": job_id,
        "recruiter_id": recruiter.id,
        "company_id": company["company_id"],
        "title": normalize_regional_job_title(data["title"]),
        "company_name": company["name"],
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


def get_recruiter_jobs(company_id: str, status_filter: Optional[str] = None) -> List[Dict[str, Any]]:
    """استرجاع قائمة الشواغر الوظيفية لمسؤول التوظيف مع إحصائيات المرشحين."""
    query: Dict[str, Any] = {"company_id": company_id}
    if status_filter:
        query["status"] = status_filter

    jobs = list(recruiter_jobs_collection.find(query).sort("created_at", -1))
    if not jobs:
        return []

    job_ids = [j["job_id"] for j in jobs if "job_id" in j]
    pipeline_by_job: Dict[str, Dict[str, int]] = {
        jid: {"total": 0, "shortlisted": 0} for jid in job_ids
    }
    if job_ids:
        for p in recruitment_pipeline_collection.find(
            {"job_id": {"$in": job_ids}},
            {"job_id": 1, "pipeline_status": 1, "_id": 0},
        ):
            jid = p.get("job_id")
            if jid in pipeline_by_job:
                pipeline_by_job[jid]["total"] += 1
                if p.get("pipeline_status") == "shortlisted":
                    pipeline_by_job[jid]["shortlisted"] += 1

    results = []
    for j in jobs:
        j.pop("_id", None)
        job_id = j["job_id"]
        counts = pipeline_by_job.get(job_id, {"total": 0, "shortlisted": 0})
        j["total_candidates_count"] = counts["total"]
        j["shortlisted_count"] = counts["shortlisted"]
        results.append(j)
    return results


def get_job_by_id(job_id: str, company_id: str) -> Optional[Dict[str, Any]]:
    """جلب تفاصيل شاغر محدد."""
    query: Dict[str, Any] = {"job_id": job_id, "company_id": company_id}
    doc = recruiter_jobs_collection.find_one(query)
    if doc:
        doc.pop("_id", None)
    return doc


def update_job(job_id: str, company_id: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """تعديل بيانات شاغر وظيفي."""
    clean_data = {k: v for k, v in update_data.items() if v is not None and k != "company_name"}
    if "required_skills" in clean_data:
        clean_data["required_skills"] = normalize_and_dedupe_skills(clean_data["required_skills"])
    if "bonus_skills" in clean_data:
        clean_data["bonus_skills"] = normalize_and_dedupe_skills(clean_data["bonus_skills"])
    clean_data["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()

    res = recruiter_jobs_collection.find_one_and_update(
        {"job_id": job_id, "company_id": company_id},
        {"$set": clean_data},
        return_document=True,
    )
    if res:
        res.pop("_id", None)
    return res


def delete_job(job_id: str, company_id: str) -> bool:
    """حذف شاغر وظيفي ومسار المتقدمين المرتبط به."""
    res = recruiter_jobs_collection.delete_one({"job_id": job_id, "company_id": company_id})
    if res.deleted_count > 0:
        recruitment_pipeline_collection.delete_many({"job_id": job_id})
        return True
    return False


def _find_consented_extraction(candidate_id: str) -> Optional[Dict[str, Any]]:
    """Lookup candidate extraction by extraction_id or ObjectId and verify active consent."""
    ext = extractions_collection.find_one({"extraction_id": candidate_id})
    if not ext:
        try:
            from bson import ObjectId

            ext = extractions_collection.find_one({"_id": ObjectId(candidate_id)})
        except Exception:
            ext = None
    if not ext or not mongo_db["recruiter_consent"].find_one({"_id": ext.get("user_id")}):
        return None
    return ext


def _compute_experience_summary(experience_list: List[Dict[str, Any]]) -> str:
    """Compute experience summary from stored duration_months rather than fixed guesses."""
    if not experience_list:
        return "خريج جديد / مشاريع شخصية"
    total_months = 0
    for exp in experience_list:
        if isinstance(exp, dict):
            raw_months = exp.get("duration_months")
            if isinstance(raw_months, (int, float)) and not isinstance(raw_months, bool) and raw_months > 0:
                total_months += int(raw_months)
    if total_months > 0:
        years_val = round(total_months / 12.0, 1)
        return f"{len(experience_list)} أدوار وظيفية ({years_val:g} سنوات خبرة)"
    return f"{len(experience_list)} أدوار وظيفية"


def discover_and_rank_candidates(
    job_id: str,
    company_id: str,
    min_match: int = 0,
    skill_filter: Optional[str] = None,
    limit: int = 50,
) -> Dict[str, Any]:
    """
    محرك اكتشاف وترتيب المرشحين الذكي:
    يفحص ملفات السير الذاتية المستخرجة والتحليلات المؤكدة في النظام،
    ويحسب نسبة التطابق التراكمية بناءً على المهارات المطلوبة والإضافية وخبرات المشاريع.
    """
    job = get_job_by_id(job_id, company_id)
    if not job:
        return {"job_id": job_id, "job_title": "", "total_matches": 0, "candidates": []}

    req_skills = job.get("required_skills", [])
    bon_skills = job.get("bonus_skills", [])

    # Fetch all consented extractions ordered newest-first before deduplicating by user_id
    extractions = list(
        extractions_collection.find(
            {"user_id": {"$in": mongo_db["recruiter_consent"].distinct("_id")}},
            {
                "extraction_id": 1,
                "user_id": 1,
                "skills": 1,
                "experience": 1,
                "target_role": 1,
                "ats_score": 1,
                "career_score": 1,
            },
        ).sort("_id", -1)
    )
    if not extractions:
        return {"job_id": job_id, "job_title": job["title"], "total_matches": 0, "candidates": []}

    # Scope pipeline records strictly to this company and job
    pipeline_records = {
        p["candidate_id"]: p
        for p in recruitment_pipeline_collection.find({"company_id": company_id, "job_id": job_id})
    }

    preliminary_candidates = []
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

        # فلترة حسب المهارة المحددة إن وُجدت
        if skill_filter and not _is_job_skill_match(skill_filter, cand_skills):
            continue

        # حساب المهارات المتوفرة والناقصة
        matched_req = [r for r in req_skills if _is_job_skill_match(r, cand_skills)]
        missing_req = [r for r in req_skills if not _is_job_skill_match(r, cand_skills)]
        matched_bon = [b for b in bon_skills if _is_job_skill_match(b, cand_skills)]

        if req_skills and bon_skills:
            req_score = (len(matched_req) / len(req_skills)) * 80.0
            bon_score = (len(matched_bon) / len(bon_skills)) * 20.0
            raw_percentage = req_score + bon_score
        elif req_skills:
            raw_percentage = (len(matched_req) / len(req_skills)) * 100.0
        elif bon_skills:
            raw_percentage = (len(matched_bon) / len(bon_skills)) * 100.0
        else:
            raw_percentage = 0.0

        final_percentage = max(0, min(100, int(round(raw_percentage))))

        if final_percentage < min_match:
            continue

        preliminary_candidates.append(
            {
                "ext": ext,
                "uid": uid,
                "candidate_id": candidate_id,
                "cand_skills": cand_skills,
                "experience_list": experience_list,
                "matched_req": matched_req,
                "missing_req": missing_req,
                "matched_bon": matched_bon,
                "final_percentage": final_percentage,
            }
        )

    total_matches = len(preliminary_candidates)
    # عكس الترتيب المبدئي للحفاظ على تسلسل إدراج المستخدمين عند تساوي النسب بعد أخذ أحدث سيرة ذاتية لكل مستخدم
    preliminary_candidates.reverse()
    # ترتيب المرشحين تنازلياً حسب أعلى نسبة تطابق وأخذ الشريحة المطلوبة فقط
    preliminary_candidates.sort(key=lambda c: c["final_percentage"], reverse=True)
    selected_candidates = preliminary_candidates[:limit]

    # Batch-fetch user profiles and latest real career_score values
    user_ids = [c["uid"] for c in selected_candidates]
    user_map: Dict[int, Dict[str, Optional[str]]] = {}
    career_score_map: Dict[int, float] = {}
    if user_ids:
        with SessionLocal() as db:
            users = db.query(User).filter(User.id.in_(user_ids)).all()
            for u in users:
                user_map[u.id] = {
                    "full_name": u.full_name,
                    "email": u.email,
                    "target_role": getattr(u, "target_role", None),
                }
        for doc in analysis_results_collection.find(
            {"user_id": {"$in": user_ids}},
            {"user_id": 1, "career_score": 1},
        ).sort([("date", -1), ("_id", -1)]):
            doc_uid = doc.get("user_id")
            if doc_uid is not None and doc_uid not in career_score_map and doc.get("career_score") is not None:
                career_score_map[doc_uid] = float(doc["career_score"])

    candidates = []
    for item in selected_candidates:
        ext = item["ext"]
        uid = item["uid"]
        candidate_id = item["candidate_id"]
        cand_skills = item["cand_skills"]
        experience_list = item["experience_list"]
        matched_req = item["matched_req"]
        missing_req = item["missing_req"]
        matched_bon = item["matched_bon"]
        final_percentage = item["final_percentage"]

        user_info = user_map.get(uid, {"full_name": "مرشح تقني", "email": "candidate@example.com", "target_role": None})
        exp_summary = _compute_experience_summary(experience_list)

        pipeline_info = pipeline_records.get(candidate_id, {})
        status_val = pipeline_info.get("pipeline_status", "discovered")
        notes_val = pipeline_info.get("notes", "")

        real_target_role = ext.get("target_role") or user_info.get("target_role")
        raw_ats = ext.get("ats_score")
        real_ats = int(round(raw_ats)) if isinstance(raw_ats, (int, float)) and not isinstance(raw_ats, bool) else None
        raw_career = ext.get("career_score")
        if isinstance(raw_career, (int, float)) and not isinstance(raw_career, bool):
            real_career: Optional[float] = float(raw_career)
        else:
            real_career = career_score_map.get(uid)

        # تحليل الملاءمة (استخدام القوالب الإقليمية الفورية لتجنب تأخير N استدعاءات LLM متزامنة)
        fit_eval = generate_candidate_fit_evaluation(
            candidate_name=user_info["full_name"] or "مرشح تقني",
            target_role=real_target_role or job["title"],
            candidate_skills=cand_skills,
            job_title=job["title"],
            required_skills=req_skills,
            bonus_skills=bon_skills,
            matched_skills=matched_req + matched_bon,
            missing_skills=missing_req,
            match_percentage=final_percentage,
            use_llm=False,
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
            "target_role": real_target_role,
            "ats_score": real_ats,
            "career_score": real_career,
            "fit_reasoning": fit_eval.get("fit_summary", ""),
            "pipeline_status": status_val,
            "notes": notes_val,
            "updated_at": pipeline_info.get("updated_at"),
        })

    return {
        "job_id": job_id,
        "job_title": job["title"],
        "total_matches": total_matches,
        "candidates": candidates,
    }


def update_candidate_pipeline_status(
    job_id: str,
    candidate_id: str,
    recruiter_id: int,
    company_id: str,
    pipeline_status: str,
    notes: Optional[str] = None,
) -> Dict[str, Any]:
    """تحديث مرحلة المرشح في خط التوظيف (Shortlist, Contact, Interview, Reject)."""
    job = get_job_by_id(job_id, company_id)
    if not job:
        raise ValueError("Job posting not found or unauthorized")

    ext = _find_consented_extraction(candidate_id)
    if not ext:
        raise ValueError("Candidate not found")

    canonical_id = ext.get("extraction_id") or candidate_id
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    update_fields: Dict[str, Any] = {
        "job_id": job_id,
        "candidate_id": canonical_id,
        "recruiter_id": recruiter_id,
        "company_id": company_id,
        "pipeline_status": pipeline_status,
        "updated_at": now_iso,
    }
    if notes is not None:
        update_fields["notes"] = notes

    recruitment_pipeline_collection.update_one(
        {"company_id": company_id, "job_id": job_id, "candidate_id": canonical_id},
        {"$set": update_fields},
        upsert=True,
    )
    return update_fields


def get_candidate_profile_detail(
    candidate_id: str,
    company_id: str,
    job_id: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """عرض الملف التقني الكامل للمرشح (سيرة ذاتية، مهارات، مشاريع)."""
    ext = _find_consented_extraction(candidate_id)
    if not ext:
        return None

    canonical_id = ext.get("extraction_id") or candidate_id
    candidate_ids = list({candidate_id, canonical_id})
    uid = ext.get("user_id")
    user_target_role: Optional[str] = None
    with SessionLocal() as db:
        user = db.query(User).filter(User.id == uid).first()
        full_name = user.full_name if user else "مرشح مسجل"
        email = user.email if user else "candidate@example.com"
        user_target_role = getattr(user, "target_role", None) if user else None

    if job_id:
        pipeline_query: Dict[str, Any] = {
            "company_id": company_id,
            "job_id": job_id,
            "candidate_id": {"$in": candidate_ids},
        }
    else:
        job_ids = recruiter_jobs_collection.distinct("job_id", {"company_id": company_id})
        pipeline_query = {
            "company_id": company_id,
            "candidate_id": {"$in": candidate_ids},
            "job_id": {"$in": job_ids},
        }
    pipeline_doc = recruitment_pipeline_collection.find_one(
        pipeline_query,
        sort=[("updated_at", -1)],
    )

    raw_ats = ext.get("ats_score")
    real_ats = int(round(raw_ats)) if isinstance(raw_ats, (int, float)) and not isinstance(raw_ats, bool) else None
    raw_career = ext.get("career_score")
    if isinstance(raw_career, (int, float)) and not isinstance(raw_career, bool):
        real_career: Optional[float] = float(raw_career)
    elif uid is not None:
        latest_analysis = analysis_results_collection.find_one(
            {"user_id": uid},
            {"career_score": 1},
            sort=[("date", -1), ("_id", -1)],
        )
        real_career = (
            float(latest_analysis["career_score"])
            if latest_analysis and latest_analysis.get("career_score") is not None
            else None
        )
    else:
        real_career = None

    return {
        "candidate_id": canonical_id,
        "user_id": uid,
        "full_name": full_name,
        "email": email,
        "target_role": ext.get("target_role") or user_target_role,
        "ats_score": real_ats,
        "skills": ext.get("skills", []),
        "experience": ext.get("experience", []),
        "projects": ext.get("projects", []),
        "education": ext.get("education", []),
        "career_score": real_career,
        "pipeline_status": pipeline_doc.get("pipeline_status", "discovered") if pipeline_doc else "discovered",
        "notes": pipeline_doc.get("notes", "") if pipeline_doc else "",
    }
