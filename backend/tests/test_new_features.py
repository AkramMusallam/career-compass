from fastapi.testclient import TestClient
from app.main import app
from app.core.mongo import mongo_db
from unittest.mock import patch
from app.models.mysql_models import User
import uuid
import datetime

client = TestClient(app)

async def override_get_current_user():
    user = User(id=1, email="test@example.com")
    return user

from app.core.security import get_current_user
app.dependency_overrides[get_current_user] = override_get_current_user

def test_new_endpoints():
    analysis_id = "test-analysis-" + str(uuid.uuid4())
    extraction_id = "test-extract-" + str(uuid.uuid4())
    
    mongo_db["analysis_results"].insert_one({
        "analysis_id": analysis_id,
        "user_id": 1,
        "skills": ["Python", "React", "FastAPI"],
        "created_at": datetime.datetime.now(datetime.timezone.utc)
    })
    
    mongo_db["extractions"].insert_one({
        "extraction_id": extraction_id,
        "user_id": 1,
        "file_id": "file123"
    })
    
    mongo_db["uploads"].insert_one({
        "file_id": "file123",
        "user_id": 1,
        "path": "dummy_path.pdf"
    })
    
    print("Testing ATS Score Endpoint...")
    with patch("app.api.routes.cv.evaluate_ats_score") as mock_ats:
        mock_ats.return_value = {"score": 85, "feedback": ["Great skills"]}
        resp = client.get(f"/extract/{extraction_id}/ats-score")
        assert resp.status_code == 200, resp.text
        
    print("Testing Cover Letter Endpoint...")
    with patch("app.api.routes.cv.generate_cover_letter") as mock_cv:
        mock_cv.return_value = "Dear Hiring Manager, I am a great fit."
        resp = client.post(f"/extract/{extraction_id}/cover-letter", json={"job_description": "We need a Python developer."})
        assert resp.status_code == 200, resp.text
        
    print("Testing Interview Endpoint...")
    with patch("ollama.chat") as mock_ollama:
        mock_ollama.return_value = {"message": {"content": "Hello, let's start."}}
        from app.core.config import settings
        settings.OPENAI_API_KEY = ""
        resp = client.post("/interview/start", json={"analysis_id": analysis_id, "job_title": "Backend Developer"})
        assert resp.status_code == 200, resp.text
        
    print("All new endpoints passed successfully! 🚀")

test_new_endpoints()