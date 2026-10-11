from fastapi.testclient import TestClient
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

client = TestClient(app)


async def override_get_current_user():
    user = User(id=1, email="test@example.com")
    return user


from app.core.security import get_current_user

app.dependency_overrides[get_current_user] = override_get_current_user


def test_new_endpoints():
    analysis_id = "test-analysis-" + str(uuid.uuid4())
    extraction_id = "test-extract-" + str(uuid.uuid4())

    mongo_db["analysis_results"].insert_one(
        {
            "analysis_id": analysis_id,
            "user_id": 1,
            "skills": ["Python", "SQL", "Git", "API Design", "Docker"],
            "job_match": {"top_job": "Backend Developer"},
            "created_at": datetime.datetime.now(datetime.timezone.utc),
        }
    )

    mongo_db["extractions"].insert_one(
        {
            "extraction_id": extraction_id,
            "user_id": 1,
            "file_id": "file123",
        }
    )

    mongo_db["uploads"].insert_one(
        {
            "file_id": "file123",
            "user_id": 1,
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
    with patch("ollama.chat") as mock_ollama:
        mock_ollama.return_value = {"message": {"content": "Hello, let's start."}}
        from app.core.config import settings

        settings.OPENAI_API_KEY = ""
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
    with patch("ollama.chat") as mock_ollama:
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

    print("Testing Interview Evaluation Endpoint (Epic 4)...")
    with patch("ollama.chat") as mock_ollama:
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

    print("All tests passed successfully! 🚀")


test_new_endpoints()