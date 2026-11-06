import uuid

from app.core.mongo import mongo_db
from app.core.security import decode_access_token


def test_company_review_requires_bootstrapped_owner(client, registered_user_token):
    token, _ = registered_user_token
    headers = {"Authorization": f"Bearer {token}"}
    created = client.post("/companies", headers=headers, json={"name": "  Acme  "})
    assert created.status_code == 201
    company = created.json()
    assert company["name"] == "Acme" and company["status"] == "pending"
    assert client.get("/companies/review", headers=headers).status_code == 403
    assert client.patch(f"/companies/{company['company_id']}/status", headers=headers, json={"status": "approved"}).status_code == 403

    owner_id = int(decode_access_token(token)["sub"])
    owners = mongo_db["platform_owner"]
    previous = owners.find_one({"_id": "owner"})
    owners.replace_one({"_id": "owner"}, {"_id": "owner", "user_id": owner_id}, upsert=True)
    try:
        assert client.get("/companies/review", headers=headers).status_code == 200
        reviewed = client.patch(f"/companies/{company['company_id']}/status", headers=headers, json={"status": "approved"})
        assert reviewed.status_code == 200 and reviewed.json()["reviewed_by"] == owner_id
        assert client.patch(f"/companies/{uuid.uuid4()}/status", headers=headers, json={"status": "approved"}).status_code == 404
    finally:
        owners.delete_one({"_id": "owner"})
        if previous:
            owners.insert_one(previous)
        mongo_db["companies"].delete_one({"company_id": company["company_id"]})
