"""
الواجهة 1 (Login) والواجهة 2 (Register) — القسم 5 من دليل التطوير.
لأسباب أمنية، لا نُميّز في رسالة الخطأ بين "البريد غير موجود" و"كلمة المرور خاطئة" (ملاحظة الباك، الواجهة 1).
"""
from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.mongo import mongo_db
from app.core.security import (
    bump_user_token_version,
    consume_reset_token_jti,
    create_access_token,
    create_email_verification_token,
    create_reset_token,
    decode_access_token,
    get_current_user,
    get_user_suspension,
    get_user_token_version,
    hash_password,
    oauth2_scheme,
    revoke_token_jti,
    verify_password,
)
from app.models.mysql_models import User
from app.schemas.schemas import (
    ForgotPasswordRequest,
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    RegisterResponse,
    ResendVerificationRequest,
    ResetPasswordRequest,
    UserPublic,
    VerifyEmailRequest,
)
from app.services.email_notifications import (
    send_email_verification_email,
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
        email_verified=False,
        token_version=1,
        role=role_val,
        company_name=getattr(payload, "company_name", None),
        subscription_tier="free",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    verify_token = create_email_verification_token(subject=str(user.id), email=user.email)
    if settings.EMAIL_NOTIFICATIONS_ENABLED:
        background_tasks.add_task(send_email_verification_email, user.email, user.full_name, verify_token)
    background_tasks.add_task(send_registration_welcome_email, user.email, user.full_name)
    return RegisterResponse(
        id=str(user.id),
        full_name=user.full_name,
        email=user.email,
        email_verified=bool(user.email_verified),
        created_at=user.created_at,
    )


@router.post("/verify-email", status_code=status.HTTP_200_OK)
def verify_email(payload: VerifyEmailRequest, db: Session = Depends(get_db)):
    invalid_exc = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid or expired verification token",
    )
    try:
        token_data = decode_access_token(payload.token)
    except HTTPException as exc:
        raise invalid_exc from exc

    if token_data.get("type") != "email_verification":
        raise invalid_exc

    try:
        parsed_user_id = int(token_data.get("sub"))
    except (TypeError, ValueError) as exc:
        raise invalid_exc from exc

    token_email = str(token_data.get("email") or "").strip().lower()
    token_jti = token_data.get("jti")
    token_tv = token_data.get("tv")

    user = db.query(User).filter(User.id == parsed_user_id).first()
    if not user or user.email.strip().lower() != token_email:
        raise invalid_exc
    auth_doc = mongo_db["user_auth_state"].find_one({"_id": parsed_user_id})
    if auth_doc:
        deleted_ts = auth_doc.get("deleted_at_ts")
        token_iat = token_data.get("iat")
        if isinstance(deleted_ts, (int, float)) and isinstance(token_iat, (int, float)) and token_iat <= deleted_ts:
            raise invalid_exc
    if not token_jti or token_tv is None or token_tv != get_user_token_version(user.id, user.token_version):
        raise invalid_exc
    if not consume_reset_token_jti(str(token_jti), user.id):
        raise invalid_exc

    user.email_verified = True
    try:
        db.commit()
    except Exception:
        db.rollback()
        mongo_db["used_reset_tokens"].delete_one({"_id": str(token_jti)})
        raise

    return {"detail": "Email verified successfully", "email_verified": True}


@router.post("/resend-verification", status_code=status.HTTP_200_OK)
def resend_verification(
    payload: ResendVerificationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    norm_email = str(payload.email).strip().lower()
    user = db.query(User).filter(func.lower(User.email) == norm_email).first()
    if user and not getattr(user, "email_verified", False) and settings.EMAIL_NOTIFICATIONS_ENABLED:
        verify_token = create_email_verification_token(subject=str(user.id), email=user.email)
        background_tasks.add_task(send_email_verification_email, user.email, user.full_name, verify_token)
    return {"detail": "If an unverified account with that email exists, a verification link has been sent."}


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    norm_email = str(payload.email).strip().lower()
    user = db.query(User).filter(func.lower(User.email) == norm_email).first()
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    if get_user_suspension(user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is suspended")

    if settings.REQUIRE_EMAIL_VERIFICATION and not getattr(user, "email_verified", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email address before logging in",
        )

    token = create_access_token(subject=str(user.id))
    is_owner = bool(mongo_db["platform_owner"].find_one({"_id": "owner", "user_id": user.id}))
    # إرسال إشعار تسجيل الدخول في الخلفية
    background_tasks.add_task(send_login_welcome_email, user.email, user.full_name)
    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user=UserPublic(
            id=str(user.id),
            full_name=user.full_name,
            email=user.email,
            email_verified=bool(getattr(user, "email_verified", False)),
            role=getattr(user, "role", "candidate") or "candidate",
            subscription_tier=getattr(user, "subscription_tier", "free") or "free",
            company_name=getattr(user, "company_name", None),
            is_platform_owner=is_owner,
        ),
    )


@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(
    token: str | None = Depends(oauth2_scheme),
    current_user: User = Depends(get_current_user),
):
    if token:
        payload = decode_access_token(token)
        revoke_token_jti(payload.get("jti"), current_user.id, payload.get("exp"))
    return {"detail": "Logged out successfully"}


@router.post("/logout-all", status_code=status.HTTP_200_OK)
def logout_all_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account not found")
    new_tv = get_user_token_version(user.id, user.token_version) + 1
    user.token_version = new_tv
    db.commit()
    bump_user_token_version(user.id, min_version=new_tv)
    return {"detail": "All sessions revoked"}


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

    auth_doc = mongo_db["user_auth_state"].find_one({"_id": parsed_user_id})
    if auth_doc:
        deleted_ts = auth_doc.get("deleted_at_ts")
        token_iat = token_data.get("iat")
        if isinstance(deleted_ts, (int, float)) and isinstance(token_iat, (int, float)) and token_iat <= deleted_ts:
            raise invalid_token_exc

    token_jti = token_data.get("jti")
    token_tv = token_data.get("tv")
    current_tv = get_user_token_version(user.id, getattr(user, "token_version", 1))
    if not token_jti or token_tv is None or token_tv != current_tv:
        raise invalid_token_exc
    if not consume_reset_token_jti(str(token_jti), user.id):
        raise invalid_token_exc

    # Atomically update password + token_version in one SQL transaction; roll back consumed JTI on DB failure
    new_tv = current_tv + 1
    user.hashed_password = hash_password(payload.new_password)
    user.token_version = new_tv
    try:
        db.commit()
    except Exception:
        db.rollback()
        mongo_db["used_reset_tokens"].delete_one({"_id": str(token_jti)})
        raise

    try:
        bump_user_token_version(user.id, min_version=new_tv)
    except Exception:
        pass

    return {"detail": "Password has been reset successfully"}
