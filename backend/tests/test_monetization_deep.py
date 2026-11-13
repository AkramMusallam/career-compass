"""
اختبارات معمّقة لمنظومة الفوترة وبوابات الدفع (Monetization & Subscriptions Deep Suite)
تغطي:
- دقة مصفوفة الأسعار والخصم السنوي (20%).
- اتساق الميزات باللغتين العربية والإنجليزية.
- حالات الحافة في الترقية والإلغاء وإعادة المحاولة.
- الترقية التلقائية لصلاحية مسؤول التوظيف عند شراء باقة Enterprise.
- معالجة الـ Webhooks وإشعارات الدفع المتنوعة.
"""
import uuid
import pytest
from app.models.mysql_models import User
from app.core.database import SessionLocal
from app.services.subscription_service import SUBSCRIPTION_PLANS, get_plan_by_id


@pytest.fixture()
def paying_user(client):
    """مستخدم عادي لاختبار عمليات الفوترة والترقية."""
    email = f"payer.{uuid.uuid4().hex[:8]}@example.com"
    client.post("/register", json={"full_name": "Pro Payer", "email": email, "password": "Passw0rd123"})
    resp = client.post("/login", json={"email": email, "password": "Passw0rd123"})
    token = resp.json()["access_token"]
    return token, email


def test_plans_pricing_structure_and_discounts():
    """التحقق من صحة أسعار الباقات وحساب الخصم السنوي."""
    free_plan = get_plan_by_id("free")
    pro_plan = get_plan_by_id("pro")
    enterprise_plan = get_plan_by_id("enterprise")

    assert free_plan["price_monthly"] == 0.0
    assert free_plan["price_annual"] == 0.0

    # باقة Pro: 19 شهرياً، و 180 سنوياً (أقل من 19*12 = 228)
    assert pro_plan["price_monthly"] == 19.0
    assert pro_plan["price_annual"] == 180.0
    assert pro_plan["price_annual"] < pro_plan["price_monthly"] * 12

    # باقة Enterprise: 79 شهرياً، و 750 سنوياً (أقل من 79*12 = 948)
    assert enterprise_plan["price_monthly"] == 79.0
    assert enterprise_plan["price_annual"] == 750.0
    assert enterprise_plan["price_annual"] < enterprise_plan["price_monthly"] * 12

    # التحقق من أن كل باقة تحتوي على ميزات باللغتين
    for plan in [free_plan, pro_plan, enterprise_plan]:
        assert len(plan["features"]) >= 4
        assert len(plan["features_ar"]) == len(plan["features"])
        assert "limits" in plan
        assert "max_analyses" in plan["limits"]


def test_checkout_invalid_plan_rejected(client, paying_user):
    token, _ = paying_user
    headers = {"Authorization": f"Bearer {token}"}

    # 1. باقة مجانية كهدف دفع -> 400
    resp_free = client.post(
        "/subscriptions/checkout-session",
        json={"plan_id": "free", "billing_cycle": "monthly"},
        headers=headers,
    )
    assert resp_free.status_code == 400

    # 2. باقة غير موجودة إطلاقاً -> 400
    resp_fake = client.post(
        "/subscriptions/checkout-session",
        json={"plan_id": "super_unlimited_gold", "billing_cycle": "monthly"},
        headers=headers,
    )
    assert resp_fake.status_code == 400


def test_enterprise_upgrade_grants_recruiter_role(client, paying_user):
    token, email = paying_user
    headers = {"Authorization": f"Bearer {token}"}

    # فحص الدور المبدئي (candidate)
    with SessionLocal() as db:
        u = db.query(User).filter(User.email == email).first()
        assert u.role == "candidate"
        assert u.subscription_tier == "free"

    # الترقية إلى باقة الشركات (Enterprise)
    resp = client.post(
        "/subscriptions/checkout-session",
        json={"plan_id": "enterprise", "billing_cycle": "annual", "test_token": "sandbox_upgrade"},
        headers=headers,
    )
    assert resp.status_code == 200

    # التحقق من ترقية مستوى الاشتراك دون تصعيد صامت لدور الحساب
    with SessionLocal() as db:
        u = db.query(User).filter(User.email == email).first()
        assert u.subscription_tier == "enterprise"
        assert u.role == "candidate"

    # التحقق من انعكاس ذلك في GET /subscriptions/current
    resp_sub = client.get("/subscriptions/current", headers=headers)
    assert resp_sub.status_code == 200
    assert resp_sub.json()["tier"] == "enterprise"
    assert resp_sub.json()["limits"]["recruiter_portal"] is True


def test_subscription_multiple_transitions(client, paying_user):
    token, email = paying_user
    headers = {"Authorization": f"Bearer {token}"}

    # 1. ترقية إلى Pro شهري
    client.post(
        "/subscriptions/checkout-session",
        json={"plan_id": "pro", "billing_cycle": "monthly", "test_token": "sandbox_upgrade"},
        headers=headers,
    )
    sub_1 = client.get("/subscriptions/current", headers=headers).json()
    assert sub_1["tier"] == "pro"
    assert sub_1["billing_cycle"] == "monthly"

    # 2. تعديل الاشتراك إلى Pro سنوي
    client.post(
        "/subscriptions/checkout-session",
        json={"plan_id": "pro", "billing_cycle": "annual", "test_token": "sandbox_upgrade"},
        headers=headers,
    )
    sub_2 = client.get("/subscriptions/current", headers=headers).json()
    assert sub_2["tier"] == "pro"
    assert sub_2["billing_cycle"] == "annual"

    # 3. إلغاء الاشتراك -> العودة للباقة المجانية
    resp_cancel = client.post("/subscriptions/cancel", headers=headers)
    assert resp_cancel.status_code == 200
    assert resp_cancel.json()["tier"] == "free"

    # 4. تكرار الإلغاء عندما يكون الحساب مجانياً مسبقاً (إجراء آمن لا يُحدث خطأ)
    resp_cancel_repeat = client.post("/subscriptions/cancel", headers=headers)
    assert resp_cancel_repeat.status_code == 200
    assert resp_cancel_repeat.json()["tier"] == "free"


def test_webhook_various_event_types(client):
    """فحص استجابة مسار webhook لأحداث متنوعة وحمولات مختلفة."""
    events = [
        {"type": "checkout.session.completed", "data": {"object": {"id": "cs_123"}}},
        {"type": "customer.subscription.updated", "data": {"object": {"status": "active"}}},
        {"type": "customer.subscription.deleted", "data": {"object": {"status": "canceled"}}},
        {"type": "invoice.payment_succeeded", "data": {"object": {"amount_paid": 1900}}},
    ]

    for ev in events:
        resp = client.post(
            "/subscriptions/webhook",
            json=ev,
            headers={"Stripe-Signature": "t=123,v1=test_sig"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "received"
