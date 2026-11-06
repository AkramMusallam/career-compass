"""
اختبارات معمّقة لخدمة المقابلات الصوتية والتقييم من 10 نقاط (Interview Service & Voice AI Deep Suite)
تغطي:
- دقة معادلات الإلقاء الصوتي (WPM, Filler Words, Clarity, Confidence, Pace Labels).
- دقة معادلات التقييم الشامل من 10 نقاط للإجابات المقتضبة مقابل الإجابات المفصّلة.
- السلوك الاحتياطي لـ Whisper عند غياب مفتاح OpenAI.
- سلامة استخراج الأسئلة وتوليد الإجابات النموذجية.
"""
import pytest
from app.services.interview_service import (
    analyze_vocal_delivery,
    evaluate_interview_session,
    transcribe_audio_with_whisper,
)


def test_analyze_vocal_delivery_balanced_pace():
    """فحص حساب السرعة المثالية (105-165 WPM) ونظافة الحديث من كلمات الحشو."""
    # 18 كلمة خلال 8 ثوان = 135 WPM (سرعة متوازنة)
    transcript = "I implemented the REST API using FastAPI and connected it to MySQL using SQLAlchemy connection pooling for high throughput."
    res = analyze_vocal_delivery(transcript, duration_seconds=8.0, job_title="Backend Developer")

    assert res.words_per_minute >= 105 and res.words_per_minute <= 165
    assert res.pace_score == 9
    assert res.pace_label == "سرعة متوازنة ومثالية"
    assert res.filler_words_count == 0
    assert res.clarity_score >= 8
    assert res.confidence_score >= 8
    assert "متميز" in res.feedback_summary


def test_analyze_vocal_delivery_with_fillers_and_slow_pace():
    """فحص كشف كلمات التردد والحشو بالعربية والإنجليزية واحتساب وتيرة بطيئة."""
    # نص يحتوي على كلمات حشو: "um", "يعني", "اه"
    transcript = "Um يعني I built this project اه and um it works fine."
    res = analyze_vocal_delivery(transcript, duration_seconds=20.0, job_title="Developer")

    assert res.filler_words_count >= 3
    assert res.words_per_minute < 85
    assert res.pace_label == "بطيئة نسبياً"
    assert any("الحشو" in tip or "التردد" in tip for tip in res.tips)


def test_analyze_vocal_delivery_fast_pace():
    """فحص كشف وتيرة الحديث السريعة جداً (>195 WPM)."""
    # 50 كلمة في 10 ثوان = 300 WPM
    words_50 = " ".join(["word"] * 50)
    res = analyze_vocal_delivery(words_50, duration_seconds=10.0, job_title="Developer")

    assert res.words_per_minute > 195
    assert res.pace_label == "سريعة جداً"
    assert any("تمهّل" in tip for tip in res.tips)


def test_evaluate_interview_short_turns_gives_low_score():
    """الإجابات المقتضبة جداً (< 10 كلمات) تحصل على علامة منخفضة (1-3 من 10)."""
    messages = [
        {"role": "assistant", "content": "ما هي خبرتك في Python؟"},
        {"role": "user", "content": "نعم أعرفها جيداً."},  # 3 كلمات فقط
    ]
    eval_res = evaluate_interview_session(messages, job_title="Python Developer")

    assert eval_res["final_score"] <= 4
    assert eval_res["technical_score"] <= 4
    assert len(eval_res["model_answers"]) >= 1
    assert any("مقتضبة" in s for s in eval_res["technical_mistakes"])


def test_evaluate_interview_detailed_multi_turn_gives_high_score():
    """الإجابات التقنية المفصلة والمتعددة تحصل على علامة مرتفعة (7-10 من 10)."""
    messages = [
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
    eval_res = evaluate_interview_session(messages, job_title="Senior Backend Engineer")

    assert eval_res["final_score"] >= 7
    assert eval_res["technical_score"] >= 7
    assert eval_res["communication_score"] >= 7
    assert len(eval_res["strengths"]) >= 2
    assert len(eval_res["model_answers"]) >= 2


def test_transcribe_audio_fallback_to_hint_without_key():
    """عند عدم توفر مفتاح OpenAI، يتراجع النظام بأمان إلى النص المساعد (transcript_hint)."""
    hint = "أنا متخصص في بناء تطبيقات الويب السريعة باستخدام بايثون ورياكت."
    result = transcribe_audio_with_whisper(
        audio_bytes=b"fake-audio-bytes",
        filename="test.webm",
        content_type="audio/webm",
        transcript_hint=hint,
    )
    assert result == hint


def test_transcribe_audio_empty_bytes_and_no_hint():
    """عند إرسال بيانات فارغة وبدون hint، يعيد نصاً فارغاً بأمان دون انهيار."""
    result = transcribe_audio_with_whisper(
        audio_bytes=b"",
        filename="test.webm",
        content_type="audio/webm",
        transcript_hint="",
    )
    assert result == ""


def test_transcribe_audio_uses_local_model_without_cloud_key(monkeypatch):
    from app.services import interview_service
    monkeypatch.setattr(interview_service.settings, "OPENAI_API_KEY", "")
    monkeypatch.setattr(interview_service, "_transcribe_locally", lambda audio: "مرحبا" if audio == b"audio" else "")
    assert interview_service.transcribe_audio_with_whisper(b"audio", "voice.m4a", "audio/mp4") == "مرحبا"
