from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.core.mongo import mongo_db
from app.core.security import decode_access_token


def test_support_requires_owner_grant_and_records_access(client, registered_user_token):
    candidate_token, _ = registered_user_token
    candidate_headers = {"Authorization": f"Bearer {candidate_token}"}
    candidate_id = int(decode_access_token(candidate_token)["sub"])
    email = f"support-{uuid4().hex}@example.com"
    client.post("/register", json={"full_name": "Platform owner", "email": email, "password": "Passw0rd123"})
    owner_token = client.post("/login", json={"email": email, "password": "Passw0rd123"}).json()["access_token"]
    owner_id = int(decode_access_token(owner_token)["sub"])
    headers = {"Authorization": f"Bearer {owner_token}"}
    owners = mongo_db["platform_owner"]
    previous = owners.find_one({"_id": "owner"})
    owners.replace_one({"_id": "owner"}, {"_id": "owner", "user_id": owner_id}, upsert=True)
    extraction_id = uuid4().hex
    mongo_db["extractions"].insert_one({"extraction_id": extraction_id, "user_id": candidate_id, "skills": ["Python"]})
    data = {"candidate_id": extraction_id, "reason": "Help with profile", "consent_evidence": "Written consent 2026-11-01", "hours": 1}
    grant_id = None
    try:
        assert extraction_id in [item["candidate_id"] for item in client.get("/support/my-profiles", headers=candidate_headers).json()]
        assert extraction_id not in [item["candidate_id"] for item in client.get("/support/my-profiles", headers=headers).json()]
        assert client.post("/support/grants", headers=candidate_headers, json=data).status_code == 403
        assert client.post("/support/grants", headers=headers, json={**data, "consent_evidence": " " * 10}).status_code == 400
        grant = client.post("/support/grants", headers=headers, json=data)
        assert grant.status_code == 201, grant.text
        grant_id = grant.json()["grant_id"]
        assert client.get(f"/support/grants/{grant_id}/profile", headers=candidate_headers).status_code == 403
        profile = client.get(f"/support/grants/{grant_id}/profile", headers=headers)
        assert profile.status_code == 200 and profile.json()["skills"] == ["Python"]
        assert len(client.get(f"/support/grants/{grant_id}/access-log", headers=candidate_headers).json()) == 1
        mongo_db["support_grants"].update_one({"grant_id": grant_id}, {"$set": {"expires_at": (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()}})
        assert client.get(f"/support/grants/{grant_id}/profile", headers=headers).status_code == 404
        mongo_db["support_grants"].update_one({"grant_id": grant_id}, {"$set": {"expires_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()}})
        assert client.delete(f"/support/grants/{grant_id}", headers=candidate_headers).status_code == 200
        assert client.get(f"/support/grants/{grant_id}/profile", headers=headers).status_code == 404
    finally:
        mongo_db["extractions"].delete_one({"extraction_id": extraction_id})
        mongo_db["support_grants"].delete_many({"candidate_id": extraction_id})
        mongo_db["support_access_log"].delete_many({"candidate_id": extraction_id})
        owners.delete_one({"_id": "owner"})
        if previous:
            owners.insert_one(previous)
