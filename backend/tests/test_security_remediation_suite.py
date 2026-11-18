"""Comprehensive Phases 1-6 Security Remediation & Regression Suite."""
from __future__ import annotations

import datetime
import io
import logging
import re
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.benchmark_cache import invalidate_benchmark_cache
from app.core.config import settings
from app.core.database import SessionLocal
from app.core.mongo import (
    analysis_results_collection,
    cv_tasks_collection,
    extractions_collection,
    mongo_db,
    recruiter_jobs_collection,
    subscriptions_collection,
    uploads_collection,
)
from app.core.rate_limit import SecurityHeadersMiddleware, rate_limiter
from app.core.security import (
    create_access_token,
    create_email_verification_token,
    create_reset_token,
    decode_access_token,
    hash_password,
    mark_user_deleted_auth_state,
    verify_password,
)
from app.main import CredentialRedactingFilter, app, redact_sensitive_text
from app.models.mysql_models import User
from app.services import email_notifications, live_jobs_service, llm_client, recruiter_service, subscription_service
from app.services.cv_extraction import (
    MAX_PDF_OBJECTS,
    ExtractedCVData,
    _validate_pdf_byte_complexity,
    extract_cv_data_isolated,
)
from app.worker.celery_app import celery_app
from app.worker.tasks import parse_cv_task

ROOT_DIR = Path(__file__).resolve().parents[2]


def _reg_login(client, role: str = "candidate", company_name: str | None = None, verify: bool = False):
    email = f"sec.{uuid.uuid4().hex[:10]}@example.com"
    body = {"full_name": "Sec Tester", "email": email, "password": "Passw0rd123!", "role": role}
    if company_name:
        body["company_name"] = company_name
    r = client.post("/register", json=body)
    assert r.status_code == 201, r.text
    uid = int(r.json()["id"])
    if verify:
        tok = create_email_verification_token(str(uid), email)
        assert client.post("/verify-email", json={"token": tok}).status_code == 200
    login = client.post("/login", json={"email": email, "password": "Passw0rd123!"})
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}, uid, email, token


# ===========================================================================
# Phase 1: Token URLs, Redaction, Email Verification, Drafts, HTTPS, Extension
# ===========================================================================


def test_phase1_fragment_links_and_log_redaction(monkeypatch):
    sent = []
    monkeypatch.setattr(email_notifications.settings, "EMAIL_NOTIFICATIONS_ENABLED", True)
    monkeypatch.setattr(email_notifications.settings, "FRONTEND_BASE_URL", "https://app.example.com")
    monkeypatch.setattr(email_notifications, "send_email", lambda to, subj, html, text: sent.append((html, text)) or True)

    assert email_notifications.send_password_reset_email("u@example.com", "User", "reset-tok-123") is True
    assert "https://app.example.com/reset-password#token=reset-tok-123" in sent[-1][1]
    assert "/reset-password/reset-tok-123" not in sent[-1][1]

    assert email_notifications.send_email_verification_email("u@example.com", "User", "ver-tok-456") is True
    assert "https://app.example.com/verify-email#token=ver-tok-456" in sent[-1][1]
    assert "/verify-email/ver-tok-456" not in sent[-1][1]

    sample = (
        'GET /reset-password/secret-reset HTTP/1.1 '
        'POST /company-invitation/secret-invite '
        'GET /shared/secret-share '
        'GET /verify-email/secret-ver '
        'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig '
        'https://api.adzuna.com/v1/api/jobs/gb/search/1?app_id=myid&app_key=mykey&what=python'
    )
    redacted = redact_sensitive_text(sample)
    for secret in ("secret-reset", "secret-invite", "secret-share", "secret-ver", "eyJhbGciOiJIUzI1NiJ9", "myid", "mykey"):
        assert secret not in redacted
    assert "[REDACTED]" in redacted

    flt = CredentialRedactingFilter()
    rec = logging.LogRecord("uvicorn.access", logging.INFO, "", 0, "Bearer %s /shared/%s", ("topsecretjwt", "sharesecret"), None)
    flt.filter(rec)
    assert "topsecretjwt" not in rec.msg and "sharesecret" not in rec.msg

    for cfg_name in ("nginx.conf", "nginx-https.conf", "frontend/nginx.conf"):
        cfg = (ROOT_DIR / cfg_name).read_text(encoding="utf-8")
        assert 'Referrer-Policy "no-referrer"' in cfg
        assert "log_format redacted_main" in cfg
        assert "Cache-Control" in cfg

    index_html = (ROOT_DIR / "frontend/index.html").read_text(encoding="utf-8")
    assert 'name="referrer" content="no-referrer"' in index_html


def test_phase1_shared_exchange_expiry_and_headers(client):
    headers, uid, _, _ = _reg_login(client)
    analysis_id = f"ana-{uuid.uuid4().hex}"
    analysis_results_collection.insert_one(
        {
            "analysis_id": analysis_id,
            "user_id": uid,
            "career_score": 81.0,
            "career_dna": {"strength": "Backend"},
            "top_jobs": [
                {
                    "job_title": "Backend Engineer",
                    "match_percentage": 88,
                    "matched_skills": ["Python"],
                    "missing_skills": [],
                    "explanation": "Strong match",
                }
            ],
            "date": datetime.datetime.now(datetime.timezone.utc),
        }
    )
    try:
        r_create = client.post(f"/history/{analysis_id}/share", headers=headers)
        assert r_create.status_code == 200
        tok1 = r_create.json()["share_token"]
        doc = analysis_results_collection.find_one({"analysis_id": analysis_id})
        assert doc.get("share_expires_at") is not None

        # Legacy GET /shared/{token} route no longer serves data
        assert client.get(f"/shared/{tok1}").status_code in (404, 405)

        ex = client.post("/shared/exchange", json={"share_token": tok1})
        assert ex.status_code == 200
        assert ex.headers.get("Referrer-Policy") == "no-referrer"
        assert "no-store" in ex.headers.get("Cache-Control", "")
        assert ex.headers.get("Pragma") == "no-cache"

        # Expire share token -> exchange returns 404, and POST /share regenerates a new token
        past = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1)
        analysis_results_collection.update_one({"analysis_id": analysis_id}, {"$set": {"share_expires_at": past}})
        assert client.post("/shared/exchange", json={"share_token": tok1}).status_code == 404

        r_regen = client.post(f"/history/{analysis_id}/share", headers=headers)
        assert r_regen.status_code == 200
        assert r_regen.json()["already_existed"] is False
        assert r_regen.json()["share_token"] != tok1
    finally:
        analysis_results_collection.delete_one({"analysis_id": analysis_id})


def test_phase1_email_verification_and_cross_company_invite_isolation(client, monkeypatch):
    sent_ver = []
    monkeypatch.setattr(settings, "EMAIL_NOTIFICATIONS_ENABLED", True)
    monkeypatch.setattr(settings, "REQUIRE_EMAIL_VERIFICATION", True)
    monkeypatch.setattr(
        "app.api.routes.auth.send_email_verification_email",
        lambda to, name, token: sent_ver.append((to, token)) or True,
    )
    monkeypatch.setattr("app.api.routes.auth.send_registration_welcome_email", lambda *a: True)

    member_email = f"verif.{uuid.uuid4().hex[:8]}@example.com"
    r_reg = client.post("/register", json={"full_name": "Verify User", "email": member_email, "password": "Passw0rd123!"})
    assert r_reg.status_code == 201
    assert r_reg.json()["email_verified"] is False
    assert len(sent_ver) == 1
    ver_token = sent_ver[0][1]

    # Unverified login blocked when REQUIRE_EMAIL_VERIFICATION=True
    assert client.post("/login", json={"email": member_email, "password": "Passw0rd123!"}).status_code == 403

    # Verify email (single-use)
    assert client.post("/verify-email", json={"token": ver_token}).status_code == 200
    assert client.post("/verify-email", json={"token": ver_token}).status_code == 400
    member_login = client.post("/login", json={"email": member_email, "password": "Passw0rd123!"})
    assert member_login.status_code == 200
    assert member_login.json()["user"]["email_verified"] is True
    member_headers = {"Authorization": f"Bearer {member_login.json()['access_token']}"}

    # Cross-company invite isolation on DELETE /profile + owner-only DELETE /companies/{id}/invitations
    monkeypatch.setattr(settings, "REQUIRE_EMAIL_VERIFICATION", False)
    owner_headers, owner_uid, _, _ = _reg_login(client, verify=True)
    company_id = str(uuid.uuid4())
    mongo_db["companies"].insert_one(
        {
            "company_id": company_id,
            "name": "IsolatedCo",
            "owner_id": owner_uid,
            "status": "approved",
            "review_version": 1,
            "invitations": [],
        }
    )
    invite_msgs = []
    monkeypatch.setattr("app.api.routes.companies.send_email", lambda to, subj, html, text: invite_msgs.append(text) or True)
    try:
        inv_resp = client.post(f"/companies/{company_id}/invitations", headers=owner_headers, json={"email": member_email})
        assert inv_resp.status_code == 201
        assert "company-invitation#token=" in invite_msgs[-1]

        # Delete member's own account: MUST NOT delete pending invitation in owner's company
        assert client.delete("/profile", headers=member_headers).status_code == 200
        comp_after_del = mongo_db["companies"].find_one({"company_id": company_id})
        assert any(i["email"] == member_email for i in comp_after_del.get("invitations", []))

        # Non-owner cannot revoke; owner can revoke via DELETE /companies/{id}/invitations
        assert client.delete(f"/companies/{company_id}/invitations", headers=owner_headers, params={"email": "missing@example.com"}).status_code == 404
        assert client.delete(f"/companies/{company_id}/invitations", headers=owner_headers, params={"email": member_email}).status_code == 200
        comp_after_revoke = mongo_db["companies"].find_one({"company_id": company_id})
        assert comp_after_revoke.get("invitations", []) == []
    finally:
        mongo_db["companies"].delete_one({"company_id": company_id})


def test_phase1_unconfirmed_cv_drafts_blocked_from_recruiter(client):
    rec_headers, rec_uid, _, _ = _reg_login(client, role="recruiter", company_name="DraftBlockCo")
    company_id = str(uuid.uuid4())
    mongo_db["companies"].insert_one({"company_id": company_id, "name": "DraftBlockCo", "owner_id": rec_uid, "status": "approved"})

    cand_headers, cand_uid, _, _ = _reg_login(client)
    assert client.put("/settings/recruiter-consent", headers=cand_headers, json={"opted_in": True}).status_code == 200

    draft_ext = client.post("/extract/manual", headers=cand_headers, json={"skills": ["Python", "FastAPI"]}).json()["extraction_id"]
    statusless_id = str(uuid.uuid4())
    extractions_collection.insert_one({"extraction_id": statusless_id, "user_id": cand_uid, "skills": ["Python"]})

    job_id = client.post("/recruiter/jobs", headers=rec_headers, json={"title": "Python Dev", "required_skills": ["Python"]}).json()["job_id"]
    try:
        for cid in (draft_ext, statusless_id):
            cands = client.get(f"/recruiter/jobs/{job_id}/candidates", headers=rec_headers).json()["candidates"]
            assert all(c["candidate_id"] != cid for c in cands)
            assert client.get(f"/recruiter/candidates/{cid}/profile", headers=rec_headers).status_code == 404
            assert client.post(f"/recruiter/jobs/{job_id}/candidates/{cid}/status", headers=rec_headers, json={"pipeline_status": "shortlisted"}).status_code == 404
            assert client.post(f"/recruiter/jobs/{job_id}/candidates/{cid}/ai-review", headers=rec_headers).status_code == 404

        # Confirming draft makes it visible
        assert client.post(
            "/extract/confirm",
            headers=cand_headers,
            json={"extraction_id": draft_ext, "skills": ["Python", "FastAPI"], "projects": [], "education": [], "experience": []},
        ).status_code == 200
        cands_after = client.get(f"/recruiter/jobs/{job_id}/candidates", headers=rec_headers).json()["candidates"]
        assert any(c["candidate_id"] == draft_ext for c in cands_after)
        assert client.get(f"/recruiter/candidates/{draft_ext}/profile", headers=rec_headers).status_code == 200
    finally:
        extractions_collection.delete_many({"extraction_id": {"$in": [draft_ext, statusless_id]}})
        recruiter_jobs_collection.delete_many({"company_id": company_id})
        mongo_db["companies"].delete_one({"company_id": company_id})
        mongo_db["recruiter_consent"].delete_one({"_id": cand_uid})


def test_phase1_https_enforcement_in_production(client, monkeypatch):
    monkeypatch.setattr(settings, "ENV", "production")
    monkeypatch.setattr(settings, "REQUIRE_HTTPS_IN_PRODUCTION", True)

    r_http = client.get("/benchmark", headers={"X-Forwarded-Proto": "http"})
    assert r_http.status_code == 426
    assert r_http.headers.get("Referrer-Policy") == "no-referrer"

    # /health remains accessible for container healthchecks
    r_health = client.get("/health", headers={"X-Forwarded-Proto": "http"})
    assert r_health.status_code == 200

    prod_compose = (ROOT_DIR / "docker-compose.prod.yml").read_text(encoding="utf-8")
    assert "./nginx-https.conf:/etc/nginx/conf.d/default.conf:ro" in prod_compose
    assert '"443:443"' in prod_compose
    nginx_http = (ROOT_DIR / "nginx.conf").read_text(encoding="utf-8")
    assert "return 301 https://$host$request_uri;" in nginx_http
    assert "/.well-known/acme-challenge/" in nginx_http


def test_phase1_extension_scoped_token_enforced(client):
    headers, uid, _, access_tok = _reg_login(client)
    ext_resp = client.post("/extension/token", headers=headers)
    assert ext_resp.status_code == 200
    ext_tok = ext_resp.json()["extension_token"]
    claims = decode_access_token(ext_tok)
    assert claims["type"] == "extension_match"
    assert claims["scope"] == "extension:match"

    # Full access token & reset token rejected on /extension/match-job
    assert client.post("/extension/match-job", headers=headers, json={"job_title": "Dev", "job_description": "Python"}).status_code == 401
    reset_tok = create_reset_token(str(uid))
    assert client.post(
        "/extension/match-job",
        headers={"Authorization": f"Bearer {reset_tok}"},
        json={"job_title": "Dev", "job_description": "Python"},
    ).status_code == 401

    # Extension match-only token rejected on /profile, accepted on /extension/match-job
    ext_headers = {"Authorization": f"Bearer {ext_tok}"}
    assert client.get("/profile", headers=ext_headers).status_code == 401
    ok = client.post("/extension/match-job", headers=ext_headers, json={"job_title": "Dev", "job_description": "Need Python"})
    assert ok.status_code == 200


# ===========================================================================
# Phase 2: Concurrency, Logout/Session Revocation, Bcrypt Limit, ID Reuse
# ===========================================================================


def test_phase2_deleted_account_never_resurrected_by_updates(client):
    headers, uid, _, _ = _reg_login(client)
    with SessionLocal() as db:
        db.query(User).filter(User.id == uid).delete()
        db.commit()

    # Neither profile nor settings updates may resurrect the deleted row
    assert client.put("/profile", headers=headers, json={"full_name": "Ghost"}).status_code == 401
    assert client.put("/settings/notifications", headers=headers, json={"notifications_opt_in": False}).status_code == 401
    assert client.put("/settings/benchmark-opt-in", headers=headers, json={"opted_in": True}).status_code == 401
    assert client.put("/settings/recruiter-consent", headers=headers, json={"opted_in": True}).status_code == 401
    assert client.put("/settings/cloud-ai-consent", headers=headers, json={"opted_in": True}).status_code == 401
    assert client.delete("/profile", headers=headers).status_code == 401
    with SessionLocal() as db:
        assert db.query(User).filter(User.id == uid).first() is None


def test_phase2_logout_logout_all_and_atomic_reset_rollback(client):
    assert settings.JWT_EXPIRE_MINUTES == 60
    headers1, uid, email, tok1 = _reg_login(client)
    tok2 = client.post("/login", json={"email": email, "password": "Passw0rd123!"}).json()["access_token"]
    headers2 = {"Authorization": f"Bearer {tok2}"}

    # Server-side single-session logout revokes tok1 jti, keeps tok2 active
    assert client.post("/logout", headers=headers1).status_code == 200
    assert client.get("/profile", headers=headers1).status_code == 401
    assert client.get("/profile", headers=headers2).status_code == 200

    # logout-all bumps token_version and invalidates tok2
    assert client.post("/logout-all", headers=headers2).status_code == 200
    assert client.get("/profile", headers=headers2).status_code == 401

    # Reset-password rolls back consumed JTI when SQL commit fails
    reset_tok = create_reset_token(str(uid))
    jti = decode_access_token(reset_tok)["jti"]
    with patch("sqlalchemy.orm.Session.commit", side_effect=RuntimeError("db fail")):
        with pytest.raises(RuntimeError):
            client.post("/reset-password", json={"token": reset_tok, "new_password": "NewPassw0rd999!"})
    assert mongo_db["used_reset_tokens"].find_one({"_id": jti}) is None

    # Now succeeds atomically and bumps token_version
    assert client.post("/reset-password", json={"token": reset_tok, "new_password": "NewPassw0rd999!"}).status_code == 200
    assert client.post("/reset-password", json={"token": reset_tok, "new_password": "AnotherPass123!"}).status_code == 400


def test_phase2_bcrypt_72_byte_limit_and_sqlite_id_reuse_guard(client):
    # 20 emojis * 4 bytes + 3 ASCII = 83 UTF-8 bytes (< 128 chars, > 72 bytes)
    long_utf8_pw = "A1a" + ("🔒" * 20)
    r = client.post("/register", json={"full_name": "Utf8 User", "email": f"u8.{uuid.uuid4().hex[:8]}@example.com", "password": long_utf8_pw})
    assert r.status_code in (400, 422)
    with pytest.raises(ValueError, match="72-byte"):
        hash_password(long_utf8_pw)
    assert verify_password(long_utf8_pw, hash_password("ValidPass123!")) is False

    # Simulate SQLite integer ID reuse after deletion
    headers, uid, _, _ = _reg_login(client)
    mark_user_deleted_auth_state(uid)
    # Even if a brand-new User row somehow had the same id, tokens issued at/before deleted_at_ts are rejected
    assert client.get("/profile", headers=headers).status_code == 401


# ===========================================================================
# Phase 3: Least Privilege, AI Egress, Adzuna Redaction & TTL
# ===========================================================================


def test_phase3_mongo_least_privilege_and_compose_hardening():
    init_js = (ROOT_DIR / "mongo-init.js").read_text(encoding="utf-8")
    assert "career_api" in init_js and "career_worker" in init_js
    assert 'role: "readWrite", db: dbName' in init_js

    prod_compose = (ROOT_DIR / "docker-compose.prod.yml").read_text(encoding="utf-8")
    assert "MONGO_API_USER" in prod_compose and "MONGO_WORKER_USER" in prod_compose
    assert 'USE_SQLITE_FALLBACK: "0"' in prod_compose
    # Backend & worker sections must not inject root mongo credentials
    backend_block = prod_compose.split("  backend:")[1].split("  celery-worker:")[0]
    worker_block = prod_compose.split("  celery-worker:")[1].split("  celery-beat:")[0]
    assert "MONGO_INITDB_ROOT" not in backend_block
    assert "MONGO_INITDB_ROOT" not in worker_block


def test_phase3_openai_feature_flags_consent_and_pii_redaction(client, monkeypatch):
    headers, uid, _, _ = _reg_login(client)
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "sk-test-key")
    monkeypatch.setenv("OPENAI_CV_ENABLED", "1")

    mock_openai_client = MagicMock()
    mock_openai_client.chat.completions.create.return_value = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content="ok-openai"))]
    )

    # Without user cloud_ai_consent, falls back to Ollama (never calls OpenAI)
    with patch("app.services.llm_client.openai.OpenAI", return_value=mock_openai_client) as openai_ctor, patch(
        "app.services.llm_client.ollama_chat", return_value="ok-ollama"
    ) as mock_ollama:
        out_no_consent = llm_client.call_llm("My email is alice@secret.com phone +970-599-112233", "sys", task="cv_extraction", user_id=uid)
        assert out_no_consent == "ok-ollama"
        assert openai_ctor.call_count == 0
        assert mock_ollama.call_count == 1

    # Opt in to cloud AI consent via API -> OpenAI called with PII redacted
    assert client.get("/settings/cloud-ai-consent", headers=headers).json()["opted_in"] is False
    assert client.put("/settings/cloud-ai-consent", headers=headers, json={"opted_in": True}).status_code == 200
    assert client.get("/settings/cloud-ai-consent", headers=headers).json()["opted_in"] is True

    try:
        with patch("app.services.llm_client.openai.OpenAI", return_value=mock_openai_client) as openai_ctor:
            out_consent = llm_client.call_llm("Contact alice@secret.com or +970-599-112233", "sys", task="cv_extraction", user_id=uid)
        assert out_consent == "ok-openai"
        assert openai_ctor.call_count == 1
        sent_msg = mock_openai_client.chat.completions.create.call_args.kwargs["messages"][-1]["content"]
        assert "alice@secret.com" not in sent_msg
        assert "599-112233" not in sent_msg
        assert "[REDACTED_EMAIL]" in sent_msg
        assert "[REDACTED_PHONE]" in sent_msg
    finally:
        mongo_db["cloud_ai_consent"].delete_one({"_id": uid})


def test_phase3_adzuna_log_redaction_and_cache_ttl(monkeypatch, caplog):
    monkeypatch.setattr(settings, "ADZUNA_APP_ID", "adzuna-secret-id")
    monkeypatch.setattr(settings, "ADZUNA_APP_KEY", "adzuna-secret-key")
    req = httpx.Request("GET", "https://api.adzuna.com/v1/api/jobs/gb/search/1?app_id=adzuna-secret-id&app_key=adzuna-secret-key&what=secretrole")
    resp = httpx.Response(502, request=req)
    http_err = httpx.HTTPStatusError("Upstream error for " + str(req.url), request=req, response=resp)

    with patch("app.services.live_jobs_service.httpx.get", side_effect=http_err):
        with pytest.raises(RuntimeError) as exc_info:
            live_jobs_service._fetch_adzuna_jobs("secretrole", timeout=1.0)
    err_str = str(exc_info.value)
    assert "adzuna-secret-id" not in err_str
    assert "adzuna-secret-key" not in err_str
    assert "secretrole" not in err_str
    assert "502" in err_str

    live_jobs_service._write_cached_feed("external_jobs:test_ttl", [{"id": "j1"}])
    cached_doc = mongo_db["external_jobs_cache"].find_one({"cache_key": "external_jobs:test_ttl"})
    try:
        assert cached_doc is not None
        assert isinstance(cached_doc.get("expires_at_dt"), datetime.datetime)
    finally:
        mongo_db["external_jobs_cache"].delete_one({"cache_key": "external_jobs:test_ttl"})


# ===========================================================================
# Phase 4: Benchmark k-Anonymity, Worker Erasure Guard, CAS Review, Support
# ===========================================================================


def test_phase4_benchmark_distinct_users_and_delete_cache_invalidation(client):
    invalidate_benchmark_cache()
    headers, uid, _, _ = _reg_login(client)
    assert client.put("/settings/benchmark-opt-in", headers=headers, json={"opted_in": True}).status_code == 200
    # One user with 6 analyses must count as sample_size=1, never 6
    ana_ids = []
    for i in range(6):
        aid = f"bench-multi-{i}-{uuid.uuid4().hex[:6]}"
        ana_ids.append(aid)
        analysis_results_collection.insert_one(
            {
                "analysis_id": aid,
                "user_id": uid,
                "career_score": 80.0 + i,
                "top_jobs": [{"job_title": "Backend Engineer"}],
                "date": datetime.datetime.now(datetime.timezone.utc),
            }
        )
    try:
        res = client.get("/benchmark", headers=headers).json()
        assert res["sample_size"] == 1
        assert res["average_career_score"] is None
        assert res["by_job_title"] == {}

        # Deleting opted-in user invalidates benchmark cache
        viewer_headers, _, _, _ = _reg_login(client)
        assert client.delete("/profile", headers=headers).status_code == 200
        after_del = client.get("/benchmark", headers=viewer_headers).json()
        assert after_del["sample_size"] == 0
    finally:
        analysis_results_collection.delete_many({"analysis_id": {"$in": ana_ids}})
        invalidate_benchmark_cache()


def test_phase4_worker_erasure_guard_and_celery_bounds(client, tmp_path):
    assert celery_app.conf.result_expires == 300
    assert celery_app.conf.task_soft_time_limit == 120
    assert celery_app.conf.task_time_limit == 150

    _, uid, _, _ = _reg_login(client)
    file_id = f"f-{uuid.uuid4().hex}"
    # Place dummy file inside settings.UPLOAD_DIR so _unlink_upload_safely can remove it
    upload_path = Path(settings.UPLOAD_DIR) / f"{file_id}.pdf"
    upload_path.parent.mkdir(parents=True, exist_ok=True)
    upload_path.write_bytes(b"%PDF-1.4 dummy")
    uploads_collection.insert_one({"file_id": file_id, "user_id": uid, "path": str(upload_path)})
    task_id = f"task-{uuid.uuid4().hex}"

    def _delete_user_mid_flight(*args, **kwargs):
        with SessionLocal() as db:
            db.query(User).filter(User.id == uid).delete()
            db.commit()
        mark_user_deleted_auth_state(uid)
        return ExtractedCVData(skills=["Python"], projects=[], education=[], experience=[])

    try:
        with patch("app.worker.tasks.extract_cv_data", side_effect=_delete_user_mid_flight):
            result = parse_cv_task(file_id, uid, task_id)
        assert result["status"] == "aborted"
        assert not upload_path.exists()
        assert extractions_collection.count_documents({"user_id": uid}) == 0
        assert cv_tasks_collection.count_documents({"task_id": task_id}) == 0
    finally:
        uploads_collection.delete_one({"file_id": file_id})
        extractions_collection.delete_many({"user_id": uid})
        cv_tasks_collection.delete_many({"task_id": task_id})
        upload_path.unlink(missing_ok=True)


def test_phase4_company_review_cas_and_recruiter_pii_minimization(client):
    owner_headers, owner_uid, _, _ = _reg_login(client)
    reviewer_headers, reviewer_uid, _, _ = _reg_login(client)
    owners = mongo_db["platform_owner"]
    prev_owner = owners.find_one({"_id": "owner"})
    owners.replace_one({"_id": "owner"}, {"_id": "owner", "user_id": reviewer_uid}, upsert=True)

    comp = client.post("/companies", headers=owner_headers, json={"name": "OriginalCo"}).json()
    cid = comp["company_id"]
    assert comp["review_version"] == 1
    try:
        renamed = client.put(f"/companies/{cid}", headers=owner_headers, json={"name": "RenamedCo"})
        assert renamed.status_code == 200
        assert renamed.json()["review_version"] == 2
        assert renamed.json()["status"] == "pending"

        # Stale expected_version=1 returns 409 Conflict
        stale = client.patch(
            f"/companies/{cid}/status",
            headers=reviewer_headers,
            json={"status": "approved", "expected_version": 1},
        )
        assert stale.status_code == 409

        ok = client.patch(
            f"/companies/{cid}/status",
            headers=reviewer_headers,
            json={"status": "approved", "expected_version": 2},
        )
        assert ok.status_code == 200
        assert ok.json()["status"] == "approved"

        # Suspended company cannot be renamed
        susp = client.patch(
            f"/companies/{cid}/status",
            headers=reviewer_headers,
            json={"status": "suspended", "expected_version": 2},
        )
        assert susp.status_code == 200
        assert client.put(f"/companies/{cid}", headers=owner_headers, json={"name": "BypassCo"}).status_code == 403
    finally:
        owners.delete_one({"_id": "owner"})
        if prev_owner:
            owners.insert_one(prev_owner)
        mongo_db["companies"].delete_one({"company_id": cid})

    # Recruiter AI fit evaluation passes generic "Candidate" label, never real name
    with patch("app.services.recruiter_service.generate_candidate_fit_evaluation", return_value={
        "verdict": "Good", "fit_summary": "Summary", "interview_focus_areas": ["APIs"], "hiring_readiness": "High", "evaluation_source": "llm"
    }) as mock_eval:
        recruiter_service._resolve_candidate_fit(
            job={"job_id": "j1", "company_id": "c-pii", "title": "Dev", "required_skills": ["Python"], "bonus_skills": []},
            candidate_id="c1",
            candidate_name="Sensitive Real Name",
            target_role="Dev",
            cand_skills=["Python"],
            matched_req=["Python"],
            missing_req=[],
            matched_bon=[],
            match_percentage=100,
            allow_llm=True,
            force_refresh=True,
            recruiter_id=999991,
        )
        assert mock_eval.call_args.kwargs["candidate_name"] == "Candidate"
    mongo_db["recruiter_fit_cache"].delete_many({"job_id": "j1"})
    mongo_db["recruiter_ai_budgets"].delete_many({"_id": {"$regex": "999991|c-pii"}})


# ===========================================================================
# Phase 5: Feature Gates, Atomic Quotas, Parser Bounds, Billing, Input Bounds
# ===========================================================================


def test_phase5_free_tier_gates_atomic_quotas_and_ai_budgets(client):
    headers, uid, _, _ = _reg_login(client)
    ext_id = client.post("/extract/manual", headers=headers, json={"skills": ["Python", "SQL"]}).json()["extraction_id"]
    assert (
        client.post(
            "/extract/confirm",
            headers=headers,
            json={"extraction_id": ext_id, "skills": ["Python", "SQL"], "projects": [], "education": [], "experience": []},
        ).status_code
        == 200
    )
    questions = client.get("/assessment", headers=headers).json()["questions"]
    answers = [
        {"question_id": q["id"], "value": 3 if q["type"] == "scale" else (q["options"][:1] if q["type"] == "multiple_choice" else q["options"][0])}
        for q in questions
    ]
    assess_id = client.post("/assessment", headers=headers, json={"answers": answers}).json()["assessment_id"]
    analysis_id = client.post("/analyze", headers=headers, json={"extraction_id": ext_id, "assessment_id": assess_id}).json()["analysis_id"]
    session_id = client.post("/interview/start", headers=headers, json={"analysis_id": analysis_id, "job_title": "Backend"}).json()["session_id"]

    # Free-tier blocked (403) on voice interview and ATS builder routes
    assert client.post(
        f"/interview/{session_id}/voice",
        headers=headers,
        data={"duration_seconds": "3.0", "transcript_hint": "hello"},
    ).status_code == 403
    assert client.post(f"/extract/{ext_id}/ats-builder/optimize", headers=headers, json={"full_name": "Free User"}).status_code == 403
    assert client.post(f"/extract/{ext_id}/export-ats-pdf", headers=headers, json={"full_name": "Free User"}).status_code == 403

    # Atomic quota reservation prevents concurrent bypass of max_analyses=3
    quota_uid = 880000 + (uid % 10000)
    fake_free_user = SimpleNamespace(id=quota_uid, subscription_tier="free")
    mongo_db["usage_quotas"].delete_one({"_id": quota_uid})
    try:
        with ThreadPoolExecutor(max_workers=6) as pool:
            results = list(
                pool.map(
                    lambda _: _try_reserve(fake_free_user),
                    range(6),
                )
            )
        assert results.count(True) == 3
        assert results.count(False) == 3
        subscription_service.release_user_quota(quota_uid, "analysis")
        assert _try_reserve(fake_free_user) is True
    finally:
        mongo_db["usage_quotas"].delete_one({"_id": quota_uid})

    # Recruiter AI-review default force_refresh=False + atomic budget cap (429)
    rec_headers, rec_uid, _, _ = _reg_login(client)
    comp_id = str(uuid.uuid4())
    mongo_db["companies"].insert_one({"company_id": comp_id, "name": "BudgetCo", "owner_id": rec_uid, "status": "approved"})
    job_id = client.post("/recruiter/jobs", headers=rec_headers, json={"title": "Dev", "required_skills": ["Python"]}).json()["job_id"]
    client.put("/settings/recruiter-consent", headers=headers, json={"opted_in": True})
    try:
        with patch("app.services.recruiter_service.generate_candidate_fit_evaluation", return_value={
            "verdict": "Good", "fit_summary": "Fit", "interview_focus_areas": ["Python"], "hiring_readiness": "High", "evaluation_source": "llm"
        }) as mock_eval:
            r1 = client.post(f"/recruiter/jobs/{job_id}/candidates/{ext_id}/ai-review", headers=rec_headers)
            assert r1.status_code == 200
            r2 = client.post(f"/recruiter/jobs/{job_id}/candidates/{ext_id}/ai-review", headers=rec_headers)
            assert r2.status_code == 200
            assert mock_eval.call_count == 1  # default force_refresh=False hits cache on r2

        # Exhaust user AI budget
        today = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
        mongo_db["recruiter_ai_budgets"].update_one(
            {"_id": f"user:{rec_uid}:{today}"},
            {"$set": {"count": recruiter_service.RECRUITER_AI_USER_DAILY_LIMIT}},
            upsert=True,
        )
        r_budget = client.post(
            f"/recruiter/jobs/{job_id}/candidates/{ext_id}/ai-review",
            headers=rec_headers,
            params={"force_refresh": "true"},
        )
        assert r_budget.status_code == 429
    finally:
        mongo_db["recruiter_ai_budgets"].delete_many({"_id": {"$regex": f":{today}$"}})
        mongo_db["recruiter_fit_cache"].delete_many({"job_id": job_id})
        recruiter_jobs_collection.delete_many({"company_id": comp_id})
        mongo_db["companies"].delete_one({"company_id": comp_id})
        mongo_db["recruiter_consent"].delete_one({"_id": uid})


def _try_reserve(user_obj) -> bool:
    try:
        return subscription_service.reserve_user_quota(user_obj, "analysis")
    except ValueError:
        return False


def test_phase5_audio_cap_pdf_complexity_and_prod_async_isolation(client, monkeypatch, tmp_path):
    from app.services import audio_metrics

    assert audio_metrics.MAX_DECODED_SAMPLES == 16000 * 180

    # Audio cap stops decoding beyond MAX_DECODED_SAMPLES
    class _FakeFrame:
        def to_ndarray(self):
            import numpy as np
            return np.ones(16000, dtype=np.float32) * 0.25

    class _FakeContainer:
        streams = [SimpleNamespace(type="audio")]
        def decode(self, stream):
            for _ in range(300):
                yield _FakeFrame()
        def __enter__(self):
            return self
        def __exit__(self, *a):
            return False

    class _FakeResampler:
        def resample(self, frame):
            return [] if frame is None else [frame]

    with patch("av.open", return_value=_FakeContainer()), patch("av.AudioResampler", return_value=_FakeResampler()):
        metrics = audio_metrics.extract_acoustic_metrics(b"RIFF" + b"\x00" * 100)
    assert metrics is not None
    assert metrics.decoded_duration_seconds <= 180.0

    # PDF object/stream complexity guard
    complex_pdf = tmp_path / "bomb.pdf"
    complex_pdf.write_bytes(b"%PDF-1.4\n" + (b"1 0 obj\n<<>>\nendobj\n" * (MAX_PDF_OBJECTS + 5)))
    with pytest.raises(ValueError, match="complexity"):
        _validate_pdf_byte_complexity(complex_pdf)

    with patch("app.services.cv_extraction._read_pdf_text_isolated", return_value="Python FastAPI Docker") as mock_iso:
        data = extract_cv_data_isolated(str(complex_pdf))
        assert mock_iso.call_count == 1
        assert "Python" in data.skills

    # In production, offline broker returns 503 instead of in-process sync fallback
    headers, uid, _, _ = _reg_login(client)
    file_id = f"prod-f-{uuid.uuid4().hex}"
    uploads_collection.insert_one({"file_id": file_id, "user_id": uid, "path": str(complex_pdf)})
    monkeypatch.setattr(settings, "ENV", "production")
    monkeypatch.setattr(settings, "CELERY_TASK_ALWAYS_EAGER", False)
    try:
        with patch("app.api.routes.cv.parse_cv_task.apply_async", side_effect=ConnectionError("broker down")):
            resp = client.post("/extract/async", headers=headers, json={"file_id": file_id})
        assert resp.status_code == 503
    finally:
        uploads_collection.delete_one({"file_id": file_id})
        cv_tasks_collection.delete_many({"user_id": uid})


def test_phase5_stripe_sync_and_input_bounds(client, monkeypatch):
    headers, uid, email, _ = _reg_login(client)

    # Checkout session attaches subscription_data.metadata
    captured_kwargs = {}
    fake_stripe = MagicMock()
    fake_stripe.checkout.Session.create.side_effect = lambda **kw: captured_kwargs.update(kw) or SimpleNamespace(id="cs_test_1", url="https://checkout.stripe.com/pay/cs_test_1")
    fake_stripe.Subscription.cancel.return_value = {"id": "sub_123", "status": "canceled"}

    monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", "sk_test_123")
    with patch.dict("sys.modules", {"stripe": fake_stripe}):
        with SessionLocal() as db:
            u = db.query(User).filter(User.id == uid).first()
        res = subscription_service.create_checkout_session(user=u, plan_id="pro", billing_cycle="monthly")
        assert res["session_id"] == "cs_test_1"
        assert captured_kwargs["subscription_data"]["metadata"]["user_id"] == str(uid)
        assert captured_kwargs["subscription_data"]["metadata"]["plan_id"] == "pro"

        # Cancel calls stripe.Subscription.cancel when active Stripe subscription exists
        subscriptions_collection.insert_one({"user_id": uid, "stripe_subscription_id": "sub_123", "status": "active"})
        cancel_res = subscription_service.cancel_subscription(u)
        assert cancel_res["tier"] == "free"
        fake_stripe.Subscription.cancel.assert_called_once_with("sub_123")
    subscriptions_collection.delete_many({"user_id": uid})

    # Production billing stays disabled (503)
    monkeypatch.setattr(settings, "ENV", "production")
    assert client.get("/subscriptions/plans").status_code == 503
    monkeypatch.setattr(settings, "ENV", "testing")

    # Bounded AssessmentSubmitRequest.answers (max 100) & ExtensionMatchRequest.extracted_skills (max 50)
    too_many_answers = [{"question_id": str(i), "value": 3} for i in range(101)]
    assert client.post("/assessment", headers=headers, json={"answers": too_many_answers}).status_code == 400

    ext_tok = client.post("/extension/token", headers=headers).json()["extension_token"]
    ext_headers = {"Authorization": f"Bearer {ext_tok}"}
    too_many_skills = [f"Skill{i}" for i in range(51)]
    assert client.post("/extension/match-job", headers=ext_headers, json={"job_title": "Dev", "extracted_skills": too_many_skills}).status_code == 400

    # PATCH /history/{id}/roadmap rejects non-roadmap skill (400)
    ana_id = f"ana-rm-{uuid.uuid4().hex}"
    analysis_results_collection.insert_one(
        {"analysis_id": ana_id, "user_id": uid, "roadmap": [{"month": 1, "skills_to_learn": ["Docker"], "goals": []}], "completed_skills": []}
    )
    try:
        assert client.patch(f"/history/{ana_id}/roadmap", headers=headers, json={"skill": "ArbitraryFakeSkill", "completed": True}).status_code == 400
        assert client.patch(f"/history/{ana_id}/roadmap", headers=headers, json={"skill": "Docker", "completed": True}).status_code == 200
    finally:
        analysis_results_collection.delete_one({"analysis_id": ana_id})


# ===========================================================================
# Phase 6: Production Image Pinning & Supply Chain Hygiene
# ===========================================================================


def test_phase6_production_compose_pinned_images():
    prod_compose = (ROOT_DIR / "docker-compose.prod.yml").read_text(encoding="utf-8")
    images = re.findall(r"^\s*image:\s*([^\s#]+)", prod_compose, flags=re.MULTILINE)
    assert images, "Expected explicit image entries in docker-compose.prod.yml"
    for img in images:
        assert ":latest" not in img, f"Mutable :latest tag found: {img}"
        assert ":" in img, f"Unversioned image tag found: {img}"
