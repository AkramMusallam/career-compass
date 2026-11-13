"""
الواجهة 6 (Assessment Questions) — القسم 5.
GET /assessment لجلب الأسئلة، POST /assessment لإرسال كل الإجابات دفعة واحدة.
"""
from __future__ import annotations

import math
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.mongo import assessments_collection
from app.core.security import get_current_user
from app.models.mysql_models import Question, QuestionType
from app.schemas.schemas import (
    AssessmentQuestionOut,
    AssessmentQuestionsResponse,
    AssessmentSubmitRequest,
    AssessmentSubmitResponse,
)

router = APIRouter(tags=["Assessment"])


@router.get("/assessment", response_model=AssessmentQuestionsResponse)
def get_assessment_questions(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    questions = (
        db.query(Question)
        .options(selectinload(Question.options))
        .order_by(Question.order_index)
        .all()
    )
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
def submit_assessment(
    payload: AssessmentSubmitRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    questions = db.query(Question).options(selectinload(Question.options)).all()
    questions_by_id = {str(q.id): q for q in questions}

    seen_question_ids: set[str] = set()
    normalized_answers: list[dict] = []

    for answer in payload.answers:
        qid = answer.question_id.strip()
        question = questions_by_id.get(qid)
        if not question:
            raise HTTPException(status_code=400, detail=f"Unknown question_id: {answer.question_id}")
        if qid in seen_question_ids:
            raise HTTPException(status_code=400, detail=f"Duplicate answer for question_id: {qid}")
        seen_question_ids.add(qid)

        val = answer.value
        q_type = question.type
        allowed_options = {opt.text for opt in question.options}

        if q_type == QuestionType.scale:
            if isinstance(val, bool) or not isinstance(val, (int, float)):
                raise HTTPException(status_code=422, detail=f"Scale answer for question {qid} must be an integer 1..5")
            if isinstance(val, float) and (not math.isfinite(val) or not val.is_integer()):
                raise HTTPException(status_code=422, detail=f"Scale answer for question {qid} must be an integer 1..5")
            int_val = int(val)
            if int_val < 1 or int_val > 5:
                raise HTTPException(status_code=422, detail=f"Scale answer for question {qid} must be between 1 and 5")
            normalized_val: object = int_val
        elif q_type == QuestionType.single_choice:
            if not isinstance(val, str) or val not in allowed_options:
                raise HTTPException(status_code=400, detail=f"Invalid option selected for question {qid}")
            normalized_val = val
        elif q_type == QuestionType.multiple_choice:
            if not isinstance(val, list) or any(not isinstance(item, str) or item not in allowed_options for item in val):
                raise HTTPException(status_code=400, detail=f"Invalid options selected for question {qid}")
            if question.required and not val:
                raise HTTPException(status_code=400, detail=f"Question {qid} requires at least one selection")
            normalized_val = list(dict.fromkeys(val))
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported question type for question {qid}")

        normalized_answers.append({"question_id": qid, "value": normalized_val})

    missing_required = [str(q.id) for q in questions if q.required and str(q.id) not in seen_question_ids]
    if missing_required:
        raise HTTPException(
            status_code=400,
            detail=f"Missing answers for required questions: {', '.join(missing_required)}",
        )

    assessment_id = str(uuid.uuid4())
    assessments_collection.insert_one(
        {
            "assessment_id": assessment_id,
            "user_id": current_user.id,
            "answers": normalized_answers,
            "status": "submitted",
            "created_at": datetime.now(timezone.utc),
        }
    )
    return AssessmentSubmitResponse(assessment_id=assessment_id, status="submitted")
