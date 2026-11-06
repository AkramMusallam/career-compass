from datetime import datetime, timedelta, timezone
import re
import uuid

from app.api.routes import companies
from app.core.mongo import mongo_db
from app.core.security import decode_access_token


def test_invitation_is_email_bound_single_use_and_expires(client, registered_user_token, monkeypatch):
    token, _ = registered_user_token
    owner_headers = {"Authorization": f"Bearer {token}"}
    suffix = uuid.uuid4().hex
    email = f"member-{suffix}@example.com"
    client.post("/register", json={"full_name": "Member", "email": email, "password": "Passw0rd123"})
    member_token = client.post("/login", json={"email": email, "password": "Passw0rd123"}).json()["access_token"]
    member_headers = {"Authorization": f"Bearer {member_token}"}
    created = client.post("/companies", headers=owner_headers, json={"name": "Test company"}).json()
    company_id = created["company_id"]
    mongo_db["companies"].update_one({"company_id": company_id}, {"$set": {"status": "approved"}})
    messages = []
    monkeypatch.setattr(companies.settings, "EMAIL_NOTIFICATIONS_ENABLED", True)
    monkeypatch.setattr(companies, "send_email", lambda to, subject, html, text: messages.append(text) or True)
    try:
        assert client.post(f"/companies/{company_id}/invitations", headers=member_headers, json={"email": email}).status_code == 404
        response = client.post(f"/companies/{company_id}/invitations", headers=owner_headers, json={"email": email})
        assert response.status_code == 201 and response.json()["delivery"] == "sent"
        invitation_token = re.search(r"company-invitation/([^ ]+)", messages[-1]).group(1)
        assert client.post("/companies/invitations/accept", headers=owner_headers, json={"token": invitation_token}).status_code == 404
        assert client.post("/companies/invitations/accept", headers=member_headers, json={"token": invitation_token}).status_code == 200
        assert client.post("/companies/invitations/accept", headers=member_headers, json={"token": invitation_token}).status_code == 404
        assert any(c["company_id"] == company_id for c in client.get("/companies/mine", headers=member_headers).json())

        client.post(f"/companies/{company_id}/invitations", headers=owner_headers, json={"email": email})
        expired_token = re.search(r"company-invitation/([^ ]+)", messages[-1]).group(1)
        mongo_db["companies"].update_one({"company_id": company_id}, {"$set": {"status": "suspended"}})
        assert client.post("/companies/invitations/accept", headers=member_headers, json={"token": expired_token}).status_code == 404
        mongo_db["companies"].update_one({"company_id": company_id}, {"$set": {"status": "approved"}})
        mongo_db["companies"].update_one({"company_id": company_id}, {"$set": {"invitations.0.expires_at": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()}})
        assert client.post("/companies/invitations/accept", headers=member_headers, json={"token": expired_token}).status_code == 404
        client.post(f"/companies/{company_id}/invitations", headers=owner_headers, json={"email": email})
        pending_token = re.search(r"company-invitation/([^ ]+)", messages[-1]).group(1)
        member_id = int(decode_access_token(member_token)["sub"])
        assert client.delete(f"/companies/{company_id}/members/{member_id}", headers=owner_headers).status_code == 200
        assert client.post("/companies/invitations/accept", headers=member_headers, json={"token": pending_token}).status_code == 404
        monkeypatch.setattr(companies, "send_email", lambda *args: False)
        failed = client.post(f"/companies/{company_id}/invitations", headers=owner_headers, json={"email": email})
        assert failed.json()["delivery"] == "failed"
        monkeypatch.setattr(companies.settings, "ENV", "production")
        monkeypatch.setattr(companies.settings, "FRONTEND_BASE_URL", "http://example.com")
        assert client.post(f"/companies/{company_id}/invitations", headers=owner_headers, json={"email": email}).status_code == 503
    finally:
        mongo_db["companies"].delete_one({"company_id": company_id})
