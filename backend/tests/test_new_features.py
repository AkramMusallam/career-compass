from fastapi.testclient import TestClient
import pytest
from app.main import app
from app.core.mongo import mongo_db
from unittest.mock import patch
from app.models.mysql_models import User
import uuid
import datetime
from app.services.cv_extraction import (
    is_linkedin_profile,
    extract_linkedin_top_skills,
    ExtractedCVData,
)
from app.services.recommendation_engine import match_candidate_to_job_postings
from app.core.security import get_current_user

# Dedicated id so the fake user's Mongo docs never mix with users created by other tests.
FAKE_USER_ID = 987654


async def override_get_current_user():
    user = User(id=FAKE_USER_ID, email="test@example.com", full_name="Test User")
    return user


@pytest.fixture()
def client():
    """Override auth only for the duration of this test, then restore the real dependency."""
    from app.core.config import settings

    app.dependency_overrides[get_current_user] = override_get_current_user
    try:
        # Force the Ollama code path (mocked below) without leaking the change to other tests.
        with patch.object(settings, "OPENAI_API_KEY", ""), TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        for coll in ("analysis_results", "extractions", "uploads", "interviews", "interview_sessions"):
            mongo_db[coll].delete_many({"user_id": FAKE_USER_ID})


def test_new_endpoints(client):
    analysis_id = "test-analysis-" + str(uuid.uuid4())
    extraction_id = "test-extract-" + str(uuid.uuid4())

    mongo_db["analysis_results"].insert_one(
        {
            "analysis_id": analysis_id,
            "user_id": FAKE_USER_ID,
            "skills": ["Python", "SQL", "Git", "API Design", "Docker"],
            "job_match": {"top_job": "Backend Developer"},
            "created_at": datetime.datetime.now(datetime.timezone.utc),
        }
    )

    mongo_db["extractions"].insert_one(
        {
            "extraction_id": extraction_id,
            "user_id": FAKE_USER_ID,
            "file_id": "file123",
        }
    )

    mongo_db["uploads"].insert_one(
        {
            "file_id": "file123",
            "user_id": FAKE_USER_ID,
            "path": "dummy_path.pdf",
        }
    )

    print("Testing ATS Score Endpoint...")
    with patch("app.api.routes.cv.evaluate_ats_score") as mock_ats:
        mock_ats.return_value = {"score": 85, "feedback": ["Great skills"]}
        resp = client.get(f"/extract/{extraction_id}/ats-score")
        assert resp.status_code == 200, resp.text

    print("Testing Cover Letter Endpoint...")
    with patch("app.api.routes.cv.generate_cover_letter") as mock_cv:
        mock_cv.return_value = "Dear Hiring Manager, I am a great fit."
        resp = client.post(
            f"/extract/{extraction_id}/cover-letter",
            json={"job_description": "We need a Python developer."},
        )
        assert resp.status_code == 200, resp.text

    print("Testing Interview Start Endpoint...")
    session_id = None
    with patch("ollama.Client.chat") as mock_ollama:
        mock_ollama.return_value = {"message": {"content": "Hello, let's start."}}
        resp = client.post(
            "/interview/start",
            json={"analysis_id": analysis_id, "job_title": "Backend Developer"},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert "session_id" in data
        session_id = data["session_id"]

    print("Testing Interview Get Session Endpoint...")
    resp = client.get(f"/interview/{session_id}")
    assert resp.status_code == 200, resp.text
    session_data = resp.json()
    assert session_data["session_id"] == session_id
    assert session_data["status"] == "in_progress"

    print("Testing Interview Chat Turn...")
    with patch("ollama.Client.chat") as mock_ollama:
        mock_ollama.return_value = {
            "message": {"content": "Great! Next question: how do you design scalable APIs?"}
        }
        resp = client.post(
            "/interview/chat",
            json={
                "session_id": session_id,
                "message": "I have built REST APIs with FastAPI and background Celery workers.",
            },
        )
        assert resp.status_code == 200, resp.text

    print("Testing Voice & Audio Mock Interview Endpoint (Section 7.1)...")
    voice_resp = client.post(
        f"/interview/{session_id}/voice",
        data={
            "duration_seconds": "8.5",
            "transcript_hint": "I have designed distributed systems using Python and FastAPI with asynchronous workers and Redis caching.",
        },
    )
    assert voice_resp.status_code == 200, voice_resp.text
    voice_data = voice_resp.json()
    assert voice_data["session_id"] == session_id
    assert "voice_feedback" in voice_data
    assert voice_data["voice_feedback"]["clarity_score"] >= 6
    assert voice_data["voice_feedback"]["confidence_score"] >= 5
    assert voice_data["voice_feedback"]["words_per_minute"] > 0
    assert "FastAPI" in voice_data["transcript"]

    print("Testing Interview Evaluation Endpoint (Epic 4)...")
    with patch("ollama.Client.chat") as mock_ollama:
        mock_eval_json = '{"final_score": 8, "technical_score": 8, "communication_score": 9, "strengths": ["Clear communication"], "technical_mistakes": ["Omitted indexing"], "grammar_mistakes": [], "model_answers": [{"question": "Scalable APIs?", "model_answer": "Use caching, indexing, and connection pools."}], "overall_feedback": "Solid performance."}'
        mock_ollama.return_value = {"message": {"content": mock_eval_json}}
        resp = client.post(f"/interview/{session_id}/evaluate")
        assert resp.status_code == 200, resp.text
        eval_result = resp.json()
        assert eval_result["final_score"] == 8
        assert eval_result["technical_score"] == 8
        assert len(eval_result["strengths"]) >= 1

    print("Testing LinkedIn Profile Detection (Epic 6)...")
    linkedin_sample = """
    Jane Smith
    Software Engineer at TechCorp
    Contact
    www.linkedin.com/in/janesmith (LinkedIn)
    Top Skills
    Python
    FastAPI
    PostgreSQL
    
    Experience
    TechCorp
    Backend Developer
    2022 - Present
    
    Education
    MIT
    BS Computer Science
    """
    assert is_linkedin_profile(linkedin_sample) is True
    top_skills = extract_linkedin_top_skills(linkedin_sample)
    assert "Python" in top_skills
    assert "FastAPI" in top_skills

    print("Testing Real Job Matching Engine (Feature 6.5)...")
    matched_jobs = match_candidate_to_job_postings(
        candidate_skills=["Python", "SQL", "Git", "API Design", "Docker"],
        target_role="Backend Developer",
    )
    assert len(matched_jobs) > 0
    top_match = matched_jobs[0]
    assert top_match["match_percentage"] >= 60.0
    assert "Python" in top_match["matched_skills"]
    assert top_match["apply_url"].startswith("http")

    print("Testing GET /jobs/matched API Endpoint...")
    resp = client.get(f"/jobs/matched?analysis_id={analysis_id}")
    assert resp.status_code == 200, resp.text
    api_jobs_data = resp.json()
    assert api_jobs_data["total"] > 0
    assert len(api_jobs_data["jobs"]) == api_jobs_data["total"]
    assert "apply_url" in api_jobs_data["jobs"][0]

    print("Testing Celery Asynchronous PDF Worker (Section 7.1)...")
    with patch("app.worker.tasks.extract_cv_data") as mock_extract:
        mock_extract.return_value = ExtractedCVData(
            skills=["Python", "FastAPI", "Docker"],
            projects=[],
            education=[],
            experience=[],
            is_linkedin=False,
        )
        resp = client.post("/extract/async", json={"file_id": "file123"})
        assert resp.status_code == 200, resp.text
        task_data = resp.json()
        assert "task_id" in task_data
        async_task_id = task_data["task_id"]

        status_resp = client.get(f"/cv/status/{async_task_id}")
        assert status_resp.status_code == 200, status_resp.text
        status_data = status_resp.json()
        assert status_data["task_id"] == async_task_id
        assert status_data["status"] == "completed"
        assert status_data["result"] is not None
        assert "Python" in status_data["result"]["skills"]

    print("Testing Full ATS CV Builder & Exporter (Section 7.1)...")
    optimize_resp = client.post(
        f"/extract/{extraction_id}/ats-builder/optimize",
        json={
            "full_name": "Test Candidate",
            "target_role": "Backend Engineer",
            "skills": ["Python", "FastAPI", "PostgreSQL", "Docker", "Redis"],
        },
    )
    assert optimize_resp.status_code == 200, optimize_resp.text
    opt_data = optimize_resp.json()
    assert opt_data["full_name"] == "Test Candidate"
    assert opt_data["target_role"] == "Backend Engineer"
    assert len(opt_data["summary"]) > 20
    assert "Python" in opt_data["skills"]

    export_resp = client.post(
        f"/extract/{extraction_id}/export-ats-pdf",
        json={
            "full_name": "Test Candidate",
            "target_role": "Backend Engineer",
            "summary": "Experienced engineer with a focus on high-throughput REST APIs.",
            "skills": ["Python", "Docker"],
            "experience": [
                {
                    "title": "Software Engineer",
                    "company": "Tech Corp",
                    "duration_months": 24,
                    "description": "Architected microservices with FastAPI.",
                }
            ],
        },
    )
    assert export_resp.status_code == 200, export_resp.text
    assert export_resp.headers["content-type"] == "application/pdf"
    assert export_resp.content.startswith(b"%PDF")

    print("All tests passed successfully! 🚀")