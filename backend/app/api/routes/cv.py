"""
الواجهة 4 (Upload CV) والواجهة 5 (Review Extracted Data) — القسم 5.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

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

    document = {
        "extraction_id": extraction_id,
        "user_id": current_user.id,
        "file_id": payload.file_id,
        "skills": extracted.skills,
        "projects": [p.__dict__ for p in extracted.projects],
        "education": [e.__dict__ for e in extracted.education],
        "experience": [e.__dict__ for e in extracted.experience],
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

from app.schemas.schemas import ATSScoreResponse, CoverLetterRequest, CoverLetterResponse
from app.services.cv_extraction import evaluate_ats_score, generate_cover_letter

@router.get("/extract/{extraction_id}/ats-score", response_model=ATSScoreResponse)
def get_ats_score(extraction_id: str, current_user: User = Depends(get_current_user)):
    extraction = extractions_collection.find_one({"extraction_id": extraction_id, "user_id": current_user.id})
    if not extraction or not extraction.get("file_id"):
        raise HTTPException(status_code=404, detail="Extraction or file not found")
    upload = uploads_collection.find_one({"file_id": extraction["file_id"]})
    if not upload:
        raise HTTPException(status_code=404, detail="File not found")
    
    result = evaluate_ats_score(upload["path"])
    return ATSScoreResponse(**result)

@router.post("/extract/{extraction_id}/cover-letter", response_model=CoverLetterResponse)
def create_cover_letter(extraction_id: str, payload: CoverLetterRequest, current_user: User = Depends(get_current_user)):
    extraction = extractions_collection.find_one({"extraction_id": extraction_id, "user_id": current_user.id})
    if not extraction or not extraction.get("file_id"):
        raise HTTPException(status_code=404, detail="Extraction or file not found")
    upload = uploads_collection.find_one({"file_id": extraction["file_id"]})
    if not upload:
        raise HTTPException(status_code=404, detail="File not found")
    
    letter = generate_cover_letter(upload["path"], payload.job_description)
    return CoverLetterResponse(cover_letter=letter)
