"""
الواجهة 4 (Upload CV) والواجهة 5 (Review Extracted Data) — القسم 5.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status

from app.core.config import settings
from app.models.mysql_models import User
from app.core.mongo import extractions_collection, uploads_collection
from app.schemas.schemas import (
    ExtractConfirmRequest,
    ExtractConfirmResponse,
    ExtractRequest,
    ExtractResponse,
    ManualExtractRequest,
    UploadCVResponse,
)
from app.core.security import get_current_user
from app.services.cv_extraction import extract_cv_data

router = APIRouter(tags=["CV Analysis"])

UPLOAD_DIR = Path(settings.UPLOAD_DIR)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/upload-cv", response_model=UploadCVResponse)
async def upload_cv(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    if file.content_type not in ("application/pdf", "application/x-pdf"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF files are allowed")

    contents = await file.read()
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    if len(contents) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds the maximum allowed size of {settings.MAX_UPLOAD_MB} MB",
        )

    if not contents.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid PDF file format. File must be a valid PDF document.",
        )

    file_id = str(uuid.uuid4())
    file_path = UPLOAD_DIR / f"{file_id}.pdf"
    file_path.write_bytes(contents)

    uploads_collection.insert_one(
        {
            "file_id": file_id,
            "user_id": current_user.id,
            "filename": file.filename,
            "path": str(file_path),
            "uploaded_at": datetime.now(timezone.utc),
        }
    )

    return UploadCVResponse(file_id=file_id, filename=file.filename, status="uploaded")


@router.post("/extract", response_model=ExtractResponse)
def extract(payload: ExtractRequest, current_user: User = Depends(get_current_user)):
    upload = uploads_collection.find_one({"file_id": payload.file_id, "user_id": current_user.id})
    if upload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Uploaded file not found")

    extracted = extract_cv_data(upload["path"])
    extraction_id = str(uuid.uuid4())

    is_linkedin = getattr(extracted, "is_linkedin", False)
    document = {
        "extraction_id": extraction_id,
        "user_id": current_user.id,
        "file_id": payload.file_id,
        "skills": extracted.skills,
        "projects": [p.__dict__ for p in extracted.projects],
        "education": [e.__dict__ for e in extracted.education],
        "experience": [e.__dict__ for e in extracted.experience],
        "is_linkedin": is_linkedin,
        "status": "extracted",
        "created_at": datetime.now(timezone.utc),
    }
    extractions_collection.insert_one(document)

    return ExtractResponse(
        extraction_id=extraction_id,
        skills=extracted.skills,
        projects=[p.__dict__ for p in extracted.projects],
        education=[e.__dict__ for e in extracted.education],
        experience=[e.__dict__ for e in extracted.experience],
        is_linkedin=is_linkedin,
    )


@router.post("/extract/manual", response_model=ExtractResponse)
def extract_manual(payload: ManualExtractRequest, current_user: User = Depends(get_current_user)):
    """الواجهة 4 (بديل) — الدفعة 5.1: إدخال بيانات يدوي كامل بدون رفع ملف CV.

    يُنشئ سجل استخراج (extraction) بنفس شكل واستجابة /extract تماماً، لكن من بيانات مُرسَلة
    مباشرة من المستخدم بدل استخراجها من PDF. لا يوجد file_id مرتبط بهذا السجل (source="manual"
    فقط للتمييز في قاعدة البيانات لأغراض إحصائية/تشخيصية مستقبلية، ولا يؤثر على شكل الاستجابة
    ولا على مسار /analyze اللاحق الذي لا يفرّق أصلاً بين مصدري الاستخراج).

    الاستخدام المتوقع من الفرونت (راجع F5.1): يُستدعى فور اختيار "إدخال يدوي" في UploadCV.jsx
    (عادة بجسم طلب فارغ)، ثم يُوجَّه المستخدم مباشرة لصفحة ReviewExtractedData.jsx الموجودة
    أصلاً ليملأ بياناته هناك، تماماً كما لو كانت مستخرجة من ملف، ثم يؤكدها عبر /extract/confirm
    الحالي دون أي تعديل عليه.
    """
    extraction_id = str(uuid.uuid4())

    document = {
        "extraction_id": extraction_id,
        "user_id": current_user.id,
        "file_id": None,
        "source": "manual",  # للتمييز عن الاستخراج التلقائي من PDF (source الافتراضي غير موجود = "cv")
        "skills": payload.skills,
        "projects": [p.model_dump() for p in payload.projects],
        "education": [e.model_dump() for e in payload.education],
        "experience": [e.model_dump() for e in payload.experience],
        "status": "extracted",
        "created_at": datetime.now(timezone.utc),
    }
    extractions_collection.insert_one(document)

    return ExtractResponse(
        extraction_id=extraction_id,
        skills=payload.skills,
        projects=payload.projects,
        education=payload.education,
        experience=payload.experience,
    )


@router.post("/extract/confirm", response_model=ExtractConfirmResponse)
def confirm_extraction(payload: ExtractConfirmRequest, current_user: User = Depends(get_current_user)):
    existing = extractions_collection.find_one({"extraction_id": payload.extraction_id, "user_id": current_user.id})
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Extraction not found")

    extractions_collection.update_one(
        {"extraction_id": payload.extraction_id, "user_id": current_user.id},
        {
            "$set": {
                "skills": payload.skills,
                "projects": [p.model_dump() for p in payload.projects],
                "education": [e.model_dump() for e in payload.education],
                "experience": [e.model_dump() for e in payload.experience],
                "status": "confirmed",
                "confirmed_at": datetime.now(timezone.utc),
            }
        },
    )
    return ExtractConfirmResponse(extraction_id=payload.extraction_id, status="confirmed")

from app.core.mongo import analysis_results_collection
from app.schemas.schemas import ATSScoreResponse, CoverLetterRequest, CoverLetterResponse
from app.services.cv_extraction import evaluate_ats_score, generate_cover_letter


def _resolve_extraction_source(id_or_analysis_id: str, user_id: int) -> str | None:
    """Returns either the uploaded PDF path or a synthesized CV text from extraction/analysis."""
    extraction = extractions_collection.find_one({"extraction_id": id_or_analysis_id, "user_id": user_id})
    analysis = None
    if not extraction:
        analysis = analysis_results_collection.find_one({"analysis_id": id_or_analysis_id, "user_id": user_id})
        if analysis and analysis.get("extraction_id"):
            extraction = extractions_collection.find_one(
                {"extraction_id": analysis["extraction_id"], "user_id": user_id}
            )

    if extraction and extraction.get("file_id"):
        upload = uploads_collection.find_one({"file_id": extraction["file_id"]})
        if upload and upload.get("path") and Path(upload["path"]).is_file():
            return upload["path"]

    target = extraction or analysis
    if not target:
        return None

    parts: list[str] = []
    skills = target.get("skills") or target.get("strengths") or []
    if skills:
        parts.append("Skills\n" + ", ".join(str(s) for s in skills))
    for section_key, header in (("experience", "Experience"), ("projects", "Projects"), ("education", "Education")):
        items = target.get(section_key) or []
        if items:
            lines = [header]
            for item in items:
                if isinstance(item, dict):
                    lines.append(" - ".join(str(v) for v in item.values() if v))
                else:
                    lines.append(str(item))
            parts.append("\n".join(lines))
    return "\n\n".join(parts) if parts else "Skills\nSoftware Engineering"


@router.get("/extract/{extraction_id}/ats-score", response_model=ATSScoreResponse)
def get_ats_score(extraction_id: str, current_user: User = Depends(get_current_user)):
    source = _resolve_extraction_source(extraction_id, current_user.id)
    if not source:
        raise HTTPException(status_code=404, detail="Extraction or file not found")

    result = evaluate_ats_score(source)
    return ATSScoreResponse(**result)


@router.post("/extract/{extraction_id}/cover-letter", response_model=CoverLetterResponse)
def create_cover_letter(extraction_id: str, payload: CoverLetterRequest, current_user: User = Depends(get_current_user)):
    source = _resolve_extraction_source(extraction_id, current_user.id)
    if not source:
        raise HTTPException(status_code=404, detail="Extraction or file not found")

    letter = generate_cover_letter(source, payload.job_description)
    return CoverLetterResponse(cover_letter=letter)


# ============================================================
# Phase 2 (Section 7.1): Celery Asynchronous PDF Worker
# ============================================================
import json
from io import BytesIO
from fastapi.responses import StreamingResponse
from app.core.mongo import cv_tasks_collection
from app.schemas.schemas import (
    ATSResumeBuildRequest,
    ATSResumeOptimizeResponse,
    AsyncExtractResponse,
    CVTaskStatusResponse,
)
from app.services.cv_extraction import call_llm
from app.services.pdf_export import build_ats_resume_pdf
from app.worker.tasks import parse_cv_task


@router.post("/extract/async", response_model=AsyncExtractResponse)
def extract_async(
    payload: ExtractRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """Phase 2 (Section 7.1): Dispatches CV parsing to Celery background worker (`parse_cv_task`).

    Returns an immediate `task_id` that the client polls via `GET /cv/status/{task_id}`.
    Falls back seamlessly to background execution if Redis broker is not reachable in local dev.
    """
    upload = uploads_collection.find_one({"file_id": payload.file_id, "user_id": current_user.id})
    if upload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Uploaded file not found")

    task_id = str(uuid.uuid4())
    cv_tasks_collection.insert_one(
        {
            "task_id": task_id,
            "user_id": current_user.id,
            "file_id": payload.file_id,
            "status": "processing",
            "extraction_id": None,
            "result": None,
            "error": None,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
    )

    try:
        parse_cv_task.apply_async(args=[payload.file_id, current_user.id, task_id], task_id=task_id)
    except Exception:
        # Broker offline in local development: execute in background or eagerly in testing
        if settings.CELERY_TASK_ALWAYS_EAGER or settings.ENV == "testing":
            parse_cv_task(payload.file_id, current_user.id, task_id)
        else:
            background_tasks.add_task(parse_cv_task, payload.file_id, current_user.id, task_id)

    task_doc = cv_tasks_collection.find_one({"task_id": task_id, "user_id": current_user.id})
    current_status = task_doc.get("status", "processing") if task_doc else "processing"
    return AsyncExtractResponse(task_id=task_id, status=current_status)


@router.get("/cv/status/{task_id}", response_model=CVTaskStatusResponse)
def get_cv_task_status(task_id: str, current_user: User = Depends(get_current_user)):
    """Phase 2 (Section 7.1): Polls the status of an asynchronous CV parsing task (`parse_cv_task`)."""
    task_doc = cv_tasks_collection.find_one({"task_id": task_id, "user_id": current_user.id})
    if task_doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="CV task not found")

    task_status = task_doc.get("status", "processing")
    result_data = task_doc.get("result")
    result_model = ExtractResponse(**result_data) if isinstance(result_data, dict) and result_data.get("extraction_id") else None

    return CVTaskStatusResponse(
        task_id=task_id,
        status=task_status,
        extraction_id=task_doc.get("extraction_id"),
        result=result_model,
        error=task_doc.get("error"),
    )


# ============================================================
# Phase 2 (Section 7.1): Full ATS CV Builder & Exporter
# ============================================================


def _resolve_extraction_or_analysis_doc(id_or_analysis_id: str, user_id: int) -> tuple[dict | None, dict | None]:
    extraction = extractions_collection.find_one({"extraction_id": id_or_analysis_id, "user_id": user_id})
    analysis = None
    if not extraction:
        analysis = analysis_results_collection.find_one({"analysis_id": id_or_analysis_id, "user_id": user_id})
        if analysis and analysis.get("extraction_id"):
            extraction = extractions_collection.find_one(
                {"extraction_id": analysis["extraction_id"], "user_id": user_id}
            )
    else:
        analysis = analysis_results_collection.find_one({"extraction_id": id_or_analysis_id, "user_id": user_id})
    return extraction, analysis


@router.post("/extract/{extraction_id}/ats-builder/optimize", response_model=ATSResumeOptimizeResponse)
def optimize_ats_resume(
    extraction_id: str,
    payload: ATSResumeBuildRequest | None = None,
    current_user: User = Depends(get_current_user),
):
    """Phase 2 (Section 7.1): Refines and optimizes candidate profile data for ATS resume building."""
    extraction, analysis = _resolve_extraction_or_analysis_doc(extraction_id, current_user.id)
    if not extraction and not analysis and payload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Extraction or analysis not found")

    source_doc = extraction or analysis or {}
    full_name = (payload.full_name if payload and payload.full_name else "") or current_user.full_name or "Candidate"
    email = (payload.email if payload and payload.email else "") or current_user.email or ""
    phone = payload.phone if payload else ""
    location = payload.location if payload else ""
    linkedin_url = payload.linkedin_url if payload else ""

    target_role = (payload.target_role if payload and payload.target_role else "")
    if not target_role and analysis:
        top_jobs = analysis.get("top_jobs") or []
        if top_jobs and isinstance(top_jobs[0], dict):
            target_role = top_jobs[0].get("job_title", "")
        elif isinstance(analysis.get("job_match"), dict):
            target_role = analysis["job_match"].get("top_job", "")
    if not target_role:
        target_role = "Software Engineer"

    db_skills = list(
        (extraction or {}).get("skills")
        or (analysis or {}).get("skills")
        or source_doc.get("strengths")
        or []
    )
    if payload and payload.skills:
        skills = list(dict.fromkeys([*payload.skills, *db_skills]))
    else:
        skills = db_skills
    experience = (
        [e.model_dump() for e in payload.experience]
        if payload and payload.experience
        else list(source_doc.get("experience") or [])
    )
    projects = (
        [p.model_dump() for p in payload.projects]
        if payload and payload.projects
        else list(source_doc.get("projects") or [])
    )
    education = (
        [ed.model_dump() for ed in payload.education]
        if payload and payload.education
        else list(source_doc.get("education") or [])
    )

    summary = payload.summary.strip() if payload and payload.summary else ""
    # Only invoke LLM when user explicitly requests AI regeneration (after initial modal load)
    if not summary and payload and payload.full_name:
        prompt = f"""
Write a concise, high-impact, ATS-optimized professional summary (3 sentences max) for a {target_role} candidate.
Candidate Skills: {', '.join(skills[:10])}
Return ONLY the summary text, no quotes or markdown.
"""
        try:
            ai_summary = call_llm(
                prompt,
                "You are an expert ATS resume writer.",
                is_json=False,
                max_tokens=90,
                timeout=10.0,
            ).strip()
            if ai_summary and len(ai_summary) > 30:
                summary = ai_summary
        except Exception:
            pass

    if not summary:
        top_skills_str = ", ".join(skills[:6]) if skills else "software engineering and modern web technologies"
        summary = (
            f"Results-driven {target_role} with strong technical proficiency in {top_skills_str}. "
            f"Experienced in designing, developing, and delivering scalable software solutions aligned with industry best practices. "
            f"Proven ability to solve complex engineering problems and collaborate effectively in agile environments."
        )

    return ATSResumeOptimizeResponse(
        full_name=full_name,
        target_role=target_role,
        email=email,
        phone=phone,
        location=location,
        linkedin_url=linkedin_url,
        summary=summary,
        skills=skills,
        experience=experience,
        projects=projects,
        education=education,
    )


@router.post("/extract/{extraction_id}/export-ats-pdf")
def export_ats_resume_pdf(
    extraction_id: str,
    payload: ATSResumeBuildRequest | None = None,
    current_user: User = Depends(get_current_user),
):
    """Phase 2 (Section 7.1): Formats and exports an ATS-compliant resume PDF directly from refined profile data."""
    optimized = optimize_ats_resume(extraction_id=extraction_id, payload=payload, current_user=current_user)
    pdf_bytes = build_ats_resume_pdf(optimized.model_dump())
    filename = f"ATS-Resume-{extraction_id[:8]}.pdf"
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
