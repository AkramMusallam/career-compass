"""
اختبارات الأمان والأداء والاعتمادية (Security, Performance & Reliability Tests)
"""
from io import BytesIO
from sqlalchemy import event

from app.core.database import engine
from app.core.rate_limit import rate_limiter


def _create_user_analysis(client, headers):
    ext_resp = client.post(
        "/extract/manual",
        headers=headers,
        json={"skills": ["Python", "SQL", "Docker", "React", "Git", "API Design"]},
    )
    assert ext_resp.status_code == 200
    extraction_id = ext_resp.json()["extraction_id"]

    confirm_resp = client.post(
        "/extract/confirm",
        headers=headers,
        json={
            "extraction_id": extraction_id,
            "skills": ["Python", "SQL", "Docker", "React", "Git", "API Design"],
            "projects": [],
            "education": [],
            "experience": [],
        },
    )
    assert confirm_resp.status_code == 200

    questions = client.get("/assessment", headers=headers).json()["questions"]
    answers = []
    for q in questions:
        if q["type"] == "scale":
            answers.append({"question_id": q["id"], "value": 3})
        elif q["type"] == "single_choice":
            answers.append({"question_id": q["id"], "value": q["options"][0] if q["options"] else ""})
        elif q["type"] == "multiple_choice":
            answers.append({"question_id": q["id"], "value": q["options"][:1]})

    assess_resp = client.post("/assessment", headers=headers, json={"answers": answers})
    assert assess_resp.status_code == 200
    assessment_id = assess_resp.json()["assessment_id"]
    return extraction_id, assessment_id


def test_health_check_and_security_headers(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert data["checks"]["sql"] == "ok"
    assert data["checks"]["mongo"] == "ok"
    assert resp.headers.get("X-Content-Type-Options") == "nosniff"
    assert resp.headers.get("X-Frame-Options") == "DENY"
    assert "strict-origin" in resp.headers.get("Referrer-Policy", "")


def test_assessment_eager_loading_eliminates_n_plus_1(client, registered_user_token):
    token, _ = registered_user_token
    headers = {"Authorization": f"Bearer {token}"}

    queries = []

    def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        if statement.strip().upper().startswith("SELECT"):
            queries.append(statement)

    event.listen(engine, "before_cursor_execute", before_cursor_execute)
    try:
        resp = client.get("/assessment", headers=headers)
    finally:
        event.remove(engine, "before_cursor_execute", before_cursor_execute)

    assert resp.status_code == 200
    assert len(resp.json()["questions"]) > 0
    # 1 query for get_current_user + 2 queries for Question + selectinload(Question.options) = 3 queries (was 12)
    assert len(queries) <= 4, f"Expected <= 4 SELECT queries, got {len(queries)}: {queries}"


def test_analyze_eager_loading_eliminates_141_queries(client, registered_user_token):
    token, _ = registered_user_token
    headers = {"Authorization": f"Bearer {token}"}

    extraction_id, assessment_id = _create_user_analysis(client, headers)

    queries = []

    def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        if statement.strip().upper().startswith("SELECT"):
            queries.append(statement)

    event.listen(engine, "before_cursor_execute", before_cursor_execute)
    try:
        resp = client.post(
            "/analyze",
            headers=headers,
            json={"extraction_id": extraction_id, "assessment_id": assessment_id},
        )
    finally:
        event.remove(engine, "before_cursor_execute", before_cursor_execute)

    assert resp.status_code == 200
    # Previously 141 SELECT queries; now <= 6 queries total (user + jobs/skills + questions/options + courses/skills)
    assert len(queries) <= 6, f"Expected <= 6 SELECT queries, got {len(queries)}"


def test_password_change_invalidates_existing_jwt(client, registered_user_token):
    old_token, email = registered_user_token
    old_headers = {"Authorization": f"Bearer {old_token}"}

    # Token works before password change
    me_before = client.get("/profile", headers=old_headers)
    assert me_before.status_code == 200

    # Change password
    pw_resp = client.put(
        "/settings/password",
        headers=old_headers,
        json={"current_password": "Passw0rd123", "new_password": "NewPassw0rd456"},
    )
    assert pw_resp.status_code == 200

    # Old token must now be rejected with 401
    me_after = client.get("/profile", headers=old_headers)
    assert me_after.status_code == 401

    # Logging in with new password yields a valid token
    login_resp = client.post("/login", json={"email": email, "password": "NewPassw0rd456"})
    assert login_resp.status_code == 200
    new_token = login_resp.json()["access_token"]
    me_new = client.get("/profile", headers={"Authorization": f"Bearer {new_token}"})
    assert me_new.status_code == 200


def test_rate_limiter_blocks_excessive_auth_requests(client):
    rate_limiter.reset()
    rate_limiter.force_enable_in_tests = True
    try:
        statuses = []
        for _ in range(17):
            resp = client.post(
                "/login",
                json={"email": "nobody@example.com", "password": "wrongpassword"},
            )
            statuses.append(resp.status_code)
        assert 429 in statuses, f"Expected 429 Too Many Requests in {statuses}"
    finally:
        rate_limiter.force_enable_in_tests = False
        rate_limiter.reset()


def test_voice_interview_rejects_invalid_mime_type(client, registered_user_token):
    token, _ = registered_user_token
    headers = {"Authorization": f"Bearer {token}"}

    extraction_id, assessment_id = _create_user_analysis(client, headers)
    analyze_resp = client.post(
        "/analyze",
        headers=headers,
        json={"extraction_id": extraction_id, "assessment_id": assessment_id},
    )
    assert analyze_resp.status_code == 200
    analysis_id = analyze_resp.json()["analysis_id"]

    start_resp = client.post(
        "/interview/start",
        headers=headers,
        json={"job_title": "Backend Developer", "analysis_id": analysis_id},
    )
    assert start_resp.status_code == 200
    session_id = start_resp.json()["session_id"]

    bad_file = BytesIO(b"not an audio file")
    voice_resp = client.post(
        f"/interview/{session_id}/voice",
        headers=headers,
        files={"audio": ("exploit.exe", bad_file, "application/x-msdownload")},
    )
    assert voice_resp.status_code == 400
