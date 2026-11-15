import json
import uuid
from unittest.mock import MagicMock, patch

from app.core.mongo import analysis_results_collection, mongo_db, recruiter_jobs_collection
from app.core.security import decode_access_token
from app.services.live_jobs_service import (
    _extract_job_skills,
    fetch_live_external_jobs,
    sanitize_external_url,
)


def test_sanitize_external_url_blocks_unsafe_and_private_targets():
    assert sanitize_external_url("https://remotive.com/remote-jobs/python-dev") == "https://remotive.com/remote-jobs/python-dev"
    assert sanitize_external_url("http://jobs.example.com/1") == "http://jobs.example.com/1"
    assert sanitize_external_url("javascript:alert(1)") is None
    assert sanitize_external_url("data:text/html,<script>alert(1)</script>") is None
    assert sanitize_external_url("http://127.0.0.1:8000/secret") is None
    assert sanitize_external_url("http://169.254.169.254/latest/meta-data") is None
    assert sanitize_external_url("https://user:pass@example.com/jobs") is None
    assert sanitize_external_url("http://localhost/admin") is None


def test_extract_job_skills_combines_tags_and_description():
    skills = _extract_job_skills(
        ["python", "FastAPI"],
        "Senior Backend Engineer (Docker & PostgreSQL)",
        "Experience building microservices with Redis caching and REST API design.",
    )
    lowered = {s.lower() for s in skills}
    assert {"python", "fastapi", "docker", "postgresql", "redis", "rest api"}.issubset(lowered)


def test_fetch_live_external_jobs_aggregates_caches_and_isolates_failures():
    mongo_db["external_jobs_cache"].delete_many({})
    remotive_resp = MagicMock()
    remotive_resp.raise_for_status = MagicMock()
    remotive_resp.json.return_value = {
        "jobs": [
            {
                "id": 101,
                "title": "Backend Python Developer",
                "company_name": "CloudCo",
                "candidate_required_location": "Remote",
                "job_type": "full_time",
                "salary": "$3,000 - $4,500",
                "description": "<p>Build FastAPI and Docker services.</p>",
                "url": "https://remotive.com/jobs/101",
                "publication_date": "2026-11-10T10:00:00",
                "tags": ["Python", "FastAPI"],
            },
            {
                "id": 102,
                "title": "Malicious Job",
                "company_name": "BadCo",
                "description": "XSS link",
                "url": "javascript:alert(1)",
                "tags": ["Python"],
            },
        ]
    }

    arbeitnow_err = RuntimeError("timeout")

    def fake_get(url, timeout=5.0):
        if "remotive.com" in url:
            return remotive_resp
        raise arbeitnow_err

    try:
        with patch("app.services.live_jobs_service.httpx.get", side_effect=fake_get), \
             patch("app.services.live_jobs_service._read_cached_feed", return_value=None) as _mock_read, \
             patch("app.services.live_jobs_service._write_cached_feed") as mock_write:
            jobs = fetch_live_external_jobs("Backend Developer")
            assert len(jobs) == 1
            assert jobs[0]["id"] == "remotive-101"
            assert jobs[0]["source"] == "external"
            assert jobs[0]["source_name"] == "Remotive"
            assert jobs[0]["apply_url"] == "https://remotive.com/jobs/101"
            assert "<p>" not in jobs[0]["description"]
            assert mock_write.called
    finally:
        mongo_db["external_jobs_cache"].delete_many({})


def test_matched_jobs_endpoint_filters_internal_and_external_sources(client, registered_user_token):
    token, _ = registered_user_token
    headers = {"Authorization": f"Bearer {token}"}
    user_id = int(decode_access_token(token)["sub"])

    analysis_id = f"ana-{uuid.uuid4().hex[:8]}"
    company_id = f"comp-{uuid.uuid4().hex[:8]}"
    job_id = f"job-{uuid.uuid4().hex[:8]}"

    analysis_results_collection.insert_one(
        {
            "analysis_id": analysis_id,
            "user_id": user_id,
            "target_role": "Backend Developer",
            "skills": ["Python", "FastAPI", "Docker"],
            "strengths": [],
            "top_jobs": [],
        }
    )
    mongo_db["companies"].insert_one(
        {"company_id": company_id, "owner_id": user_id, "status": "approved", "name": "LocalTech"}
    )
    recruiter_jobs_collection.insert_one(
        {
            "job_id": job_id,
            "company_id": company_id,
            "recruiter_id": user_id,
            "status": "active",
            "title": "Internal Python Engineer",
            "company_name": "LocalTech",
            "required_skills": ["Python", "FastAPI"],
            "bonus_skills": ["Docker"],
        }
    )

    fake_external = [
        {
            "id": "remotive-777",
            "title": "Remote Python API Developer",
            "company": "GlobalRemote",
            "company_url": "https://remotive.com/jobs/777",
            "location": "Remote",
            "type": "Full-time",
            "experience_level": "Mid",
            "salary_range": "$3,500",
            "description": "FastAPI & Docker remote role",
            "apply_url": "https://remotive.com/jobs/777",
            "posted_date": "2026-11-12",
            "required_skills": ["Python", "Docker"],
            "bonus_skills": [],
            "source": "external",
            "source_name": "Remotive",
        }
    ]

    try:
        with patch("app.api.routes.jobs_router.fetch_live_external_jobs", return_value=fake_external):
            res_all = client.get(f"/jobs/matched?analysis_id={analysis_id}&source=all", headers=headers)
            assert res_all.status_code == 200
            all_jobs = res_all.json()["jobs"]
            assert any(j["id"] == job_id and j["source"] == "internal" for j in all_jobs)
            assert any(j["id"] == "remotive-777" and j["source"] == "external" for j in all_jobs)

            res_int = client.get(f"/jobs/matched?analysis_id={analysis_id}&source=internal", headers=headers)
            assert res_int.status_code == 200
            int_jobs = res_int.json()["jobs"]
            assert all(j["source"] == "internal" for j in int_jobs)
            assert any(j["id"] == job_id for j in int_jobs)

            res_ext = client.get(f"/jobs/matched?analysis_id={analysis_id}&source=external", headers=headers)
            assert res_ext.status_code == 200
            ext_jobs = res_ext.json()["jobs"]
            assert len(ext_jobs) == 1
            assert ext_jobs[0]["id"] == "remotive-777"
            assert ext_jobs[0]["apply_url"] == "https://remotive.com/jobs/777"
    finally:
        analysis_results_collection.delete_one({"analysis_id": analysis_id})
        recruiter_jobs_collection.delete_one({"job_id": job_id})
        mongo_db["companies"].delete_one({"company_id": company_id})
