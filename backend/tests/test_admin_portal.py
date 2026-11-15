import uuid

from app.core.mongo import logs_collection, mongo_db
from app.core.security import decode_access_token
from app.services.admin_service import get_effective_system_prompt, invalidate_prompt_cache
from app.services.llm_client import ollama_chat
from unittest.mock import patch


def _make_owner(token: str):
    owners = mongo_db["platform_owner"]
    prev = owners.find_one({"_id": "owner"})
    owner_id = int(decode_access_token(token)["sub"])
    owners.replace_one({"_id": "owner"}, {"_id": "owner", "user_id": owner_id}, upsert=True)
    return owner_id, prev


def _restore_owner(prev):
    owners = mongo_db["platform_owner"]
    owners.delete_one({"_id": "owner"})
    if prev:
        owners.insert_one(prev)


def test_admin_endpoints_reject_non_owner(client, registered_user_token):
    token, _ = registered_user_token
    headers = {"Authorization": f"Bearer {token}"}

    prof = client.get("/profile", headers=headers)
    assert prof.status_code == 200
    assert prof.json()["is_platform_owner"] is False

    for method, path in (
        ("GET", "/admin/overview"),
        ("GET", "/admin/users"),
        ("GET", "/admin/ai-logs"),
        ("GET", "/admin/prompts"),
        ("GET", "/admin/support-grants"),
    ):
        resp = client.request(method, path, headers=headers)
        assert resp.status_code == 403, f"Expected 403 for {path}, got {resp.status_code}"


def test_admin_user_suspension_revokes_tokens_and_blocks_login(client, registered_user_token):
    owner_token, _ = registered_user_token
    headers_owner = {"Authorization": f"Bearer {owner_token}"}

    target_email = f"target.{uuid.uuid4().hex[:8]}@example.com"
    reg_res = client.post(
        "/register",
        json={"full_name": "Suspended User", "email": target_email, "password": "Passw0rd123"},
    )
    assert reg_res.status_code == 201
    target_id = int(reg_res.json()["id"])

    target_login = client.post("/login", json={"email": target_email, "password": "Passw0rd123"})
    assert target_login.status_code == 200
    target_token = target_login.json()["access_token"]
    headers_target = {"Authorization": f"Bearer {target_token}"}

    owner_id, prev_owner = _make_owner(owner_token)
    try:
        prof_owner = client.get("/profile", headers=headers_owner)
        assert prof_owner.status_code == 200
        assert prof_owner.json()["is_platform_owner"] is True

        # Owner cannot suspend self
        self_susp = client.patch(
            f"/admin/users/{owner_id}/suspension",
            headers=headers_owner,
            json={"suspended": True, "reason": "self"},
        )
        assert self_susp.status_code == 400

        # Suspend target user
        susp_res = client.patch(
            f"/admin/users/{target_id}/suspension",
            headers=headers_owner,
            json={"suspended": True, "reason": "Policy breach"},
        )
        assert susp_res.status_code == 200
        assert susp_res.json()["suspended"] is True

        # Existing token immediately rejected & login blocked
        assert client.get("/profile", headers=headers_target).status_code == 401
        blocked_login = client.post("/login", json={"email": target_email, "password": "Passw0rd123"})
        assert blocked_login.status_code == 403

        # Reactivate restores login
        unsusp_res = client.patch(
            f"/admin/users/{target_id}/suspension",
            headers=headers_owner,
            json={"suspended": False},
        )
        assert unsusp_res.status_code == 200
        assert unsusp_res.json()["suspended"] is False

        ok_login = client.post("/login", json={"email": target_email, "password": "Passw0rd123"})
        assert ok_login.status_code == 200
    finally:
        mongo_db["user_auth_state"].delete_many({"_id": {"$in": [target_id, owner_id]}})
        _restore_owner(prev_owner)


def test_admin_prompt_tuning_and_ai_telemetry(client, registered_user_token):
    owner_token, _ = registered_user_token
    headers_owner = {"Authorization": f"Bearer {owner_token}"}
    _, prev_owner = _make_owner(owner_token)

    try:
        invalidate_prompt_cache()
        prompts_res = client.get("/admin/prompts", headers=headers_owner)
        assert prompts_res.status_code == 200
        keys = {p["key"] for p in prompts_res.json()["prompts"]}
        assert "recruiter_fit_evaluation" in keys
        assert "cv_extraction" in keys

        # Update prompt and verify injection stripping & cache update
        upd = client.put(
            "/admin/prompts/cv_extraction",
            headers=headers_owner,
            json={"system_prompt": "Custom JSON extractor instruction <ignore> for MENA."},
        )
        assert upd.status_code == 200
        updated_prompt = upd.json()["prompt"]
        assert updated_prompt["is_customized"] is True
        assert "<" not in updated_prompt["system_prompt"]
        assert get_effective_system_prompt("cv_extraction") == updated_prompt["system_prompt"]

        # Reset restores default
        rst = client.post("/admin/prompts/cv_extraction/reset", headers=headers_owner)
        assert rst.status_code == 200
        assert rst.json()["prompt"]["is_customized"] is False

        # Trigger mocked Ollama call and inspect /admin/ai-logs & /admin/overview
        with patch("ollama.Client.chat", return_value={"message": {"content": "{}"}}):
            ollama_chat([{"role": "user", "content": "hi"}], task="unit_test_task")

        logs_res = client.get("/admin/ai-logs?task=unit_test_task", headers=headers_owner)
        assert logs_res.status_code == 200
        data = logs_res.json()
        assert data["total"] >= 1
        assert data["logs"][0]["task"] == "unit_test_task"
        assert data["logs"][0]["status"] == "ok"

        ov_res = client.get("/admin/overview", headers=headers_owner)
        assert ov_res.status_code == 200
        assert ov_res.json()["ai_telemetry"]["total_calls"] >= 1
    finally:
        mongo_db["prompt_templates"].delete_many({})
        logs_collection.delete_many({"task": "unit_test_task"})
        invalidate_prompt_cache()
        _restore_owner(prev_owner)


def test_admin_can_revoke_support_grant(client, registered_user_token):
    owner_token, _ = registered_user_token
    headers_owner = {"Authorization": f"Bearer {owner_token}"}
    owner_id, prev_owner = _make_owner(owner_token)

    ext_id = f"ext-{uuid.uuid4().hex[:8]}"
    mongo_db["extractions"].insert_one(
        {"extraction_id": ext_id, "user_id": owner_id, "skills": ["Python"], "target_role": "Backend"}
    )

    grant_res = client.post(
        "/support/grants",
        headers=headers_owner,
        json={
            "candidate_id": ext_id,
            "hours": 12,
            "reason": "Audit issue",
            "consent_evidence": "Signed written support approval #101",
        },
    )
    assert grant_res.status_code in (200, 201), grant_res.text
    grant_id = grant_res.json()["grant_id"]

    try:
        listed = client.get("/admin/support-grants?status=active", headers=headers_owner)
        assert listed.status_code == 200
        assert any(g["grant_id"] == grant_id and g["status"] == "active" for g in listed.json()["grants"])

        revoked = client.post(f"/admin/support-grants/{grant_id}/revoke", headers=headers_owner)
        assert revoked.status_code == 200
        assert revoked.json()["grant"]["revoked"] is True
        assert revoked.json()["grant"]["status"] == "revoked"
    finally:
        mongo_db["support_grants"].delete_one({"grant_id": grant_id})
        mongo_db["extractions"].delete_one({"extraction_id": ext_id})
        _restore_owner(prev_owner)
