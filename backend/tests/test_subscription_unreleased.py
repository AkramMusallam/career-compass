from app.core.config import settings


def test_subscription_routes_unavailable_in_production(client, registered_user_token, monkeypatch):
    token, _ = registered_user_token
    monkeypatch.setattr(settings, "ENV", "production")
    assert client.get("/subscriptions/plans").status_code == 503
    assert client.post("/subscriptions/checkout-session", headers={"Authorization": f"Bearer {token}"}, json={"plan_id": "pro"}).status_code == 503
    assert client.post("/subscriptions/webhook", json={}).status_code == 503
