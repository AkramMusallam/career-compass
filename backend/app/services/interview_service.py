"""
خدمة محاكاة المقابلات التقنية والصوتية (Mock Interview & Voice AI Service).

تفصل منطق تحويل الصوت (Whisper)، وتحليل الإلقاء الصوتي (WPM/Clarity/Confidence)،
وبناء التقييم التحليلي والنموذجي عن طبقة الـ API Router في `app/api/routes/interview.py`.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from app.core.config import settings
from app.schemas.schemas import VoiceFeedbackModel
from app.services.llm_client import call_llm_messages, strip_json_fences

logger = logging.getLogger("career_compass.interview_service")


def call_interview_llm(
    messages: list[dict[str, Any]],
    system_instruction: str = "",
    max_tokens: int = 130,
    timeout: float = 18.0,
) -> str:
    """Helper to call LLM (OpenAI or Ollama) with concise token limits for fast CPU inference."""
    return call_llm_messages(
        messages,
        system_instruction=system_instruction,
        is_json=False,
        temperature=0.4,
        max_tokens=max_tokens,
        timeout=timeout,
    )


def transcribe_audio_with_whisper(
    audio_bytes: bytes,
    filename: str,
    content_type: str,
    transcript_hint: str = "",
) -> str:
    """Phase 2 (Section 7.1): Transcribes candidate audio via OpenAI Whisper with graceful local fallback."""
    if audio_bytes and settings.OPENAI_API_KEY:
        try:
            import openai

            client = openai.OpenAI(api_key=settings.OPENAI_API_KEY, timeout=15.0)
            transcription = client.audio.transcriptions.create(
                model="whisper-1",
                file=(filename or "interview_answer.webm", audio_bytes, content_type or "audio/webm"),
            )
            text = getattr(transcription, "text", None) or (
                transcription.get("text") if isinstance(transcription, dict) else ""
            )
            if text and str(text).strip():
                return str(text).strip()
        except Exception as exc:
            logger.warning("OpenAI Whisper transcription failed (%s), falling back to transcript_hint.", exc)

    if transcript_hint and transcript_hint.strip():
        return transcript_hint.strip()

    return ""


def analyze_vocal_delivery(transcript: str, duration_seconds: float, job_title: str) -> VoiceFeedbackModel:
    """Phase 2 (Section 7.1): Evaluates speech clarity, pace (WPM), and vocal confidence."""
    words = [w for w in transcript.split() if w.strip()]
    word_count = len(words)
    effective_duration = (
        duration_seconds if duration_seconds and duration_seconds > 1.0 else max(4.0, word_count * 0.45)
    )
    wpm = int(round((word_count / effective_duration) * 60)) if word_count > 0 else 0

    filler_tokens = {"um", "uh", "er", "ah", "like", "يعني", "امم", "اممم", "اه", "آه", "ممم"}
    filler_count = sum(1 for w in words if w.lower().strip(".,!?،؛") in filler_tokens)

    if 105 <= wpm <= 165:
        pace_score = 9
        pace_label = "سرعة متوازنة ومثالية"
    elif 85 <= wpm < 105:
        pace_score = 7
        pace_label = "هادئة وواضحة"
    elif 165 < wpm <= 195:
        pace_score = 7
        pace_label = "سريعة قليلاً"
    elif wpm < 85:
        pace_score = 6
        pace_label = "بطيئة نسبياً"
    else:
        pace_score = 6
        pace_label = "سريعة جداً"

    clarity_base = 8 if word_count >= 12 else 7
    if filler_count == 0 and word_count >= 15:
        clarity_score = 9
    else:
        clarity_score = max(5, min(10, clarity_base - min(3, filler_count)))

    confidence_score = min(
        10,
        max(
            5,
            int(round((clarity_score + pace_score) / 2))
            + (1 if word_count >= 20 and filler_count <= 1 else 0),
        ),
    )

    tips: list[str] = []
    if filler_count > 1:
        tips.append("حاول تقليل كلمات التردد والحشو واستبدالها بوقفات قصيرة واثقة.")
    if wpm > 165:
        tips.append("تمهّل قليلاً عند شرح المصطلحات التقنية لمنح المحاور وقتاً لاستيعاب التفاصيل.")
    elif wpm < 85 and word_count > 0:
        tips.append("ارفع وتيرة الحديث قليلاً لإظهار الحماس والثقة بالمعلومة.")
    if word_count < 15:
        tips.append("دعّم إجابتك الصوتية بمثال عملي موجز (منهجية STAR) لرفع درجة الإقناع.")
    if not tips:
        tips.append("نبرة واضحة وإيقاع متوازن؛ استمر في ربط المفاهيم التقنية بالنتائج العملية.")

    feedback_summary = (
        f"أداء صوتي متميز بسرعة إلقاء {wpm} كلمة/دقيقة ({pace_label})، "
        f"مع وضوح نطق {clarity_score}/10 وثقة صوتية {confidence_score}/10."
    )

    return VoiceFeedbackModel(
        transcript=transcript,
        clarity_score=clarity_score,
        pace_score=pace_score,
        confidence_score=confidence_score,
        words_per_minute=wpm,
        pace_label=pace_label,
        filler_words_count=filler_count,
        feedback_summary=feedback_summary,
        tips=tips,
    )


def evaluate_interview_session(messages: list[dict[str, Any]], job_title: str) -> dict[str, Any]:
    """Evaluates candidate interview turns using AI with a deterministic analytical fallback."""
    user_turns = [m for m in messages if m.get("role") == "user"]
    transcript_lines = []
    non_system_msgs = [m for m in messages if m.get("role") in ("assistant", "user")][-8:]
    for m in non_system_msgs:
        content_snippet = str(m.get("content") or "").strip()[:280]
        if m.get("role") == "assistant":
            transcript_lines.append(f"Interviewer: {content_snippet}")
        elif m.get("role") == "user":
            transcript_lines.append(f"Candidate: {content_snippet}")

    transcript = "\n".join(transcript_lines)

    word_count = sum(len(str(m.get("content") or "").split()) for m in user_turns)
    avg_words_per_turn = word_count / max(1, len(user_turns))
    detailed_turns = sum(1 for m in user_turns if len(str(m.get("content") or "").split()) >= 12)
    if word_count < 10:
        tech_score_calc = max(1, min(3, int(round(1 + word_count / 4.0))))
        comm_score_calc = max(1, min(3, int(round(1 + avg_words_per_turn / 3.0))))
        final_score_calc = int(round((tech_score_calc + comm_score_calc) / 2.0))
    else:
        tech_score_calc = min(
            9, max(3, int(round(3 + min(3.5, word_count / 25.0) + min(2.5, detailed_turns * 0.8))))
        )
        comm_score_calc = min(
            10,
            max(
                3,
                int(
                    round(
                        3
                        + min(4.0, avg_words_per_turn / 8.0)
                        + (1.5 if len(user_turns) >= 3 else 0)
                    )
                ),
            ),
        )
        final_score_calc = max(1, min(10, int(round((tech_score_calc + comm_score_calc) / 2.0))))

    assistant_questions = [
        str(m.get("content") or "").strip()
        for m in messages
        if m.get("role") == "assistant"
        and ("?" in str(m.get("content") or "") or "؟" in str(m.get("content") or ""))
    ]
    first_q = (
        assistant_questions[0].split("\n")[-1][:180]
        if assistant_questions
        else f"كيف توظف مهاراتك التقنية في دور {job_title}؟"
    )
    second_q = (
        assistant_questions[1].split("\n")[-1][:180]
        if len(assistant_questions) > 1
        else "كيف تتعامل مع تشخيص وحل المشاكل التقنية المعقدة في بيئة الإنتاج؟"
    )

    fallback_strengths = [
        f"التفاعل الإيجابي والإجابة على {len(user_turns)} أسئلة في مسار {job_title}",
        "توضيح خطوات التفكير المنطقي ومنهجية التعامل مع المشكلات البرمجية والعمل الجماعي",
    ]
    if detailed_turns >= 2:
        fallback_strengths.append("تقديم أمثلة وسيناريوهات عملية تدعم الإجابات المطروحة")

    fallback_mistakes = []
    if avg_words_per_turn < 15:
        fallback_mistakes.append(
            "بعض الإجابات كانت مقتضبة؛ يُنصح بالتوسع في ذكر التفاصيل المعمارية والأدوات التقنية المستخدمة"
        )
    fallback_mistakes.append(
        "يُفضل ذكر أرقام أو مؤشرات أداء ملموسة (مثل زمن الاستجابة أو تحسين الكفاءة) عند شرح الحلول التقنية"
    )

    fallback_eval = {
        "final_score": final_score_calc,
        "technical_score": tech_score_calc,
        "communication_score": comm_score_calc,
        "strengths": fallback_strengths,
        "technical_mistakes": fallback_mistakes,
        "grammar_mistakes": [],
        "model_answers": [
            {
                "question": first_q,
                "model_answer": "الإجابة المثالية تبدأ بتحديد المعمارية والتقنيات المستخدمة بوضوح، ثم شرح التحدي التقني وكيف تم قياس أثر الحل على استقرار النظام وأدائه.",
            },
            {
                "question": second_q,
                "model_answer": "يُنصح باتباع منهجية منظمة: عزل المشكلة وتحليل السجلات (Logs & Metrics)، وضع فرضيات السبب الجذري، تطبيق الإصلاح مع اختبارات آلية، وتوثيق الإجراء الوقائي.",
            },
        ],
        "overall_feedback": (
            f"أداء جيد وواعد في المقابلة التجريبية لوظيفة {job_title} بنتيجة {final_score_calc}/10. "
            "أظهرت قدرة جيدة على التواصل وتقسيم المشكلات، ولرفع تقييمك في المقابلات الفعلية احرص على ربط كل إجابة بمصطلحات تقنية دقيقة وأمثلة عملية باستخدام منهجية STAR."
        ),
    }

    eval_prompt = (
        f"Evaluate this mock interview for {job_title} in Arabic JSON.\n"
        f"<interview_transcript>\n{transcript}\n</interview_transcript>\n"
        "Return JSON keys: final_score (1-10), technical_score (1-10), communication_score (1-10), "
        "strengths (list of strings in Arabic), technical_mistakes (list of strings in Arabic), "
        "grammar_mistakes (list), model_answers (list of {question, model_answer} in Arabic), overall_feedback (Arabic string)."
    )

    eval_data = None
    try:
        raw_json_str = call_llm_messages(
            [{"role": "user", "content": eval_prompt}],
            is_json=True,
            temperature=0.3,
            max_tokens=550,
            timeout=9.0,
        )
        parsed = json.loads(strip_json_fences(raw_json_str))
        if isinstance(parsed, dict) and parsed.get("final_score"):
            eval_data = parsed
        else:
            raise ValueError("Incomplete evaluation JSON")
    except Exception as exc:
        logger.warning("AI evaluation parsing failed or timed out (%s), using fast analytical scoring engine.", exc)
        eval_data = fallback_eval

    final_score = int(eval_data.get("final_score") or fallback_eval["final_score"])
    technical_score = int(eval_data.get("technical_score") or final_score)
    communication_score = int(eval_data.get("communication_score") or final_score)

    return {
        "final_score": max(1, min(10, final_score)),
        "technical_score": max(1, min(10, technical_score)),
        "communication_score": max(1, min(10, communication_score)),
        "strengths": eval_data.get("strengths") or fallback_eval["strengths"],
        "technical_mistakes": eval_data.get("technical_mistakes") or fallback_eval["technical_mistakes"],
        "grammar_mistakes": (
            eval_data.get("grammar_mistakes") if isinstance(eval_data.get("grammar_mistakes"), list) else []
        ),
        "model_answers": eval_data.get("model_answers") or fallback_eval["model_answers"],
        "overall_feedback": eval_data.get("overall_feedback") or fallback_eval["overall_feedback"],
    }
