"""
خدمة الاشتراكات وبوابات الدفع (Stripe & PayPal Monetization Service)
القسم 7.2 من وثيقة المواصفات: Monetization & Payment Gateways (Freemium vs. Unlimited AI Pro).
"""
from __future__ import annotations

import datetime
import json
import logging
import uuid
from typing import Any, Dict, List, Optional

from pymongo import ReturnDocument

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.mongo import analysis_results_collection, mongo_db, subscriptions_collection
from app.models.mysql_models import User

logger = logging.getLogger(__name__)
interviews_collection = mongo_db["interviews"]

SUBSCRIPTION_PLANS: List[Dict[str, Any]] = [
    {
        "id": "free",
        "name": "Freemium Explorer",
        "name_ar": "الباقة المجانية",
        "price_monthly": 0.0,
        "price_annual": 0.0,
        "currency": "USD",
        "description": "Essential career guidance and resume parsing for job seekers.",
        "description_ar": "الأساسيات لتقييم السيرة الذاتية واكتشاف الفجوات المهارية مجاناً.",
        "badge": "مجاني",
        "features": [
            "Up to 3 resume analyses",
            "2 technical mock interview sessions",
            "Personalized 3-month skill roadmap",
            "Basic ATS readability score audit",
            "Anonymous peer cohort benchmarking",
        ],
        "features_ar": [
            "تحليل السيرة الذاتية حتى 3 مرات",
            "جلستا محاكاة مقابلة تقنية بالذكاء الاصطناعي",
            "خارطة طريق تعليمية لمدة 3 أشهر",
            "فحص أولي لتوافق الـ ATS",
            "مقارنة مجهولة مع معدلات الأقران",
        ],
        "limits": {
            "max_analyses": 3,
            "max_interviews": 2,
            "voice_interviews": False,
            "ats_builder_export": False,
            "recruiter_portal": False,
        },
        "recommended": False,
    },
    {
        "id": "pro",
        "name": "Unlimited AI Pro",
        "name_ar": "المحترف غير المحدود (AI Pro)",
        "price_monthly": 19.0,
        "price_annual": 180.0,  # وفر 20%
        "currency": "USD",
        "description": "For serious tech professionals seeking accelerated career progression.",
        "description_ar": "الخيار الأمثل للمحترفين للتحضير للمقابلات وتوليد السير الذاتية بالذكاء الاصطناعي.",
        "badge": "الأكثر طلباً ⭐",
        "features": [
            "Unlimited AI resume extractions & analyses",
            "Unlimited Voice & Audio mock interviews (Whisper)",
            "Full ATS Resume Builder & customized PDF exporter",
            "Tailored AI Cover Letter generation",
            "Structured 10-point scoring with model answers",
            "Priority AI inference queue & Arabic PDF export",
        ],
        "features_ar": [
            "تحليلات سيرة ذاتية غير محدودة إطلاقاً",
            "مقابلات صوتية تفاعلية غير محدودة عبر OpenAI Whisper",
            "منشئ السيرة الذاتية المتوافقة مع ATS وتصدير PDF",
            "توليد رسائل التغطية (Cover Letters) مخصصة فورياً",
            "تقييم دقيق للمقابلات من 10 نقاط مع إجابات نموذجية",
            "أولوية معالجة قصوى وتصدير تقارير احترافية بالعربية",
        ],
        "limits": {
            "max_analyses": 999999,
            "max_interviews": 999999,
            "voice_interviews": True,
            "ats_builder_export": True,
            "recruiter_portal": False,
        },
        "recommended": True,
    },
    {
        "id": "enterprise",
        "name": "Recruiter & Enterprise",
        "name_ar": "بوابة الشركات والتوظيف (B2B)",
        "price_monthly": 79.0,
        "price_annual": 750.0,
        "currency": "USD",
        "description": "Comprehensive talent discovery and recruitment portal for tech companies.",
        "description_ar": "حلول متكاملة للشركات ومسؤولي التوظيف لاكتشاف وترتيب الكفاءات التقنية آلياً.",
        "badge": "للشركات 🏢",
        "features": [
            "Everything in Unlimited AI Pro",
            "Full B2B Recruiter Portal access",
            "Unlimited job postings & candidate matching",
            "AI Candidate Ranking Pipeline & filtering",
            "Direct access to candidate ATS scores & profiles",
            "Export candidate shortlists & talent management",
        ],
        "features_ar": [
            "كافة مميزات باقة AI Pro الاحترافية",
            "لوحة تحكم الشركات ومسؤولي التوظيف بالكامل",
            "نشر شواغر وظيفية غير محدودة ومطابقة الكفاءات",
            "محرك الفرز والترتيب الذكي للمرشحين بالذكاء الاصطناعي",
            "معاينة تفصيلية لملفات المرشحين ونقاط الـ ATS",
            "إدارة خط التوظيف وتصدير قوائم الكفاءات المؤهلة",
        ],
        "limits": {
            "max_analyses": 999999,
            "max_interviews": 999999,
            "voice_interviews": True,
            "ats_builder_export": True,
            "recruiter_portal": True,
        },
        "recommended": False,
    },
]


def get_all_plans() -> List[Dict[str, Any]]:
    """استرجاع باقات الاشتراك المتاحة."""
    return SUBSCRIPTION_PLANS


def get_plan_by_id(plan_id: str) -> Optional[Dict[str, Any]]:
    """جلب بيانات باقة محددة."""
    for p in SUBSCRIPTION_PLANS:
        if p["id"] == plan_id.lower():
            return p
    return None


def get_user_usage(user_id: int) -> Dict[str, int]:
    """حساب استهلاك المستخدم الفعلي من التحليلات والمقابلات التجريبية."""
    analyses_used = analysis_results_collection.count_documents({"user_id": user_id})
    interviews_used = interviews_collection.count_documents({"user_id": user_id})
    return {
        "analyses_used": int(analyses_used),
        "interviews_used": int(interviews_used),
    }


def check_feature_entitlement(user: User, feature: str) -> None:
    """Enforces plan feature entitlements (e.g. voice_interview, ats_builder) server-side."""
    if not settings.ENFORCE_SUBSCRIPTION_QUOTAS:
        return

    tier = getattr(user, "subscription_tier", "free") or "free"
    plan = get_plan_by_id(tier) or SUBSCRIPTION_PLANS[0]
    limits = plan.get("limits", {})

    if feature in ("voice_interview", "voice_interviews"):
        if not limits.get("voice_interviews", False):
            raise ValueError(
                f"المقابلات الصوتية غير متاحة في {plan['name_ar']}. "
                "يرجى الترقية إلى باقة المحترف (AI Pro) لتفعيل المقابلات الصوتية."
            )
    elif feature in ("ats_builder", "ats_builder_export"):
        if not limits.get("ats_builder_export", False):
            raise ValueError(
                f"منشئ السيرة الذاتية وتصدير ATS PDF غير متاحين في {plan['name_ar']}. "
                "يرجى الترقية إلى باقة المحترف (AI Pro) لتفعيل هذه الميزة."
            )


def _quota_field_and_limit(user: User, resource: str) -> tuple[str, int, Dict[str, Any]]:
    tier = getattr(user, "subscription_tier", "free") or "free"
    plan = get_plan_by_id(tier) or SUBSCRIPTION_PLANS[0]
    limits = plan.get("limits", {})
    if resource == "analysis":
        return "analyses_used", int(limits.get("max_analyses", 3)), plan
    if resource == "interview":
        return "interviews_used", int(limits.get("max_interviews", 2)), plan
    raise ValueError(f"Unknown quota resource: {resource}")


def _quota_exceeded_message(resource: str, plan: Dict[str, Any], max_limit: int) -> str:
    if resource == "analysis":
        return (
            f"لقد استنفدت الحد الأقصى للتحليلات في {plan['name_ar']} ({max_limit} تحليلات). "
            "يرجى الترقية إلى باقة المحترف (AI Pro) للحصول على تحليلات سيرة ذاتية غير محدودة."
        )
    return (
        f"لقد استنفدت الحد الأقصى للمقابلات التجريبية في {plan['name_ar']} ({max_limit} مقابلات). "
        "يرجى الترقية إلى باقة المحترف (AI Pro) للحصول على مقابلات ذكية غير محدودة."
    )


def _sync_usage_quota_floor(user_id: int) -> None:
    """Ensures usage_quotas exists and reflects at least the persisted collection counts."""
    uid = int(user_id)
    analyses_cnt = int(analysis_results_collection.count_documents({"user_id": uid}))
    interviews_cnt = int(interviews_collection.count_documents({"user_id": uid}))
    quotas = mongo_db["usage_quotas"]
    try:
        quotas.update_one(
            {"_id": uid},
            {"$setOnInsert": {"analyses_used": analyses_cnt, "interviews_used": interviews_cnt}},
            upsert=True,
        )
    except Exception:
        pass
    quotas.update_one({"_id": uid, "analyses_used": {"$lt": analyses_cnt}}, {"$set": {"analyses_used": analyses_cnt}})
    quotas.update_one({"_id": uid, "interviews_used": {"$lt": interviews_cnt}}, {"$set": {"interviews_used": interviews_cnt}})


def reserve_user_quota(user: User, resource: str) -> bool:
    """Atomically reserves one usage quota slot in `usage_quotas` to prevent concurrent race bypasses."""
    if not settings.ENFORCE_SUBSCRIPTION_QUOTAS:
        return False

    field, max_limit, plan = _quota_field_and_limit(user, resource)
    uid = int(user.id)
    _sync_usage_quota_floor(uid)

    updated = mongo_db["usage_quotas"].find_one_and_update(
        {"_id": uid, field: {"$lt": max_limit}},
        {"$inc": {field: 1}},
        return_document=ReturnDocument.AFTER,
    )
    if updated is None:
        raise ValueError(_quota_exceeded_message(resource, plan, max_limit))
    return True


def release_user_quota(user_id: int, resource: str) -> None:
    """Rolls back a previously reserved quota slot when downstream processing fails."""
    field = "analyses_used" if resource == "analysis" else "interviews_used" if resource == "interview" else None
    if not field:
        return
    mongo_db["usage_quotas"].update_one(
        {"_id": int(user_id), field: {"$gt": 0}},
        {"$inc": {field: -1}},
    )


def check_user_quota(user: User, resource: str) -> None:
    """
    التحقق من حدود الباقة الحالية للمستخدم (Free vs Pro / Enterprise).
    يرفع ValueError برسالة واضحة إذا تجاوز المستخدم الحد المسموح به في الباقة المجانية.
    """
    if not settings.ENFORCE_SUBSCRIPTION_QUOTAS:
        return

    field, max_limit, plan = _quota_field_and_limit(user, resource)
    usage = get_user_usage(user.id)
    quota_doc = mongo_db["usage_quotas"].find_one({"_id": int(user.id)}) or {}
    used = max(int(usage.get(field, 0)), int(quota_doc.get(field, 0)))
    if used >= max_limit:
        raise ValueError(_quota_exceeded_message(resource, plan, max_limit))


def get_current_subscription(user: User) -> Dict[str, Any]:
    """جلب تفاصيل اشتراك المستخدم الحالي مع المزايا المفتوحة وسجل الفواتير والاستهلاك."""
    tier = getattr(user, "subscription_tier", "free") or "free"
    plan = get_plan_by_id(tier) or SUBSCRIPTION_PLANS[0]

    # جلب أحدث سجل اشتراك نشط من MongoDB
    sub_record = subscriptions_collection.find_one(
        {"user_id": user.id, "status": "active"},
        sort=[("created_at", -1)],
    )

    expires_at = None
    billing_cycle = "monthly"
    if sub_record:
        expires_at = sub_record.get("expires_at")
        billing_cycle = sub_record.get("billing_cycle", "monthly")

    # جلب سجل الفواتير والمدفوعات للمستخدم
    raw_invoices = list(
        subscriptions_collection.find(
            {"user_id": user.id},
            {"_id": 0},
            sort=[("created_at", -1)],
        ).limit(10)
    )
    invoices = []
    for inv in raw_invoices:
        inv_plan = get_plan_by_id(inv.get("plan_id", "pro"))
        invoices.append(
            {
                "invoice_id": inv.get("invoice_id") or f"INV-{str(inv.get('subscription_id', ''))[-8:].upper()}",
                "subscription_id": inv.get("subscription_id"),
                "plan_id": inv.get("plan_id"),
                "plan_name_ar": inv_plan["name_ar"] if inv_plan else inv.get("plan_id", "Pro"),
                "billing_cycle": inv.get("billing_cycle", "monthly"),
                "amount_usd": inv.get("amount_usd", 0.0),
                "payment_method": inv.get("payment_method", "card"),
                "card_last4": inv.get("card_last4") or "4242",
                "cardholder_name": inv.get("cardholder_name") or user.full_name,
                "status": inv.get("status", "active"),
                "created_at": inv.get("created_at"),
                "expires_at": inv.get("expires_at"),
            }
        )

    return {
        "tier": plan["id"],
        "tier_label": plan["name_ar"],
        "status": "active",
        "billing_cycle": billing_cycle,
        "features": plan["features"],
        "features_ar": plan["features_ar"],
        "limits": plan["limits"],
        "expires_at": expires_at,
        "usage": get_user_usage(user.id),
        "invoices": invoices,
    }


def _create_stripe_checkout_session(
    *,
    user: User,
    plan: Dict[str, Any],
    billing_cycle: str,
    amount_usd: float,
    success_redirect: str,
    cancel_redirect: str,
) -> Dict[str, Any]:
    import stripe

    stripe.api_key = settings.STRIPE_SECRET_KEY
    price_amount = int(amount_usd * 100)
    sub_metadata = {"user_id": str(user.id), "plan_id": plan["id"]}
    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        customer_email=user.email,
        line_items=[{
            "price_data": {
                "currency": "usd",
                "product_data": {
                    "name": f"Career Compass — {plan['name']}",
                    "description": plan["description"],
                },
                "unit_amount": price_amount,
                "recurring": {"interval": "year" if billing_cycle == "annual" else "month"},
            },
            "quantity": 1,
        }],
        mode="subscription",
        success_url=success_redirect,
        cancel_url=cancel_redirect,
        metadata=sub_metadata,
        subscription_data={"metadata": sub_metadata},
    )
    return {
        "session_id": session.id,
        "checkout_url": session.url,
        "provider": "stripe",
        "mode": "payment",
    }


def create_checkout_session(
    user: User,
    plan_id: str,
    billing_cycle: str = "monthly",
    payment_method: str = "card",
    cardholder_name: Optional[str] = None,
    card_last4: Optional[str] = None,
    company_name: Optional[str] = None,
    success_url: Optional[str] = None,
    cancel_url: Optional[str] = None,
    test_token: Optional[str] = None,
) -> Dict[str, Any]:
    """
    إنشاء جلسة دفع عبر Stripe / PayPal وتوثيق الفاتورة وتفعيل الاشتراك.
    """
    plan = get_plan_by_id(plan_id)
    if not plan or plan["id"] == "free":
        raise ValueError("Invalid subscription plan selected")

    clean_last4 = (card_last4 or "").strip()
    if clean_last4 and (len(clean_last4) != 4 or not clean_last4.isdigit()):
        raise ValueError("Invalid card last 4 digits")

    session_id = f"cs_{uuid.uuid4().hex}"
    now = datetime.datetime.now(datetime.timezone.utc)
    invoice_id = f"INV-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    frontend_base = settings.FRONTEND_BASE_URL.rstrip("/")

    def _resolve_redirect(url_value: Optional[str], default_path: str) -> str:
        if not url_value:
            return f"{frontend_base}{default_path}"
        return f"{frontend_base}{url_value}" if url_value.startswith("/") else url_value

    success_redirect = _resolve_redirect(success_url, f"/dashboard?subscription=success&session_id={session_id}")
    cancel_redirect = _resolve_redirect(cancel_url, "/pricing?status=cancelled")

    duration_days = 365 if billing_cycle == "annual" else 30
    expires_at = (now + datetime.timedelta(days=duration_days)).isoformat()
    amount_usd = float(plan["price_annual"] if billing_cycle == "annual" else plan["price_monthly"])

    is_testing_sandbox = settings.ENV == "testing"
    if not is_testing_sandbox:
        # Outside automated testing, only verified Stripe server checkout sessions may be created.
        if payment_method != "card":
            raise ValueError("Selected payment gateway is not enabled in this environment")
        if not settings.STRIPE_SECRET_KEY:
            raise ValueError("Payment gateway is not configured")
        try:
            return _create_stripe_checkout_session(
                user=user,
                plan=plan,
                billing_cycle=billing_cycle,
                amount_usd=amount_usd,
                success_redirect=success_redirect,
                cancel_redirect=cancel_redirect,
            )
        except Exception as e:
            raise ValueError("Payment gateway error") from e

    # Explicit ENV=="testing" sandbox path for automated integration tests
    allow_sandbox_bypass = bool(test_token)
    if settings.STRIPE_SECRET_KEY and not allow_sandbox_bypass and not clean_last4 and payment_method == "card":
        try:
            return _create_stripe_checkout_session(
                user=user,
                plan=plan,
                billing_cycle=billing_cycle,
                amount_usd=amount_usd,
                success_redirect=success_redirect,
                cancel_redirect=cancel_redirect,
            )
        except Exception as e:
            logger.warning("Stripe API call failed (%s), falling back to direct checkout processor in testing", e)

    # أرشفة أي اشتراكات نشطة سابقة قبل تسجيل الفاتورة والاشتراك الجديد
    subscriptions_collection.update_many(
        {"user_id": user.id, "status": "active"},
        {"$set": {"status": "superseded", "updated_at": now.isoformat()}},
    )

    sub_doc = {
        "subscription_id": session_id,
        "invoice_id": invoice_id,
        "user_id": user.id,
        "plan_id": plan["id"],
        "plan_name_ar": plan["name_ar"],
        "billing_cycle": billing_cycle,
        "status": "active",
        "amount_usd": amount_usd,
        "payment_method": payment_method,
        "cardholder_name": (cardholder_name or user.full_name or "").strip(),
        "card_last4": clean_last4 or ("PAYP" if payment_method == "paypal" else "4242"),
        "created_at": now.isoformat(),
        "expires_at": expires_at,
        "provider": "paypal" if payment_method == "paypal" else "stripe",
    }
    subscriptions_collection.insert_one(sub_doc)

    # تحديث مستوى اشتراك المستخدم في قاعدة البيانات SQL دون ترقية تلقائية لدور الحساب
    with SessionLocal() as db:
        db_user = db.query(User).filter(User.id == user.id).first()
        if db_user:
            db_user.subscription_tier = plan["id"]
            db.commit()

    invoice_summary = {
        "invoice_id": invoice_id,
        "plan_id": plan["id"],
        "plan_name_ar": plan["name_ar"],
        "billing_cycle": billing_cycle,
        "amount_usd": amount_usd,
        "payment_method": payment_method,
        "card_last4": sub_doc["card_last4"],
        "cardholder_name": sub_doc["cardholder_name"],
        "status": "paid",
        "created_at": now.isoformat(),
        "expires_at": expires_at,
    }

    return {
        "session_id": session_id,
        "checkout_url": success_redirect,
        "provider": "paypal" if payment_method == "paypal" else "stripe",
        "mode": "sandbox",
        "invoice": invoice_summary,
    }


def _apply_local_subscription_cancellation(user_id: int) -> None:
    with SessionLocal() as db:
        db_user = db.query(User).filter(User.id == user_id).first()
        if db_user:
            db_user.subscription_tier = "free"
            db.commit()

    subscriptions_collection.update_many(
        {"user_id": user_id, "status": "active"},
        {"$set": {"status": "canceled", "canceled_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}},
    )


def cancel_subscription(user: User) -> Dict[str, Any]:
    """إلغاء الاشتراك النشط في Stripe (عند تفعيله) ومزامنة الحالة محلياً وإعادة الحساب للباقة المجانية."""
    active_subs = list(subscriptions_collection.find({"user_id": user.id, "status": "active"}))
    stripe_sub_ids = [
        s.get("stripe_subscription_id")
        or (s.get("subscription_id") if str(s.get("subscription_id", "")).startswith("sub_") else None)
        for s in active_subs
    ]
    stripe_sub_ids = [str(sid) for sid in stripe_sub_ids if sid]

    if settings.STRIPE_SECRET_KEY and stripe_sub_ids:
        try:
            import stripe

            stripe.api_key = settings.STRIPE_SECRET_KEY
            for sid in stripe_sub_ids:
                if hasattr(stripe.Subscription, "cancel"):
                    stripe_resp = stripe.Subscription.cancel(sid)
                else:
                    stripe_resp = stripe.Subscription.delete(sid)
                resp_status = (
                    getattr(stripe_resp, "status", None)
                    or (stripe_resp.get("status") if isinstance(stripe_resp, dict) else None)
                )
                if resp_status and resp_status not in ("canceled", "incomplete_expired"):
                    raise ValueError(f"Unexpected Stripe cancellation status: {resp_status}")
        except ValueError:
            raise
        except Exception as exc:
            raise ValueError("Failed to cancel subscription at Stripe") from exc

    _apply_local_subscription_cancellation(user.id)

    return {
        "status": "canceled",
        "message": "تم إلغاء الاشتراك بنجاح والعودة للباقة المجانية.",
        "tier": "free",
    }


def handle_webhook_event(body: bytes, stripe_signature: Optional[str] = None) -> Dict[str, Any]:
    """معالجة إشعارات Stripe Webhook وتحديث حالة الاشتراكات بأمان."""
    if len(body) > 65536:
        raise ValueError("Webhook payload too large")

    event: Dict[str, Any] = {}
    if settings.ENV != "testing" or settings.STRIPE_WEBHOOK_SECRET:
        if not settings.STRIPE_WEBHOOK_SECRET:
            raise ValueError("Stripe webhook secret is not configured")
        if not stripe_signature:
            raise ValueError("Missing Stripe signature")
        try:
            import stripe
            event = stripe.Webhook.construct_event(
                payload=body,
                sig_header=stripe_signature,
                secret=settings.STRIPE_WEBHOOK_SECRET,
            )
        except Exception as e:
            raise ValueError(f"Invalid Stripe webhook signature: {e}") from e
    elif body:
        try:
            parsed = json.loads(body.decode("utf-8"))
            if isinstance(parsed, dict):
                event = parsed
        except Exception:
            event = {}

    event_type = event.get("type")
    data_obj = (event.get("data") or {}).get("object") or {}
    metadata = data_obj.get("metadata") or {}

    if event_type == "checkout.session.completed":
        user_id_raw = metadata.get("user_id")
        plan_id = metadata.get("plan_id")
        plan = get_plan_by_id(plan_id) if plan_id else None
        if user_id_raw and plan and plan["id"] != "free":
            try:
                uid = int(user_id_raw)
                with SessionLocal() as db:
                    db_user = db.query(User).filter(User.id == uid).first()
                    if db_user:
                        db_user.subscription_tier = plan["id"]
                        db.commit()
                stripe_sub_id = data_obj.get("subscription")
                if stripe_sub_id:
                    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
                    subscriptions_collection.update_many(
                        {"user_id": uid, "status": "active", "stripe_subscription_id": {"$ne": stripe_sub_id}},
                        {"$set": {"status": "superseded", "updated_at": now_iso}},
                    )
                    subscriptions_collection.update_one(
                        {"stripe_subscription_id": stripe_sub_id},
                        {
                            "$set": {
                                "subscription_id": stripe_sub_id,
                                "stripe_subscription_id": stripe_sub_id,
                                "stripe_customer_id": data_obj.get("customer"),
                                "user_id": uid,
                                "plan_id": plan["id"],
                                "plan_name_ar": plan["name_ar"],
                                "status": "active",
                                "provider": "stripe",
                                "updated_at": now_iso,
                            },
                            "$setOnInsert": {"created_at": now_iso},
                        },
                        upsert=True,
                    )
            except (ValueError, TypeError):
                pass
    elif event_type == "customer.subscription.deleted":
        user_id_raw = metadata.get("user_id")
        uid: Optional[int] = None
        if user_id_raw:
            try:
                uid = int(user_id_raw)
            except (ValueError, TypeError):
                uid = None
        if uid is None and data_obj.get("id"):
            sub_doc = subscriptions_collection.find_one({"stripe_subscription_id": data_obj.get("id")})
            if sub_doc and sub_doc.get("user_id") is not None:
                uid = int(sub_doc["user_id"])
        if uid is not None:
            _apply_local_subscription_cancellation(uid)
    elif event_type == "customer.subscription.updated":
        sub_status = str(data_obj.get("status") or "").lower()
        user_id_raw = metadata.get("user_id")
        uid = None
        if user_id_raw:
            try:
                uid = int(user_id_raw)
            except (ValueError, TypeError):
                uid = None
        if uid is None and data_obj.get("id"):
            sub_doc = subscriptions_collection.find_one({"stripe_subscription_id": data_obj.get("id")})
            if sub_doc and sub_doc.get("user_id") is not None:
                uid = int(sub_doc["user_id"])
        if uid is not None:
            if sub_status in ("canceled", "unpaid", "incomplete_expired"):
                _apply_local_subscription_cancellation(uid)
            elif sub_status == "active":
                plan_id = metadata.get("plan_id")
                plan = get_plan_by_id(plan_id) if plan_id else None
                if plan and plan["id"] != "free":
                    with SessionLocal() as db:
                        db_user = db.query(User).filter(User.id == uid).first()
                        if db_user:
                            db_user.subscription_tier = plan["id"]
                            db.commit()

    return {"status": "received", "length": len(body), "event_type": event_type}
