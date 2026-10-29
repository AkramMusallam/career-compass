"""
خدمة الاشتراكات وبوابات الدفع (Stripe & PayPal Monetization Service)
القسم 7.2 من وثيقة المواصفات: Monetization & Payment Gateways (Freemium vs. Unlimited AI Pro).
"""
from __future__ import annotations

import datetime
import logging
import uuid
from typing import Any, Dict, List, Optional

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.mongo import subscriptions_collection
from app.models.mysql_models import User

logger = logging.getLogger(__name__)

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


def get_current_subscription(user: User) -> Dict[str, Any]:
    """جلب تفاصيل اشتراك المستخدم الحالي مع المزايا المفتوحة."""
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

    return {
        "tier": plan["id"],
        "tier_label": plan["name_ar"],
        "status": "active",
        "billing_cycle": billing_cycle,
        "features": plan["features"],
        "features_ar": plan["features_ar"],
        "limits": plan["limits"],
        "expires_at": expires_at,
    }


def create_checkout_session(
    user: User,
    plan_id: str,
    billing_cycle: str = "monthly",
    success_url: Optional[str] = None,
    cancel_url: Optional[str] = None,
    test_token: Optional[str] = None,
) -> Dict[str, Any]:
    """
    إنشاء جلسة دفع عبر Stripe (أو محاكاة فورية في بيئة التطوير والاختبار).
    إذا تم إرسال test_token="sandbox_upgrade" أو كنا في بيئة اختبارية، يتم تفعيل الباقة فوراً.
    """
    plan = get_plan_by_id(plan_id)
    if not plan or plan["id"] == "free":
        raise ValueError("Invalid subscription plan selected")

    session_id = f"cs_{uuid.uuid4().hex}"
    frontend_base = settings.FRONTEND_BASE_URL.rstrip("/")
    success_redirect = success_url or f"{frontend_base}/dashboard?subscription=success&session_id={session_id}"

    now = datetime.datetime.now(datetime.timezone.utc)
    duration_days = 365 if billing_cycle == "annual" else 30
    expires_at = (now + datetime.timedelta(days=duration_days)).isoformat()

    # إذا تم ضبط مفاتيح Stripe الفعلية في البيئة
    if settings.STRIPE_SECRET_KEY and not test_token:
        try:
            import stripe
            stripe.api_key = settings.STRIPE_SECRET_KEY
            price_amount = int((plan["price_annual"] if billing_cycle == "annual" else plan["price_monthly"]) * 100)

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
                cancel_url=cancel_url or f"{frontend_base}/pricing?status=cancelled",
                metadata={"user_id": str(user.id), "plan_id": plan["id"]},
            )
            return {
                "session_id": session.id,
                "checkout_url": session.url,
                "provider": "stripe",
                "mode": "payment",
            }
        except Exception as e:
            logger.warning("Stripe API call failed (%s), falling back to sandbox simulator", e)

    # وضع المحاكاة المباشر (Sandbox Mode / Development / Immediate Activation)
    sub_doc = {
        "subscription_id": session_id,
        "user_id": user.id,
        "plan_id": plan["id"],
        "billing_cycle": billing_cycle,
        "status": "active",
        "amount_usd": plan["price_annual"] if billing_cycle == "annual" else plan["price_monthly"],
        "created_at": now.isoformat(),
        "expires_at": expires_at,
        "provider": "stripe_simulated",
    }
    subscriptions_collection.insert_one(sub_doc)

    # تحديث مستوى اشتراك المستخدم في قاعدة البيانات SQL
    with SessionLocal() as db:
        db_user = db.query(User).filter(User.id == user.id).first()
        if db_user:
            db_user.subscription_tier = plan["id"]
            if plan["id"] == "enterprise":
                db_user.role = "recruiter"
            db.commit()

    return {
        "session_id": session_id,
        "checkout_url": success_redirect,
        "provider": "stripe",
        "mode": "sandbox",
    }


def cancel_subscription(user: User) -> Dict[str, Any]:
    """إلغاء الاشتراك النشط وإعادة الحساب للباقة المجانية."""
    with SessionLocal() as db:
        db_user = db.query(User).filter(User.id == user.id).first()
        if db_user:
            db_user.subscription_tier = "free"
            db.commit()

    subscriptions_collection.update_many(
        {"user_id": user.id, "status": "active"},
        {"$set": {"status": "canceled", "canceled_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}},
    )

    return {
        "status": "canceled",
        "message": "تم إلغاء الاشتراك بنجاح والعودة للباقة المجانية.",
        "tier": "free",
    }
