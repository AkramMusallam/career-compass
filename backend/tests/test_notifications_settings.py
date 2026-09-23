"""
Batch 5.6 — اختبارات PUT /settings/notifications (تفعيل/تعطيل التنبيهات البريدية الأسبوعية).
"""


def test_notifications_setting_requires_auth(client):
    resp = client.put("/settings/notifications", json={"notifications_opt_in": False})
    assert resp.status_code == 401


def test_profile_defaults_notifications_opt_in_to_true(client, registered_user_token):
    token, _ = registered_user_token
    headers = {"Authorization": f"Bearer {token}"}
    profile = client.get("/profile", headers=headers).json()
    assert profile["notifications_opt_in"] is True


def test_update_notifications_preference_persists(client, registered_user_token):
    token, _ = registered_user_token
    headers = {"Authorization": f"Bearer {token}"}

    disable_resp = client.put("/settings/notifications", headers=headers, json={"notifications_opt_in": False})
    assert disable_resp.status_code == 200
    assert disable_resp.json()["notifications_opt_in"] is False

    profile_after_disable = client.get("/profile", headers=headers).json()
    assert profile_after_disable["notifications_opt_in"] is False

    enable_resp = client.put("/settings/notifications", headers=headers, json={"notifications_opt_in": True})
    assert enable_resp.status_code == 200
    assert enable_resp.json()["notifications_opt_in"] is True

    profile_after_enable = client.get("/profile", headers=headers).json()
    assert profile_after_enable["notifications_opt_in"] is True
