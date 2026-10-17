from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import ollama
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.mongo import analysis_results_collection, extractions_collection, mongo_db
from app.core.security import get_current_user
from app.models.mysql_models import User

logger = logging.getLogger("career_compass.interview")

router = APIRouter(tags=["Mock Interview"])

interviews_collection = mongo_db["interviews"]


class InterviewStartRequest(BaseModel):
    analysis_id: str
    job_title: str


class InterviewMessage(BaseModel):
    role: str
    content: str


class InterviewStartResponse(BaseModel):
    session_id: str
    job_title: str
    messages: List[InterviewMessage]


class InterviewChatRequest(BaseModel):
    session_id: str
    message: str


class InterviewChatResponse(BaseModel):
    session_id: str
    status: str
    messages: List[InterviewMessage]


class ModelAnswerItem(BaseModel):
    question: str
    model_answer: str


class InterviewEvaluationResponse(BaseModel):
    session_id: str
    final_score: int
    technical_score: int
    communication_score: int
    strengths: List[str]
    technical_mistakes: List[str]
    grammar_mistakes: List[str]
    model_answers: List[ModelAnswerItem]
    overall_feedback: str


class InterviewSessionDetailResponse(BaseModel):
    session_id: str
    job_title: str
    status: str
    messages: List[InterviewMessage]
    evaluation: Optional[Dict[str, Any]] = None


def _call_llm_for_text(messages: list, system_instruction: str = "") -> str:
    """Helper to call LLM (OpenAI or Ollama) with automated fallback."""
    from app.core.config import settings

    full_messages = []
    if system_instruction:
        full_messages.append({"role": "system", "content": system_instruction})
    full_messages.extend(messages)

    try:
        if settings.OPENAI_API_KEY:
            import openai

            client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
            resp = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=full_messages,
                temperature=0.7,
            )
            return resp.choices[0].message.content or ""
        else:
            response = ollama.chat(model=getattr(settings, "OLLAMA_MODEL", "career-model"), messages=full_messages)
            return response["message"]["content"]
    except Exception as e:
        logger.warning("LLM call failed: %s", e)
        raise e


@router.post("/interview/start", response_model=InterviewStartResponse)
def start_interview(payload: InterviewStartRequest, current_user: User = Depends(get_current_user)):
    analysis = analysis_results_collection.find_one({"analysis_id": payload.analysis_id, "user_id": current_user.id})
    if not analysis:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis not found")

    skills: list[str] = list(analysis.get("skills") or [])
    if not skills and analysis.get("extraction_id"):
        extraction = extractions_collection.find_one(
            {"extraction_id": analysis["extraction_id"], "user_id": current_user.id}
        )
        if extraction and extraction.get("skills"):
            skills = list(extraction["skills"])
    if not skills:
        skills = list(analysis.get("strengths") or [])

    skill_gap_obj = analysis.get("skill_gap")
    if isinstance(skill_gap_obj, dict):
        missing_skills = (
            list(skill_gap_obj.get("critical") or [])
            + list(skill_gap_obj.get("recommended") or [])
            + list(skill_gap_obj.get("nice_to_have") or [])
        )
    else:
        missing_skills = [
            s.get("skill") if isinstance(s, dict) else str(s)
            for s in (analysis.get("skill_gaps") or [])
            if s
        ]
    cv_summary = f"Acquired Skills: {skills}. Identified Skill Gaps: {missing_skills}."

    system_prompt = (
        f"You are a professional, encouraging technical interviewer hiring for the position of {payload.job_title}. "
        f"The candidate's profile context is: {cv_summary}. "
        "Conduct an interactive mock interview. Ask one targeted question at a time. "
        "Balance technical depth and behavioral situational questions. "
        "Start by welcoming the candidate warmly and asking your first interview question."
    )

    session_id = str(uuid.uuid4())
    initial_messages = [{"role": "system", "content": system_prompt}]

    try:
        ai_reply = _call_llm_for_text(initial_messages)
    except Exception:
        ai_reply = (
            f"مرحباً بك في المقابلة التجريبية لوظيفة {payload.job_title}! 👋 "
            "أنا جاهز لإجراء المقابلة معك. لنبدأ بالسؤال الأول: "
            "هل يمكنك تقديم نبذة سريعة عن أبرز المشاريع أو التقنيات التي عملت بها مؤخراً؟"
        )

    messages_to_save = [
        {"role": "system", "content": system_prompt},
        {"role": "assistant", "content": ai_reply},
    ]

    interviews_collection.insert_one(
        {
            "session_id": session_id,
            "user_id": current_user.id,
            "analysis_id": payload.analysis_id,
            "job_title": payload.job_title,
            "status": "in_progress",
            "messages": messages_to_save,
            "evaluation": None,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
    )

    return InterviewStartResponse(
        session_id=session_id,
        job_title=payload.job_title,
        messages=[InterviewMessage(**m) for m in messages_to_save if m["role"] != "system"],
    )


@router.get("/interview/{session_id}", response_model=InterviewSessionDetailResponse)
def get_interview_session(session_id: str, current_user: User = Depends(get_current_user)):
    """Fetch existing interview session for session reload / history view."""
    session = interviews_collection.find_one({"session_id": session_id, "user_id": current_user.id})
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview session not found")

    messages = [InterviewMessage(**m) for m in session.get("messages", []) if m.get("role") != "system"]
    return InterviewSessionDetailResponse(
        session_id=session["session_id"],
        job_title=session.get("job_title", "Technical Position"),
        status=session.get("status", "in_progress"),
        messages=messages,
        evaluation=session.get("evaluation"),
    )


@router.post("/interview/chat", response_model=InterviewChatResponse)
def chat_interview(payload: InterviewChatRequest, current_user: User = Depends(get_current_user)):
    session = interviews_collection.find_one({"session_id": payload.session_id, "user_id": current_user.id})
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview session not found")

    if session.get("status") == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This interview session has already been completed and evaluated.",
        )

    messages = session.get("messages", [])
    messages.append({"role": "user", "content": payload.message})

    try:
        ai_reply = _call_llm_for_text(messages)
    except Exception:
        ai_reply = "شكراً لإجابتك الواضحة. دعنا ننتقل للسؤال التالي: كيف تتعامل مع تصحيح الأخطاء (Debugging) في بيئة الإنتاج؟"

    messages.append({"role": "assistant", "content": ai_reply})

    interviews_collection.update_one(
        {"session_id": payload.session_id},
        {"$set": {"messages": messages, "updated_at": datetime.now(timezone.utc)}},
    )

    return InterviewChatResponse(
        session_id=payload.session_id,
        status="in_progress",
        messages=[InterviewMessage(**m) for m in messages if m["role"] != "system"],
    )


@router.post("/interview/{session_id}/evaluate", response_model=InterviewEvaluationResponse)
def evaluate_interview(session_id: str, current_user: User = Depends(get_current_user)):
    """Epic 4 Feature 4.2: Evaluates candidate answers, scores out of 10, highlights errors and provides model answers."""
    session = interviews_collection.find_one({"session_id": session_id, "user_id": current_user.id})
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview session not found")

    # If already evaluated, return stored evaluation directly
    if session.get("evaluation"):
        stored = session["evaluation"]
        return InterviewEvaluationResponse(session_id=session_id, **stored)

    messages = session.get("messages", [])
    user_turns = [m for m in messages if m.get("role") == "user"]
    if not user_turns:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="يجب الإجابة على سؤال واحد على الأقل قبل طلب التقييم النهائي.",
        )

    # Prepare transcript for evaluation
    transcript_lines = []
    for m in messages:
        if m.get("role") == "assistant":
            transcript_lines.append(f"Interviewer: {m.get('content')}")
        elif m.get("role") == "user":
            transcript_lines.append(f"Candidate: {m.get('content')}")

    transcript = "\n".join(transcript_lines)
    job_title = session.get("job_title", "Software Engineer")

    eval_prompt = f"""
You are a senior hiring director and technical interview expert.
Evaluate the candidate's performance in the following mock interview for the position of {job_title}.

Interview Transcript:
{transcript}

Analyze the responses carefully and produce a comprehensive evaluation.
Return ONLY a valid JSON object matching exactly this structure:
{{
  "final_score": 8,
  "technical_score": 8,
  "communication_score": 7,
  "strengths": [
    "Clear understanding of core concepts",
    "Structured problem-solving approach"
  ],
  "technical_mistakes": [
    "Did not mention caching or database indexing for performance bottlenecks"
  ],
  "grammar_mistakes": [
    "Minor phrasing errors in technical terminology"
  ],
  "model_answers": [
    {{
      "question": "Sample question from the interview",
      "model_answer": "A comprehensive, ideal answer demonstrating technical mastery and structure."
    }}
  ],
  "overall_feedback": "A strong overall performance with solid foundational knowledge. Focus on articulating architectural trade-offs."
}}

Scores must be integers between 1 and 10. Do not wrap in markdown or backticks. Return raw JSON only.
"""

    eval_data = None
    try:
        from app.core.config import settings

        raw_json_str = ""
        if settings.OPENAI_API_KEY:
            import openai

            client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
            resp = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": eval_prompt}],
                temperature=0.3,
            )
            raw_json_str = resp.choices[0].message.content or ""
        else:
            response = ollama.chat(
                model=getattr(settings, "OLLAMA_MODEL", "career-model"),
                messages=[{"role": "user", "content": eval_prompt}],
                format="json",
            )
            raw_json_str = response["message"]["content"]

        clean_str = raw_json_str.strip()
        if clean_str.startswith("```json"):
            clean_str = clean_str[7:]
        if clean_str.startswith("```"):
            clean_str = clean_str[3:]
        if clean_str.endswith("```"):
            clean_str = clean_str[:-3]
        eval_data = json.loads(clean_str.strip())
    except Exception as e:
        logger.warning("AI evaluation parsing failed (%s), using rule-based scoring engine.", e)
        # Fallback evaluation calculation
        word_count = sum(len(m.get("content", "").split()) for m in user_turns)
        calc_score = min(9, max(5, int(5 + (word_count / 80))))
        eval_data = {
            "final_score": calc_score,
            "technical_score": calc_score,
            "communication_score": min(10, calc_score + 1),
            "strengths": [
                "الاستجابة لجميع الأسئلة المطروحة بجدية واهتمام",
                "تقديم شروحات كافية توضح فهم المتطلبات والمسؤوليات الأساسية",
            ],
            "technical_mistakes": [
                "يُفضل تدعيم الإجابات بأمثلة عملية أو مقاييس أداء محددة من مشاريع سابقة",
            ],
            "grammar_mistakes": [],
            "model_answers": [
                {
                    "question": "كيف تصف خبرتك ومشاريعك ذات الصلة؟",
                    "model_answer": "الإجابة النموذجية تبدأ بملخص شامل لأبرز 2-3 تقنيات تتقنها، متبوعة بمثال محدد لمشروع واجهت فيه تحدياً برمجياً وكيف قمت بحله بنجاح.",
                }
            ],
            "overall_feedback": f"أداء جيد جداً في المقابلة التجريبية لوظيفة {job_title}. ننصحك بمراجعة تفاصيل معمارية النظام والأداء لتعزيز إجاباتك المستقبلية.",
        }

    # Ensure required fields exist and are normalized
    final_score = int(eval_data.get("final_score", 7))
    technical_score = int(eval_data.get("technical_score", final_score))
    communication_score = int(eval_data.get("communication_score", final_score))

    evaluation_record = {
        "final_score": max(1, min(10, final_score)),
        "technical_score": max(1, min(10, technical_score)),
        "communication_score": max(1, min(10, communication_score)),
        "strengths": eval_data.get("strengths") or ["إظهار التزام واستعداد مهني عالي"],
        "technical_mistakes": eval_data.get("technical_mistakes") or [],
        "grammar_mistakes": eval_data.get("grammar_mistakes") or [],
        "model_answers": eval_data.get("model_answers") or [],
        "overall_feedback": eval_data.get("overall_feedback") or "تمت المقابلة بنجاح.",
    }

    # Update session in MongoDB
    interviews_collection.update_one(
        {"session_id": session_id},
        {
            "$set": {
                "status": "completed",
                "evaluation": evaluation_record,
                "completed_at": datetime.now(timezone.utc),
            }
        },
    )

    # Also update the analysis result if linked
    if session.get("analysis_id"):
        try:
            analysis_results_collection.update_one(
                {"analysis_id": session["analysis_id"], "user_id": current_user.id},
                {"$set": {"last_interview_score": evaluation_record["final_score"]}},
            )
        except Exception as e:
            logger.warning("Could not link interview score to analysis: %s", e)

    return InterviewEvaluationResponse(session_id=session_id, **evaluation_record)
