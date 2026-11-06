import uuid

from app.core.mongo import extractions_collection, mongo_db


def test_recruiter_access_requires_revocable_candidate_consent(client, registered_user_token):
    token, _ = registered_user_token
    candidate = {"Authorization": f"Bearer {token}"}
    profile = client.get("/profile", headers=candidate).json()
    user_id = int(profile["id"])
    extraction_id = str(uuid.uuid4())
    extractions_collection.insert_one({
        "extraction_id": extraction_id, "user_id": user_id,
        "skills": ["Python"], "experience": [], "projects": [], "education": [],
    })
    email = f"recruiter-{uuid.uuid4().hex}@example.com"
    client.post("/register", json={"full_name": "Recruiter", "email": email, "password": "Passw0rd123"})
    recruiter_token = client.post("/login", json={"email": email, "password": "Passw0rd123"}).json()["access_token"]
    recruiter = {"Authorization": f"Bearer {recruiter_token}"}
    uid = int(client.get("/profile", headers=recruiter).json()["id"])
    mongo_db["companies"].insert_one({"company_id": str(uuid.uuid4()), "name": "Test company", "owner_id": uid, "status": "approved"})
    job_id = client.post("/recruiter/jobs", headers=recruiter, json={"title": "Developer", "required_skills": ["Python"]}).json()["job_id"]
    listing = f"/recruiter/jobs/{job_id}/candidates"
    detail = f"/recruiter/candidates/{extraction_id}/profile"
    status = f"{listing}/{extraction_id}/status"

    def visible():
        return extraction_id in [item["candidate_id"] for item in client.get(listing, headers=recruiter).json()["candidates"]]

    assert client.put("/settings/recruiter-consent", json={"opted_in": True}).status_code == 401
    assert client.get("/settings/recruiter-consent", headers=candidate).json() == {"opted_in": False}
    assert not visible()
    assert client.get(detail, headers=recruiter).status_code == 404
    assert client.post(status, headers=recruiter, json={"pipeline_status": "shortlisted"}).status_code == 404
    assert client.put("/settings/recruiter-consent", headers=candidate, json={"opted_in": True}).status_code == 200
    assert visible()
    assert client.get(detail, headers=recruiter).status_code == 200
    assert client.post(status, headers=recruiter, json={"pipeline_status": "shortlisted"}).status_code == 200
    assert client.put("/settings/recruiter-consent", headers=candidate, json={"opted_in": False}).status_code == 200
    assert not visible()
    assert client.get(detail, headers=recruiter).status_code == 404
    assert client.post(status, headers=recruiter, json={"pipeline_status": "contacted"}).status_code == 404
    assert mongo_db["recruiter_consent"].find_one({"_id": user_id}) is None
    client.put("/settings/recruiter-consent", headers=candidate, json={"opted_in": True})
    assert client.delete("/profile", headers=candidate).status_code == 200
    assert mongo_db["recruiter_consent"].find_one({"_id": user_id}) is None
