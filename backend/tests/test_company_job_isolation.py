import uuid

from app.core.mongo import mongo_db
from app.core.security import decode_access_token


def account(client):
    email = f"team-{uuid.uuid4().hex}@example.com"
    client.post("/register", json={"full_name": "Team member", "email": email, "password": "Passw0rd123"})
    token = client.post("/login", json={"email": email, "password": "Passw0rd123"}).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}, int(decode_access_token(token)["sub"])


def test_company_job_and_pipeline_isolation(client):
    owner, owner_id = account(client)
    member, member_id = account(client)
    other, other_id = account(client)
    candidate, candidate_user_id = account(client)
    company_id, other_id_company = uuid.uuid4().hex, uuid.uuid4().hex
    companies = mongo_db["companies"]
    companies.insert_many([
        {"company_id": company_id, "name": "First", "owner_id": owner_id, "members": [member_id], "status": "approved"},
        {"company_id": other_id_company, "name": "Second", "owner_id": other_id, "status": "approved"},
    ])
    extraction_id = uuid.uuid4().hex
    mongo_db["extractions"].insert_one({"extraction_id": extraction_id, "user_id": candidate_user_id, "skills": ["Python"]})
    mongo_db["recruiter_consent"].insert_one({"_id": candidate_user_id})
    job_id = None
    try:
        members = client.get(f"/companies/{company_id}/members", headers=owner)
        assert members.status_code == 200
        assert [member["id"] for member in members.json()] == [member_id]
        assert members.json()[0]["full_name"] == "Team member"
        assert client.get(f"/companies/{company_id}/members", headers=other).status_code == 404
        assert client.get(f"/companies/{company_id}/members", headers=member).status_code == 404
        created = client.post("/recruiter/jobs", headers=owner, json={"title": "Engineer", "description": "Work"})
        assert created.status_code == 201, created.text
        job_id = created.json()["job_id"]
        assert [job["job_id"] for job in client.get("/recruiter/jobs", headers=member).json()] == [job_id]
        assert client.get(f"/recruiter/jobs/{job_id}", headers=other).status_code == 404
        assert client.put(f"/recruiter/jobs/{job_id}", headers=other, json={"title": "Changed"}).status_code == 404
        assert client.delete(f"/recruiter/jobs/{job_id}", headers=other).status_code == 404
        forged = {**other, "X-Company-Id": company_id}
        assert client.get("/recruiter/jobs", headers=forged).status_code == 403
        status = client.post(f"/recruiter/jobs/{job_id}/candidates/{extraction_id}/status", headers=member,
                             json={"pipeline_status": "shortlisted", "notes": "private note"})
        assert status.status_code == 200, status.text
        assert client.get(f"/recruiter/candidates/{extraction_id}/profile", headers=owner).json()["notes"] == "private note"
        assert client.get(f"/recruiter/candidates/{extraction_id}/profile", headers=other).json()["notes"] == ""
        assert client.delete("/profile", headers=owner).status_code == 409
        assert client.delete(f"/companies/{company_id}/members/{member_id}", headers=other).status_code == 404
        assert client.delete(f"/companies/{company_id}/members/{member_id}", headers=owner).status_code == 200
        assert client.get(f"/companies/{company_id}/members", headers=owner).json() == []
        assert client.get("/recruiter/jobs", headers=member).status_code == 403
        companies.update_one({"company_id": company_id}, {"$addToSet": {"members": member_id}})
        assert client.delete("/profile", headers=member).status_code == 200
        assert client.get(f"/recruiter/jobs/{job_id}", headers=owner).status_code == 200
        assert client.get(f"/recruiter/candidates/{extraction_id}/profile", headers=owner).json()["notes"] == "private note"
        companies.update_one({"company_id": company_id}, {"$set": {"status": "suspended"}})
        assert client.get("/recruiter/jobs", headers=owner).status_code == 403
    finally:
        companies.delete_many({"company_id": {"$in": [company_id, other_id_company]}})
        mongo_db["recruiter_jobs"].delete_many({"company_id": company_id})
        if job_id:
            mongo_db["recruitment_pipeline"].delete_many({"job_id": job_id})
        mongo_db["extractions"].delete_one({"extraction_id": extraction_id})
        mongo_db["recruiter_consent"].delete_one({"_id": candidate_user_id})
