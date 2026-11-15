"""
بوابة مدير النظام (System Administrator Portal — Spec Section 2 Future Scope).
محمية بالكامل عبر require_platform_owner لمنع تصعيد الصلاحيات الذاتي.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.routes.companies import require_platform_owner
from app.models.mysql_models import User
from app.schemas.schemas import AdminPromptUpdateRequest, AdminUserSuspensionRequest
from app.services import admin_service

router = APIRouter(prefix="/admin", tags=["System Administrator"])


@router.get("/overview")
def admin_overview(_owner: User = Depends(require_platform_owner)):
    """لوحة المؤشرات الشاملة للمنصة (المستخدمون، الشركات، التحليلات، وصحة الـ AI)."""
    return admin_service.get_admin_overview()


@router.get("/users")
def admin_list_users(
    q: Optional[str] = Query(None, max_length=120),
    role: Optional[str] = Query(None, max_length=40),
    suspended: Optional[bool] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _owner: User = Depends(require_platform_owner),
):
    """استعراض حسابات المستخدمين مع البحث والتصفية."""
    return admin_service.list_admin_users(
        q=q,
        role=role,
        suspended=suspended,
        limit=limit,
        offset=offset,
    )


@router.patch("/users/{user_id}/suspension")
def admin_update_user_suspension(
    user_id: int,
    payload: AdminUserSuspensionRequest,
    owner: User = Depends(require_platform_owner),
):
    """تعليق أو إعادة تفعيل حساب مستخدم مع إبطال جلسات JWT النشطة فور التعليق."""
    try:
        return admin_service.update_user_suspension(
            user_id=user_id,
            suspended=payload.suspended,
            reason=payload.reason,
            actor_user_id=owner.id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/ai-logs")
def admin_ai_logs(
    task: Optional[str] = Query(None, max_length=80),
    status_filter: Optional[str] = Query(None, alias="status", max_length=40),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _owner: User = Depends(require_platform_owner),
):
    """سجل وزمن استجابة استدعاءات نماذج الذكاء الاصطناعي وحالة Ollama."""
    return admin_service.list_ai_logs(
        task=task,
        status_filter=status_filter,
        limit=limit,
        offset=offset,
    )


@router.get("/prompts")
def admin_list_prompts(_owner: User = Depends(require_platform_owner)):
    """عرض قوالب تعليمات النظام القابلة للضبط في الذكاء الاصطناعي."""
    return {"prompts": admin_service.list_prompt_templates()}


@router.put("/prompts/{prompt_key}")
def admin_update_prompt(
    prompt_key: str,
    payload: AdminPromptUpdateRequest,
    owner: User = Depends(require_platform_owner),
):
    """تحديث تعليمات النظام لقالب محدد مع تطبيق فوري في ذاكرة التخزين."""
    try:
        updated = admin_service.update_prompt_template(
            key=prompt_key,
            system_prompt=payload.system_prompt,
            actor_user_id=owner.id,
        )
        return {"prompt": updated}
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/prompts/{prompt_key}/reset")
def admin_reset_prompt(
    prompt_key: str,
    owner: User = Depends(require_platform_owner),
):
    """استعادة التعليمات الافتراضية لقالب محدد."""
    try:
        reset_item = admin_service.reset_prompt_template(
            key=prompt_key,
            actor_user_id=owner.id,
        )
        return {"prompt": reset_item}
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/support-grants")
def admin_list_support_grants(
    status_filter: Optional[str] = Query(None, alias="status", max_length=40),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _owner: User = Depends(require_platform_owner),
):
    """مراجعة تصاريح الوصول للدعم الفني الصادرة من المستخدمين."""
    return admin_service.list_admin_support_grants(
        status_filter=status_filter,
        limit=limit,
        offset=offset,
    )


@router.post("/support-grants/{grant_id}/revoke")
def admin_revoke_support_grant(
    grant_id: str,
    owner: User = Depends(require_platform_owner),
):
    """إلغاء تصريح دعم فني من قِبل مدير النظام."""
    try:
        grant = admin_service.revoke_support_grant(grant_id, actor_user_id=owner.id)
        return {"detail": "Support grant revoked", "grant": grant}
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
