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


def test_phase3_rbac_blocks_candidate_from_recruiter_endpoints(client, registered_user_token):
    token, _ = registered_user_token
    headers = {"Authorization": f"Bearer {token}"}

    # Unprivileged candidate user must receive 403 Forbidden on sensitive candidate profile dump
    profile_resp = client.get("/recruiter/candidates/some-id/profile", headers=headers)
    assert profile_resp.status_code == 403

    # After switching to recruiter role, access is granted (404 for nonexistent id instead of 403)
    switch_resp = client.post("/recruiter/switch-role?company_name=SecureCorp", headers=headers)
    assert switch_resp.status_code == 200
    profile_after = client.get("/recruiter/candidates/some-id/profile", headers=headers)
    assert profile_after.status_code == 403


def test_jobs_matched_idor_protection(client, registered_user_token):
    import uuid

    token_a, _ = registered_user_token
    headers_a = {"Authorization": f"Bearer {token_a}"}
    extraction_id, assessment_id = _create_user_analysis(client, headers_a)
    analyze_resp = client.post(
        "/analyze",
        headers=headers_a,
        json={"extraction_id": extraction_id, "assessment_id": assessment_id},
    )
    assert analyze_resp.status_code == 200
    analysis_id_a = analyze_resp.json()["analysis_id"]

    # Create User B and attempt to read User A's matched jobs via analysis_id
    email_b = f"idor.b.{uuid.uuid4().hex[:8]}@example.com"
    client.post("/register", json={"full_name": "User B", "email": email_b, "password": "Passw0rd123"})
    token_b = client.post("/login", json={"email": email_b, "password": "Passw0rd123"}).json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    idor_resp = client.get(f"/jobs/matched?analysis_id={analysis_id_a}", headers=headers_b)
    assert idor_resp.status_code == 404


def test_phase3_input_validation_and_newest_extraction_ranking(client):
    import uuid

    # 1. Privilege escalation via role='admin' in /register must be rejected (400/422)
    bad_reg = client.post(
        "/register",
        json={
            "full_name": "Attacker",
            "email": f"attacker.{uuid.uuid4().hex[:8]}@example.com",
            "password": "Passw0rd123",
            "role": "admin",
        },
    )
    assert bad_reg.status_code in (400, 422)

    # 2. Register candidate who updates their CV skills over time
    cand_email = f"cand.newest.{uuid.uuid4().hex[:8]}@example.com"
    client.post("/register", json={"full_name": "Upgraded Candidate", "email": cand_email, "password": "Passw0rd123"})
    cand_token = client.post("/login", json={"email": cand_email, "password": "Passw0rd123"}).json()["access_token"]
    cand_headers = {"Authorization": f"Bearer {cand_token}"}
    assert client.put("/settings/recruiter-consent", headers=cand_headers, json={"opted_in": True}).status_code == 200

    # Old extraction: only HTML
    client.post("/extract/manual", headers=cand_headers, json={"skills": ["HTML"]})
    # Newest extraction: Python, FastAPI, Docker, SQL
    newest_ext = client.post(
        "/extract/manual",
        headers=cand_headers,
        json={"skills": ["Python", "FastAPI", "Docker", "SQL"]},
    )
    assert newest_ext.status_code == 200
    newest_ext_id = newest_ext.json()["extraction_id"]

    # 3. Open redirect protection on checkout-session
    bad_checkout = client.post(
        "/subscriptions/checkout-session",
        headers=cand_headers,
        json={"plan_id": "pro", "billing_cycle": "monthly", "success_url": "javascript:alert(1)"},
    )
    assert bad_checkout.status_code in (400, 422)

    # 4. Extension match-job accurately detects C++ and C# symbol skills
    ext_match = client.post(
        "/extension/match-job",
        headers=cand_headers,
        json={
            "job_title": "Systems Engineer",
            "company": "CoreTech",
            "job_description": "We need strong experience in C++, C#, Python, and Docker for high-frequency systems.",
        },
    )
    assert ext_match.status_code == 200
    ext_data = ext_match.json()
    all_detected = ext_data["matched_skills"] + ext_data["missing_skills"]
    assert "C++" in all_detected
    assert "C#" in all_detected

    # 5. Recruiter ranks candidate using their newest extraction (not oldest)
    rec_email = f"rec.newest.{uuid.uuid4().hex[:8]}@example.com"
    client.post(
        "/register",
        json={"full_name": "Recruiter Newest", "email": rec_email, "password": "Passw0rd123", "role": "recruiter"},
    )
    rec_token = client.post("/login", json={"email": rec_email, "password": "Passw0rd123"}).json()["access_token"]
    rec_headers = {"Authorization": f"Bearer {rec_token}"}
    from app.core.mongo import mongo_db
    uid = int(client.get("/profile", headers=rec_headers).json()["id"])
    mongo_db["companies"].insert_one({"company_id": str(uuid.uuid4()), "name": "Test company", "owner_id": uid, "status": "approved"})

    job_resp = client.post(
        "/recruiter/jobs",
        headers=rec_headers,
        json={
            "title": "Senior Python Engineer",
            "required_skills": ["Python", "FastAPI", "Docker", "SQL"],
            "description": "Build scalable APIs with Python and FastAPI.",
        },
    )
    assert job_resp.status_code == 201
    job_id = job_resp.json()["job_id"]

    cands_resp = client.get(f"/recruiter/jobs/{job_id}/candidates", headers=rec_headers)
    assert cands_resp.status_code == 200
    matched_cand = next(c for c in cands_resp.json()["candidates"] if c["email"] == cand_email)
    assert matched_cand["candidate_id"] == newest_ext_id
    assert matched_cand["match_percentage"] >= 80

def test_rate_limit_uses_proxy_addresses(client, monkeypatch):
    from app.core.config import settings

    keys = []
    monkeypatch.setattr(settings, "TRUSTED_PROXY_IPS", {"testclient"})
    monkeypatch.setattr(rate_limiter, "is_allowed", lambda key, **kwargs: (keys.append(key) or True, 0))
    client.post("/login", headers={"X-Real-IP": "192.0.2.1", "X-Forwarded-For": "192.0.2.2, 192.0.2.3"}, json={})
    client.post("/login", headers={"X-Forwarded-For": "192.0.2.2, 192.0.2.3"}, json={})
    assert keys == ["auth:192.0.2.1:/login", "auth:192.0.2.2:/login"]


def test_rate_limit_ignores_untrusted_proxy_headers(client, monkeypatch):
    from app.core.config import settings

    keys = []
    monkeypatch.setattr(settings, "TRUSTED_PROXY_IPS", set())
    monkeypatch.setattr(rate_limiter, "is_allowed", lambda key, **kwargs: (keys.append(key) or True, 0))
    client.post("/login", headers={"X-Real-IP": "192.0.2.1"}, json={})
    assert keys == ["auth:testclient:/login"]


def test_rate_limit_supports_cidr_trusted_proxies():
    from app.core.rate_limit import is_trusted_proxy_ip

    trusted = {"127.0.0.1", "172.16.0.0/12", "10.0.0.0/8", "testclient"}
    assert is_trusted_proxy_ip("127.0.0.1", trusted) is True
    assert is_trusted_proxy_ip("172.18.0.5", trusted) is True
    assert is_trusted_proxy_ip("10.50.1.2", trusted) is True
    assert is_trusted_proxy_ip("testclient", trusted) is True
    assert is_trusted_proxy_ip("192.168.1.1", trusted) is False
    assert is_trusted_proxy_ip("203.0.113.195", trusted) is False
