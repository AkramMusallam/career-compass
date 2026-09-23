"""
الواجهة 1 (Login) والواجهة 2 (Register) — القسم 5 من دليل التطوير.
لأسباب أمنية، لا نُميّز في رسالة الخطأ بين "البريد غير موجود" و"كلمة المرور خاطئة" (ملاحظة الباك، الواجهة 1).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.mysql_models import User
from app.schemas.schemas import LoginRequest, LoginResponse, RegisterRequest, RegisterResponse, UserPublic
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(tags=["Authentication"])


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        full_name=payload.full_name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # ... OrO_U.Oc O U,OU,UOOU^U+US ...
    background_tasks.add_task(send_registration_welcome_email, user.email, user.full_name)
    return RegisterResponse(
        id=str(user.id),
        full_name=user.full_name,
        email=user.email,
        created_at=user.created_at,
    )


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    token = create_access_token(subject=str(user.id))
    # ... OrO_U.Oc O U,OU,UOOU^U+US ...
    background_tasks.add_task(send_login_welcome_email, user.email, user.full_name)
    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user=UserPublic(id=str(user.id), full_name=user.full_name, email=user.email),
    )


from app.schemas.schemas import ForgotPasswordRequest, ResetPasswordRequest
from app.security import create_reset_token, decode_access_token
from app.services.email_notifications import send_password_reset_email, send_login_welcome_email, send_registration_welcome_email

@router.post("/forgot-password", status_code=status.HTTP_200_OK)
def forgot_password(payload: ForgotPasswordRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        # For security reasons, don't reveal that the user does not exist.
        return {"detail": "If an account with that email exists, a password reset link has been sent."}

    token = create_reset_token(subject=str(user.id))
    background_tasks.add_task(send_password_reset_email, user.email, user.full_name, token)
    
    return {"detail": "If an account with that email exists, a password reset link has been sent."}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    try:
        # Decode the token, this will automatically verify expiration
        token_data = decode_access_token(payload.token)
        if token_data.get("type") != "password_reset":
            raise ValueError("Invalid token type")
        
        user_id = token_data.get("sub")
        user = db.query(User).filter(User.id == int(user_id)).first()
        if not user:
            raise ValueError("User not found")

        # Update the password
        user.hashed_password = hash_password(payload.new_password)
        db.add(user)
        db.commit()

        return {"detail": "Password has been reset successfully"}
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Invalid or expired password reset token"
        )

