"""
الواجهة 1 (Login) والواجهة 2 (Register) — القسم 5 من دليل التطوير.
لأسباب أمنية، لا نُميّز في رسالة الخطأ بين "البريد غير موجود" و"كلمة المرور خاطئة" (ملاحظة الباك، الواجهة 1).
"""
from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    bump_user_token_version,
    consume_reset_token_jti,
    create_access_token,
    create_reset_token,
    decode_access_token,
    get_user_token_version,
    hash_password,
    verify_password,
)
from app.models.mysql_models import User
from app.schemas.schemas import (
    ForgotPasswordRequest,
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    RegisterResponse,
    ResetPasswordRequest,
    UserPublic,
)
from app.services.email_notifications import (
    send_login_welcome_email,
    send_password_reset_email,
    send_registration_welcome_email,
)

router = APIRouter(tags=["Authentication"])


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    norm_email = str(payload.email).strip().lower()
    existing = db.query(User).filter(func.lower(User.email) == norm_email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    role_val = getattr(payload, "role", "candidate") or "candidate"
    user = User(
        full_name=payload.full_name,
        email=norm_email,
        hashed_password=hash_password(payload.password),
        role=role_val,
        company_name=getattr(payload, "company_name", None),
        subscription_tier="free",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # إرسال بريد الترحيب بالتسجيل في الخلفية
    background_tasks.add_task(send_registration_welcome_email, user.email, user.full_name)
    return RegisterResponse(
        id=str(user.id),
        full_name=user.full_name,
        email=user.email,
        created_at=user.created_at,
    )


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    norm_email = str(payload.email).strip().lower()
    user = db.query(User).filter(func.lower(User.email) == norm_email).first()
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    token = create_access_token(subject=str(user.id))
    # إرسال إشعار تسجيل الدخول في الخلفية
    background_tasks.add_task(send_login_welcome_email, user.email, user.full_name)
    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user=UserPublic(
            id=str(user.id),
            full_name=user.full_name,
            email=user.email,
            role=getattr(user, "role", "candidate") or "candidate",
            subscription_tier=getattr(user, "subscription_tier", "free") or "free",
            company_name=getattr(user, "company_name", None),
        ),
    )


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
def forgot_password(payload: ForgotPasswordRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    norm_email = str(payload.email).strip().lower()
    user = db.query(User).filter(func.lower(User.email) == norm_email).first()
    if not user:
        # For security reasons, don't reveal that the user does not exist.
        return {"detail": "If an account with that email exists, a password reset link has been sent."}

    token = create_reset_token(subject=str(user.id))
    background_tasks.add_task(send_password_reset_email, user.email, user.full_name, token)

    return {"detail": "If an account with that email exists, a password reset link has been sent."}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    invalid_token_exc = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid or expired password reset token",
    )
    try:
        token_data = decode_access_token(payload.token)
    except HTTPException as exc:
        raise invalid_token_exc from exc

    if token_data.get("type") != "password_reset":
        raise invalid_token_exc

    try:
        parsed_user_id = int(token_data.get("sub"))
    except (TypeError, ValueError) as exc:
        raise invalid_token_exc from exc

    user = db.query(User).filter(User.id == parsed_user_id).first()
    if not user:
        raise invalid_token_exc

    token_jti = token_data.get("jti")
    token_tv = token_data.get("tv")
    if not token_jti or token_tv is None or token_tv != get_user_token_version(user.id):
        raise invalid_token_exc
    if not consume_reset_token_jti(str(token_jti), user.id):
        raise invalid_token_exc

    # Update the password and invalidate all prior JWTs/reset tokens
    user.hashed_password = hash_password(payload.new_password)
    db.add(user)
    db.commit()
    bump_user_token_version(user.id)

    return {"detail": "Password has been reset successfully"}
