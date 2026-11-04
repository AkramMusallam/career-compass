"""
مسارات الاشتراكات وبوابات الدفع (Stripe & Monetization Routes)
القسم 7.2 من وثيقة المواصفات: Monetization & Payment Gateways (Freemium vs. Unlimited AI Pro).
"""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status

from app.core.security import get_current_user
from app.models.mysql_models import User
from app.schemas.schemas import (
    CancelSubscriptionResponse,
    CheckoutSessionRequest,
    CheckoutSessionResponse,
    CurrentSubscriptionResponse,
    PlanPricingTier,
)
from app.services import subscription_service

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions & Monetization"])


@router.get("/plans", response_model=List[PlanPricingTier])
def list_plans():
    """عرض خطط وباقات الأسعار المتاحة مع الميزات والمقارنة."""
    plans = subscription_service.get_all_plans()
    return [PlanPricingTier(**p) for p in plans]


@router.get("/current", response_model=CurrentSubscriptionResponse)
def get_user_subscription(current_user: User = Depends(get_current_user)):
    """استرجاع باقة الاشتراك الحالية للمستخدم مع الصلاحيات والحدود."""
    sub = subscription_service.get_current_subscription(current_user)
    return CurrentSubscriptionResponse(**sub)


@router.post("/checkout-session", response_model=CheckoutSessionResponse)
def create_checkout(
    payload: CheckoutSessionRequest,
    current_user: User = Depends(get_current_user),
):
    """بدء جلسة ترقية ودفع عبر Stripe (أو التفعيل الفوري في الوضع التجريبي/Sandbox)."""
    try:
        res = subscription_service.create_checkout_session(
            user=current_user,
            plan_id=payload.plan_id,
            billing_cycle=payload.billing_cycle,
            payment_method=payload.payment_method,
            cardholder_name=payload.cardholder_name,
            card_last4=payload.card_last4,
            company_name=payload.company_name,
            success_url=payload.success_url,
            cancel_url=payload.cancel_url,
            test_token=payload.test_token,
        )
        return CheckoutSessionResponse(**res)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/cancel", response_model=CancelSubscriptionResponse)
def cancel_subscription(current_user: User = Depends(get_current_user)):
    """إلغاء التجديد التلقائي للاشتراك والعودة للباقة المجانية."""
    res = subscription_service.cancel_subscription(current_user)
    return CancelSubscriptionResponse(**res)


@router.post("/webhook", status_code=status.HTTP_200_OK)
async def stripe_webhook(request: Request, stripe_signature: str = Header(None)):
    """معالجة إشعارات Stripe الفورية لتأكيد الدفع وتجديد الاشتراكات."""
    body = await request.body()
    try:
        return subscription_service.handle_webhook_event(body, stripe_signature)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
