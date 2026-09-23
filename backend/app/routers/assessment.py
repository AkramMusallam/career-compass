"""
الواجهة 6 (Assessment Questions) — القسم 5.
GET /assessment لجلب الأسئلة، POST /assessment لإرسال كل الإجابات دفعة واحدة.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.mysql_models import Question
from app.mongo import assessments_collection
from app.schemas.schemas import (
    AssessmentQuestionOut,
    AssessmentQuestionsResponse,
    AssessmentSubmitRequest,
    AssessmentSubmitResponse,
)
from app.security import get_current_user

router = APIRouter(tags=["Assessment"])


@router.get("/assessment", response_model=AssessmentQuestionsResponse)
def get_assessment_questions(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    questions = db.query(Question).order_by(Question.order_index).all()
    return AssessmentQuestionsResponse(
        questions=[
            AssessmentQuestionOut(
                id=str(q.id),
                text=q.text,
                type=q.type.value,
                options=[opt.text for opt in sorted(q.options, key=lambda o: o.order_index)],
                required=q.required,
            )
            for q in questions
        ]
    )


@router.post("/assessment", response_model=AssessmentSubmitResponse)
def submit_assessment(payload: AssessmentSubmitRequest, current_user=Depends(get_current_user)):
    assessment_id = str(uuid.uuid4())
    assessments_collection.insert_one(
        {
            "assessment_id": assessment_id,
            "user_id": current_user.id,
            "answers": [a.model_dump() for a in payload.answers],
            "status": "submitted",
            "created_at": datetime.now(timezone.utc),
        }
    )
    return AssessmentSubmitResponse(assessment_id=assessment_id, status="submitted")
