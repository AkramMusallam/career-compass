"""Regression tests for Option 2 contract alignment and bug fixes."""
from __future__ import annotations

import inspect
import json
import uuid
from unittest.mock import patch

import pytest
from sqlalchemy.exc import OperationalError

from app.core.database import SessionLocal
from app.core.mongo import (
    analysis_results_collection,
    assessments_collection,
    cv_tasks_collection,
    extractions_collection,
    mongo_db,
    recruiter_jobs_collection,
    recruitment_pipeline_collection,
    uploads_collection,
)
from app.core.security import create_access_token, create_reset_token, decode_access_token
from app.models.mysql_models import User
from app.services import interview_service
from app.services.pdf_export import build_ats_resume_pdf, rtl
from app.services.recommendation_engine import match_courses_to_skills


def _register_and_login(client, full_name: str = "Option Two User"):
    email = f"opt2.{uuid.uuid4().hex[:8]}@example.com"
    client.post("/register", json={"full_name": full_name, "email": email, "password": "Passw0rd123"})
    token = client.post("/login", json={"email": email, "password": "Passw0rd123"}).json()["access_token"]
    uid = int(decode_access_token(token)["sub"])
    return {"Authorization": f"Bearer {token}"}, uid, email


def _answer_all_questions(client, headers):
    questions = client.get("/assessment", headers=headers).json()["questions"]
    answers = []
    for q in questions:
        if q["type"] == "scale":
            answers.append({"question_id": q["id"], "value": 4})
        elif q["type"] == "multiple_choice":
            answers.append({"question_id": q["id"], "value": q["options"][:1]})
        else:
            answers.append({"question_id": q["id"], "value": q["options"][0]})
    return questions, answers


def test_profile_target_role_persistence_and_clear(client):
    headers, uid, _ = _register_and_login(client)
    try:
        initial = client.get("/profile", headers=headers)
        assert initial.status_code == 200
        assert initial.json()["target_role"] is None

        updated = client.put(
            "/profile",
            headers=headers,
            json={"full_name": "Updated Name", "target_role": "  Backend Engineer  "},
        )
        assert updated.status_code == 200
        assert updated.json()["target_role"] == "Backend Engineer"
        assert client.get("/profile", headers=headers).json()["target_role"] == "Backend Engineer"

        # Omitting target_role should keep the previously stored value
        kept = client.put("/profile", headers=headers, json={"full_name": "Updated Name Two"})
        assert kept.status_code == 200
        assert kept.json()["target_role"] == "Backend Engineer"

        # Blank target_role clears it back to None
        cleared = client.put("/profile", headers=headers, json={"full_name": "Updated Name Two", "target_role": "   "})
        assert cleared.status_code == 200
        assert cleared.json()["target_role"] is None

        too_long = client.put("/profile", headers=headers, json={"full_name": "Updated", "target_role": "x" * 121})
        assert too_long.status_code == 400
    finally:
        client.delete("/profile", headers=headers)


def test_analyze_and_history_expose_extraction_id_and_ats_bounds(client):
    headers, uid, _ = _register_and_login(client)
    ext_id = None
    assessment_id = None
    analysis_id = None
    try:
        ext_resp = client.post("/extract/manual", headers=headers, json={"skills": ["Python", "SQL", "Docker"]})
        assert ext_resp.status_code == 200
        ext_id = ext_resp.json()["extraction_id"]
        client.post(
            "/extract/confirm",
            headers=headers,
            json={"extraction_id": ext_id, "skills": ["Python", "SQL", "Docker"], "projects": [], "education": [], "experience": []},
        )
        _, answers = _answer_all_questions(client, headers)
        assessment_id = client.post("/assessment", headers=headers, json={"answers": answers}).json()["assessment_id"]

        analyze_resp = client.post("/analyze", headers=headers, json={"extraction_id": ext_id, "assessment_id": assessment_id})
        assert analyze_resp.status_code == 200
        analysis = analyze_resp.json()
        analysis_id = analysis["analysis_id"]
        assert analysis["extraction_id"] == ext_id

        detail_resp = client.get(f"/history/{analysis_id}", headers=headers)
        assert detail_resp.status_code == 200
        assert detail_resp.json()["extraction_id"] == ext_id

        oversized = client.post(
            f"/extract/{ext_id}/ats-builder/optimize",
            headers=headers,
            json={"full_name": "Test User", "summary": "a" * 4001},
        )
        assert oversized.status_code == 400
    finally:
        if analysis_id:
            analysis_results_collection.delete_one({"analysis_id": analysis_id})
        if assessment_id:
            assessments_collection.delete_one({"assessment_id": assessment_id})
        if ext_id:
            extractions_collection.delete_one({"extraction_id": ext_id})


def test_jobs_matched_scopes_extraction_and_paginates(client):
    headers_a, uid_a, _ = _register_and_login(client, "User A")
    headers_b, uid_b, _ = _register_and_login(client, "User B")
    other_ext_id = f"ext-{uuid.uuid4().hex}"
    analysis_id = f"ana-{uuid.uuid4().hex}"
    company_id = f"comp-{uuid.uuid4().hex}"
    job_ids = [f"job-{uuid.uuid4().hex}" for _ in range(3)]
    try:
        extractions_collection.insert_one({"extraction_id": other_ext_id, "user_id": uid_a, "skills": ["Rust", "Go"]})
        analysis_results_collection.insert_one(
            {
                "analysis_id": analysis_id,
                "user_id": uid_b,
                "extraction_id": other_ext_id,  # points to User A's extraction -> must NOT leak to User B
                "skills": [],
                "strengths": [],
                "top_jobs": [],
            }
        )
        mongo_db["companies"].insert_one({"company_id": company_id, "owner_id": uid_a, "status": "approved", "name": "ScopeCo"})
        for idx, jid in enumerate(job_ids):
            recruiter_jobs_collection.insert_one(
                {
                    "job_id": jid,
                    "company_id": company_id,
                    "recruiter_id": uid_a,
                    "status": "active",
                    "title": f"Rust Engineer {idx}",
                    "company_name": "ScopeCo",
                    "required_skills": ["Rust"],
                }
            )

        resp = client.get(f"/jobs/matched?analysis_id={analysis_id}&limit=2&offset=1", headers=headers_b)
        assert resp.status_code == 200
        data = resp.json()
        assert data["limit"] == 2
        assert data["offset"] == 1
        assert len(data["jobs"]) <= 2
        # Because User B does not own other_ext_id, matched_skills must remain empty (0% match on Rust jobs)
        for job in data["jobs"]:
            if job["id"] in job_ids:
                assert job["matched_skills"] == []
    finally:
        extractions_collection.delete_one({"extraction_id": other_ext_id})
        analysis_results_collection.delete_one({"analysis_id": analysis_id})
        recruiter_jobs_collection.delete_many({"company_id": company_id})
        mongo_db["companies"].delete_one({"company_id": company_id})


def test_assessment_validation_rejects_invalid_payloads(client):
    headers, _, _ = _register_and_login(client)
    questions, valid_answers = _answer_all_questions(client, headers)

    # 1. Unknown question_id
    resp_unknown = client.post(
        "/assessment",
        headers=headers,
        json={"answers": [*valid_answers, {"question_id": "999999", "value": "x"}]},
    )
    assert resp_unknown.status_code == 400

    # 2. Missing required questions
    resp_missing = client.post("/assessment", headers=headers, json={"answers": valid_answers[:1]})
    assert resp_missing.status_code == 400

    # 3. Invalid scale values (out of range, float fraction, string, boolean, NaN)
    scale_idx = next(i for i, q in enumerate(questions) if q["type"] == "scale")
    for bad_scale in (0, 6, 3.5, "4", True):
        bad_answers = [dict(a) for a in valid_answers]
        bad_answers[scale_idx]["value"] = bad_scale
        r = client.post("/assessment", headers=headers, json={"answers": bad_answers})
        assert r.status_code in (400, 422), (bad_scale, r.text)

    bad_nan_body = json.dumps(
        {
            "answers": [
                {"question_id": a["question_id"], "value": float("nan") if i == scale_idx else a["value"]}
                for i, a in enumerate(valid_answers)
            ]
        },
        allow_nan=True,
    )
    r_nan = client.post("/assessment", headers={**headers, "Content-Type": "application/json"}, content=bad_nan_body)
    assert r_nan.status_code in (400, 422)

    # 4. Invalid option strings
    single_idx = next(i for i, q in enumerate(questions) if q["type"] == "single_choice")
    bad_single = [dict(a) for a in valid_answers]
    bad_single[single_idx]["value"] = "NonExistentOption"
    assert client.post("/assessment", headers=headers, json={"answers": bad_single}).status_code == 400

    multi_idx = next(i for i, q in enumerate(questions) if q["type"] == "multiple_choice")
    bad_multi = [dict(a) for a in valid_answers]
    bad_multi[multi_idx]["value"] = ["NotValidOption"]
    assert client.post("/assessment", headers=headers, json={"answers": bad_multi}).status_code == 400


def test_interview_evaluation_handles_malformed_llm_output(client):
    headers, uid, _ = _register_and_login(client)
    session_id = f"sess-{uuid.uuid4().hex}"
    interviews_collection = mongo_db["interviews"]
    try:
        interviews_collection.insert_one(
            {
                "session_id": session_id,
                "user_id": uid,
                "job_title": "Backend Engineer",
                "status": "in_progress",
                "messages": [
                    {"role": "assistant", "content": "Explain caching strategies."},
                    {"role": "user", "content": "We use Redis cache-aside with TTL invalidation and metrics."},
                ],
                "evaluation": None,
            }
        )
        malformed_payload = json.dumps(
            {
                "final_score": "invalid-score",
                "technical_score": "NaN",
                "communication_score": 99,
                "strengths": "Clear explanation",
                "technical_mistakes": None,
                "grammar_mistakes": [{"wrong": "He go", "fix": "He goes"}],
                "model_answers": "not a list",
                "overall_feedback": ["Good", "progress"],
            }
        )
        with patch.object(interview_service, "call_llm_messages", return_value=malformed_payload):
            resp = client.post(f"/interview/{session_id}/evaluate", headers=headers)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert 0 <= body["final_score"] <= 10
        assert 0 <= body["technical_score"] <= 10
        assert body["communication_score"] == 10
        assert body["strengths"] == ["Clear explanation"]
        assert body["grammar_mistakes"] == ["He go -> He goes"]
        assert len(body["model_answers"]) >= 1
        assert body["overall_feedback"] == "Good progress"
    finally:
        interviews_collection.delete_one({"session_id": session_id})


def test_recruiter_discovery_scoring_dedup_and_pipeline_isolation(client):
    rec_headers, rec_uid, _ = _register_and_login(client, "Recruiter")
    c1_headers, c1_uid, _ = _register_and_login(client, "Candidate One")
    c2_headers, c2_uid, _ = _register_and_login(client, "Candidate Two")
    company_id = f"comp-{uuid.uuid4().hex}"
    created_ext_ids = []
    job1_id = None
    job2_id = None
    try:
        # Set real target_role on Candidate One via /profile and create real analysis_results entry
        client.put("/profile", headers=c1_headers, json={"full_name": "Candidate One", "target_role": "Platform Engineer"})
        client.put("/settings/recruiter-consent", headers=c1_headers, json={"opted_in": True})
        client.put("/settings/recruiter-consent", headers=c2_headers, json={"opted_in": True})

        mongo_db["companies"].insert_one(
            {"company_id": company_id, "name": "RecTest", "owner_id": rec_uid, "status": "approved"}
        )

        # Insert Candidate One first (older _id), then >200 docs for Candidate Two so >200 pre-dedup limit would have hidden C1
        c1_ext = f"ext-c1-{uuid.uuid4().hex}"
        created_ext_ids.append(c1_ext)
        extractions_collection.insert_one(
            {
                "extraction_id": c1_ext,
                "user_id": c1_uid,
                "skills": ["Python", "SQL"],
                "experience": [
                    {"title": "Dev", "company": "Co", "duration_months": 18},
                    {"title": "Senior", "company": "Co2", "duration_months": 6},
                ],
                "projects": [],
                "education": [],
            }
        )
        analysis_results_collection.insert_one({"analysis_id": f"ana-{uuid.uuid4().hex}", "user_id": c1_uid, "career_score": 72.5})

        bulk_docs = []
        for idx in range(205):
            eid = f"ext-c2-{idx}-{uuid.uuid4().hex[:6]}"
            created_ext_ids.append(eid)
            bulk_docs.append({"extraction_id": eid, "user_id": c2_uid, "skills": ["Python"], "experience": []})
        extractions_collection.insert_many(bulk_docs)
        c2_mongo_id = str(extractions_collection.find_one({"extraction_id": created_ext_ids[-1]})["_id"])

        # Job 1 has empty bonus_skills -> 100% required match MUST score 100%, not 80%
        job1_id = client.post(
            "/recruiter/jobs",
            headers=rec_headers,
            json={"title": "Python Core", "required_skills": ["Python", "SQL"], "bonus_skills": [], "description": "Core"},
        ).json()["job_id"]
        job2_id = client.post(
            "/recruiter/jobs",
            headers=rec_headers,
            json={"title": "Python Second", "required_skills": ["Python"], "bonus_skills": [], "description": "Second"},
        ).json()["job_id"]

        listed = client.get(f"/recruiter/jobs/{job1_id}/candidates", headers=rec_headers)
        assert listed.status_code == 200, listed.text
        cands = listed.json()["candidates"]
        c1_item = next((c for c in cands if c["candidate_id"] == c1_ext), None)
        c2_item = next((c for c in cands if c["user_id"] == c2_uid), None)
        assert c1_item is not None, "Candidate One should not be truncated behind 200 duplicate extractions"
        assert c2_item is not None
        assert c1_item["match_percentage"] == 100
        assert c1_item["target_role"] == "Platform Engineer"
        assert c1_item["ats_score"] is None
        assert c1_item["career_score"] == 72.5
        assert "2 سنوات خبرة" in c1_item["experience_years_summary"]
        assert c2_item["target_role"] is None
        assert c2_item["ats_score"] is None
        assert c2_item["career_score"] is None

        # ObjectId fallback in status update + per-job isolation
        status_resp = client.post(
            f"/recruiter/jobs/{job1_id}/candidates/{c2_mongo_id}/status",
            headers=rec_headers,
            json={"pipeline_status": "shortlisted", "notes": "job1 note"},
        )
        assert status_resp.status_code == 200

        c1_status_j1 = client.post(
            f"/recruiter/jobs/{job1_id}/candidates/{c1_ext}/status",
            headers=rec_headers,
            json={"pipeline_status": "interviewed", "notes": "only job1"},
        )
        assert c1_status_j1.status_code == 200

        prof_j1 = client.get(f"/recruiter/candidates/{c1_ext}/profile?job_id={job1_id}", headers=rec_headers).json()
        prof_j2 = client.get(f"/recruiter/candidates/{c1_ext}/profile?job_id={job2_id}", headers=rec_headers).json()
        assert prof_j1["pipeline_status"] == "interviewed"
        assert prof_j1["notes"] == "only job1"
        assert prof_j2["pipeline_status"] == "discovered"
        assert prof_j2["notes"] == ""
    finally:
        if created_ext_ids:
            extractions_collection.delete_many({"extraction_id": {"$in": created_ext_ids}})
        analysis_results_collection.delete_many({"user_id": {"$in": [c1_uid, c2_uid]}})
        recruitment_pipeline_collection.delete_many({"company_id": company_id})
        recruiter_jobs_collection.delete_many({"company_id": company_id})
        mongo_db["companies"].delete_one({"company_id": company_id})
        mongo_db["recruiter_consent"].delete_many({"_id": {"$in": [c1_uid, c2_uid]}})


def test_async_cv_eager_failure_no_double_execution(client):
    headers, uid, _ = _register_and_login(client)
    file_id = f"file-{uuid.uuid4().hex}"
    uploads_collection.insert_one({"file_id": file_id, "user_id": uid, "path": "missing.pdf"})
    try:
        with patch("app.worker.tasks.extract_cv_data", side_effect=RuntimeError("corrupt pdf")) as mock_extract:
            resp = client.post("/extract/async", headers=headers, json={"file_id": file_id})
        assert resp.status_code == 200, resp.text
        assert mock_extract.call_count == 1
        data = resp.json()
        assert data["status"] == "failed"
        status_resp = client.get(f"/cv/status/{data['task_id']}", headers=headers)
        assert status_resp.status_code == 200
        assert status_resp.json()["status"] == "failed"
    finally:
        uploads_collection.delete_one({"file_id": file_id})
        cv_tasks_collection.delete_many({"user_id": uid})


def test_security_non_int_sub_pdf_rtl_urls_and_health_degraded(client):
    # 1. Non-integer JWT sub must return 401 cleanly
    bad_token = create_access_token(subject="not-an-integer")
    assert client.get("/profile", headers={"Authorization": f"Bearer {bad_token}"}).status_code == 401

    # 2. rtl() escapes XML entities AFTER bidi reordering and builds PDF cleanly even when Arabic is only in experience
    escaped_visual = rtl("مرحبا <b>عالم & اختبار</b>")
    assert "<" not in escaped_visual and ">" not in escaped_visual
    assert "&lt;" in escaped_visual and "&gt;" in escaped_visual and "&amp;" in escaped_visual

    pdf_bytes = build_ats_resume_pdf(
        {
            "full_name": "Sara Ali",
            "target_role": "Software Engineer",
            "summary": "Experienced engineer <script> & backend developer.",
            "skills": ["Python & FastAPI", "C++"],
            "experience": [{"title": "مهندس برمجيات", "company": "شركة", "duration_months": 12, "description": "تطوير <API> & نظم"}],
            "projects": [],
            "education": [],
        }
    )
    assert pdf_bytes.startswith(b"%PDF")

    # 3. URL encoding for special characters like C++ / C#
    with SessionLocal() as db:
        courses = match_courses_to_skills({"critical": ["C++", "C#"], "recommended": [], "nice_to_have": []}, db=db)
    urls = [c["url"] for c in courses]
    assert any("C%2B%2B" in u for u in urls)
    assert any("C%23" in u for u in urls)

    # 4. Blocking upload/voice endpoints run as sync threadpool handlers, not blocking async def
    from app.api.routes import cv as cv_routes
    from app.api.routes import interview as interview_routes

    assert not inspect.iscoroutinefunction(cv_routes.upload_cv)
    assert not inspect.iscoroutinefunction(interview_routes.voice_interview_turn)

    # 5. Extension match_score allows full 100 (not capped at 98)
    ext_headers, ext_uid, _ = _register_and_login(client, "Ext Perfect Match")
    ext_doc_id = f"ext-perf-{uuid.uuid4().hex}"
    extractions_collection.insert_one({"extraction_id": ext_doc_id, "user_id": ext_uid, "skills": ["Python", "FastAPI"]})
    try:
        ext_resp = client.post(
            "/extension/match-job",
            headers=ext_headers,
            json={
                "job_title": "Python FastAPI Dev",
                "job_description": "Need Python and FastAPI.",
                "extracted_skills": ["Python", "FastAPI"],
            },
        )
        assert ext_resp.status_code == 200
        assert ext_resp.json()["match_score"] == 100
    finally:
        extractions_collection.delete_one({"extraction_id": ext_doc_id})

    # 6. /health returns 503 when a dependency fails
    with patch("app.main.mongo_db.list_collection_names", side_effect=RuntimeError("mongo down")):
        health_resp = client.get("/health")
    assert health_resp.status_code == 503
    assert health_resp.json()["status"] == "degraded"
    assert health_resp.json()["checks"]["mongo"] == "degraded"


def test_reset_password_does_not_mask_db_errors(client):
    _, uid, _ = _register_and_login(client)
    with SessionLocal() as db:
        user = db.query(User).filter(User.id == uid).first()
        token = create_reset_token(str(uid), user.hashed_password)

    with patch("sqlalchemy.orm.Session.query", side_effect=OperationalError("stmt", {}, RuntimeError("db down"))):
        with pytest.raises(OperationalError):
            client.post("/reset-password", json={"token": token, "new_password": "NewPassword456"})


def test_recruiter_switch_role_validation(client):
    headers, uid, _ = _register_and_login(client, "Role Switcher")
    try:
        bad = client.post("/recruiter/switch-role", headers=headers, json={"company_name": "   "})
        assert bad.status_code == 400
        ok = client.post("/recruiter/switch-role", headers=headers, json={"company_name": "Valid Corp"})
        assert ok.status_code == 200
        assert ok.json()["role"] == "candidate"
        assert ok.json()["company_name"] == "Valid Corp"
        assert mongo_db["companies"].find_one({"owner_id": uid, "name": "Valid Corp", "status": "pending"}) is not None
    finally:
        mongo_db["companies"].delete_many({"owner_id": uid})
