"""
Batch 5.5 — اختبارات خدمة البريد الإلكتروني للتنبيهات الأسبوعية.

لا تحتاج أي خادم SMTP أو Redis حقيقي: smtplib.SMTP يُستبدَل (monkeypatch) بمزيّف (fake) يسجّل
كل استدعاء لاحقاً للتحقق منه، وdatabase/mongo تستخدمان نفس SQLite/mongomock المستخدمين في
باقي الاختبارات (عبر conftest.py).
"""
from app.database import SessionLocal
from app.models.mysql_models import User
from app.mongo import analysis_results_collection
from app.security import hash_password
from app.services import email_notifications as email_module


class FakeSMTP:
    """بديل مزيّف لـ smtplib.SMTP يسجّل كل استدعاء بدل الاتصال بخادم حقيقي."""

    sent_messages = []  # مشتركة بين كل الاستدعاءات داخل نفس الاختبار (تُصفَّر في كل fixture)
    login_calls = []
    should_raise = False

    def __init__(self, host, port, timeout=None):
        self.host = host
        self.port = port

    def __enter__(self):
        return self

    def __exit__(self, *exc_info):
        return False

    def starttls(self):
        pass

    def login(self, username, password):
        FakeSMTP.login_calls.append((username, password))

    def sendmail(self, from_addr, to_addrs, message_string):
        if FakeSMTP.should_raise:
            raise ConnectionRefusedError("simulated SMTP failure")
        FakeSMTP.sent_messages.append((from_addr, to_addrs, message_string))


def _reset_fake_smtp():
    FakeSMTP.sent_messages = []
    FakeSMTP.login_calls = []
    FakeSMTP.should_raise = False


def _create_user_with_analysis(db, email: str, completed_skills=None, roadmap_skills=None) -> User:
    user = User(full_name="Test User", email=email, hashed_password=hash_password("Passw0rd123"))
    db.add(user)
    db.commit()
    db.refresh(user)

    roadmap_skills = roadmap_skills if roadmap_skills is not None else ["Python", "SQL", "Docker"]
    analysis_results_collection.insert_one(
        {
            "analysis_id": f"analysis-{user.id}",
            "user_id": user.id,
            "date": __import__("datetime").datetime.now(__import__("datetime").timezone.utc),
            "career_score": 72.5,
            "career_dna": {},
            "top_jobs": [{"job_title": "Backend Developer", "match_percentage": 80, "matched_skills": [], "missing_skills": [], "explanation": ""}],
            "strengths": [],
            "weaknesses": [],
            "skill_gap": {"critical": [], "recommended": [], "nice_to_have": []},
            "roadmap": [{"month": 1, "goals": [], "skills_to_learn": roadmap_skills}],
            "suggested_courses": [],
            "completed_skills": completed_skills or [],
            "share_token": None,
        }
    )
    return user


def test_build_weekly_summary_returns_none_without_any_analysis():
    db = SessionLocal()
    try:
        import uuid

        user = User(full_name="No Analysis", email=f"none.{uuid.uuid4().hex[:8]}@example.com", hashed_password=hash_password("x"))
        db.add(user)
        db.commit()
        db.refresh(user)

        summary = email_module.build_weekly_summary_for_user(user)
        assert summary is None
    finally:
        db.close()


def test_build_weekly_summary_computes_roadmap_progress_correctly():
    db = SessionLocal()
    try:
        import uuid

        user = _create_user_with_analysis(
            db,
            email=f"progress.{uuid.uuid4().hex[:8]}@example.com",
            completed_skills=["Python"],
            roadmap_skills=["Python", "SQL", "Docker", "Git"],
        )
        summary = email_module.build_weekly_summary_for_user(user)
        assert summary is not None
        assert summary.total_roadmap_skills == 4
        assert summary.completed_skills_count == 1
        assert summary.progress_percent == 25.0
        assert summary.top_job_title == "Backend Developer"
        assert summary.career_score == 72.5
    finally:
        db.close()


def test_render_weekly_email_html_and_text_contain_key_data():
    summary = email_module.WeeklySummary(
        user_email="user@example.com",
        user_name="سامي",
        career_score=88.0,
        top_job_title="Data Analyst",
        total_roadmap_skills=5,
        completed_skills_count=2,
        progress_percent=40.0,
        analysis_id="abc123",
    )
    html = email_module.render_weekly_email_html(summary)
    text = email_module.render_weekly_email_text(summary)

    assert "سامي" in html and "سامي" in text
    assert "Data Analyst" in html and "Data Analyst" in text
    assert "88" in html
    assert "abc123" in html  # الرابط يحتوي على analysis_id
    assert "40.0" in html or "40" in html


def test_send_email_returns_false_when_smtp_host_not_configured(monkeypatch):
    monkeypatch.setattr(email_module.settings, "SMTP_HOST", "")
    result = email_module.send_email("user@example.com", "Subject", "<p>hi</p>", "hi")
    assert result is False


def test_send_email_success_uses_smtp_with_tls_and_login(monkeypatch):
    _reset_fake_smtp()
    monkeypatch.setattr(email_module.settings, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(email_module.settings, "SMTP_PORT", 587)
    monkeypatch.setattr(email_module.settings, "SMTP_USERNAME", "apikey")
    monkeypatch.setattr(email_module.settings, "SMTP_PASSWORD", "secret")
    monkeypatch.setattr(email_module.settings, "SMTP_USE_TLS", True)
    monkeypatch.setattr(email_module.smtplib, "SMTP", FakeSMTP)

    result = email_module.send_email("user@example.com", "الموضوع", "<p>محتوى</p>", "محتوى")

    assert result is True
    assert len(FakeSMTP.sent_messages) == 1
    assert FakeSMTP.login_calls == [("apikey", "secret")]
    from_addr, to_addrs, message_string = FakeSMTP.sent_messages[0]
    assert to_addrs == ["user@example.com"]
    assert "الموضوع" in message_string or "=?utf-8?" in message_string  # قد تُرمَّز الرؤوس MIME


def test_send_email_returns_false_and_logs_on_smtp_failure(monkeypatch):
    _reset_fake_smtp()
    FakeSMTP.should_raise = True
    monkeypatch.setattr(email_module.settings, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(email_module.smtplib, "SMTP", FakeSMTP)

    result = email_module.send_email("user@example.com", "Subject", "<p>hi</p>", "hi")
    assert result is False


def test_send_weekly_progress_emails_skipped_when_globally_disabled(monkeypatch):
    monkeypatch.setattr(email_module.settings, "EMAIL_NOTIFICATIONS_ENABLED", False)
    db = SessionLocal()
    try:
        report = email_module.send_weekly_progress_emails(db)
        assert report["disabled_globally"] is True
        assert report["sent"] == 0
    finally:
        db.close()


def test_send_weekly_progress_emails_full_flow(monkeypatch):
    _reset_fake_smtp()
    monkeypatch.setattr(email_module.settings, "EMAIL_NOTIFICATIONS_ENABLED", True)
    monkeypatch.setattr(email_module.settings, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(email_module.smtplib, "SMTP", FakeSMTP)

    db = SessionLocal()
    try:
        import uuid

        suffix = uuid.uuid4().hex[:8]
        user_opted_in = _create_user_with_analysis(db, email=f"optedin.{suffix}@example.com")
        user_opted_out = _create_user_with_analysis(db, email=f"optedout.{suffix}@example.com")
        user_opted_out.notifications_opt_in = False
        db.add(user_opted_out)
        db.commit()

        # مستخدم مفعّل التنبيهات لكن بلا أي تحليل — يجب تخطّيه أيضاً
        user_no_analysis = User(
            full_name="No Analysis Yet",
            email=f"noanalysis.{suffix}@example.com",
            hashed_password=hash_password("Passw0rd123"),
        )
        db.add(user_no_analysis)
        db.commit()

        report = email_module.send_weekly_progress_emails(db)

        assert report["sent"] >= 1
        assert report["skipped_no_analysis"] >= 1
        sent_recipients = {msg[1][0] for msg in FakeSMTP.sent_messages}
        assert user_opted_in.email in sent_recipients
        assert user_opted_out.email not in sent_recipients
    finally:
        db.close()
