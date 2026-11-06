from app.core.mongo import mongo_db


def test_recruiter_request_requires_admin_approval(client, registered_user_token):
    token, _ = registered_user_token
    headers = {"Authorization": f"Bearer {token}"}
    uid = int(client.get("/profile", headers=headers).json()["id"])
    job = {"title": "Backend", "required_skills": ["Python"]}
    assert client.get("/recruiter/jobs", headers=headers).status_code == 403
    assert client.post("/recruiter/jobs", headers=headers, json=job).status_code == 403
    assert client.post("/recruiter/switch-role", headers=headers, json={"company_name": "Example"}).status_code == 200
    approval = client.get("/recruiter/approval", headers=headers).json()
    assert approval["approved"] is False and approval["requested"] is True
    assert client.post("/recruiter/jobs", headers=headers, json=job).status_code == 403
    mongo_db["companies"].update_one({"owner_id": uid}, {"$set": {"status": "approved"}})
    assert client.post("/recruiter/jobs", headers=headers, json=job).status_code == 201
    assert client.get("/recruiter/jobs", headers=headers).status_code == 200
    mongo_db["companies"].update_one({"owner_id": uid}, {"$set": {"status": "suspended"}})
    assert client.post("/recruiter/jobs", headers=headers, json=job).status_code == 403
    assert client.get("/recruiter/jobs", headers=headers).status_code == 403
