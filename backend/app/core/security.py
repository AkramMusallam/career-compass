"""
أدوات الأمان: تجزئة كلمات المرور (bcrypt) وإصدار/فحص JWT Tokens.
"""
from __future__ import annotations

import uuid
import warnings
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

warnings.filterwarnings("ignore", category=DeprecationWarning, module=r"jose\.jwt")
from jose import JWTError, jwt
import bcrypt

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.mongo import mongo_db
from app.models.mysql_models import User

# tokenUrl فقط للتوثيق التفاعلي (Swagger)؛ الفرونت يستخدم /login مباشرة عبر JSON.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login", auto_error=False)
_RESERVED_JWT_CLAIMS = {"sub", "type", "iat", "exp", "jti", "tv"}


def get_user_token_version(user_id: int) -> int:
    """Fetches current per-user JWT token version from MongoDB (default 1)."""
    doc = mongo_db["user_auth_state"].find_one({"_id": int(user_id)}, {"token_version": 1})
    return int(doc.get("token_version", 1)) if doc else 1


def bump_user_token_version(user_id: int) -> int:
    """Atomically increments a user's token version to invalidate all prior JWTs."""
    uid = int(user_id)
    mongo_db["user_auth_state"].update_one({"_id": uid}, {"$setOnInsert": {"token_version": 1}}, upsert=True)
    doc = mongo_db["user_auth_state"].find_one_and_update(
        {"_id": uid},
        {"$inc": {"token_version": 1}},
        return_document=True,
    )
    return int(doc.get("token_version", 2)) if doc else 2


def consume_reset_token_jti(jti: str, user_id: int) -> bool:
    """Records a password reset token jti as used; returns False if already consumed."""
    if not jti:
        return False
    try:
        mongo_db["used_reset_tokens"].insert_one(
            {"_id": str(jti), "user_id": int(user_id), "used_at": datetime.now(timezone.utc)}
        )
        return True
    except Exception:
        return False


def _token_version_for_subject(subject: str) -> int:
    try:
        return get_user_token_version(int(subject))
    except (TypeError, ValueError):
        return 1


def hash_password(plain_password: str) -> str:
    # Hash a password for the first time
    # (Using bcrypt, the salt is saved into the hash itself)
    pwd_bytes = plain_password.encode("utf-8")
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(pwd_bytes, salt)
    return hashed_password.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    # Check hashed password. Using bcrypt, the salt is extracted from the hash.
    pwd_bytes = plain_password.encode("utf-8")
    hashed_bytes = hashed_password.encode("utf-8")
    try:
        return bcrypt.checkpw(pwd_bytes, hashed_bytes)
    except ValueError:
        return False


def create_access_token(
    subject: str,
    extra_claims: Optional[dict] = None,
    password_hash: Optional[str] = None,  # Deprecated/ignored: never embed password hashes in JWTs
) -> str:
    del password_hash
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    to_encode: dict = {}
    if extra_claims:
        to_encode.update({k: v for k, v in extra_claims.items() if k not in _RESERVED_JWT_CLAIMS})
    to_encode.update(
        {
            "sub": subject,
            "type": "access",
            "iat": now,
            "exp": expire,
            "jti": str(uuid.uuid4()),
            "tv": _token_version_for_subject(subject),
        }
    )
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_reset_token(
    subject: str,
    password_hash: Optional[str] = None,  # Deprecated/ignored: never embed password hashes in JWTs
) -> str:
    del password_hash
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=15)
    to_encode = {
        "sub": subject,
        "type": "password_reset",
        "iat": now,
        "exp": expire,
        "jti": str(uuid.uuid4()),
        "tv": _token_version_for_subject(subject),
    }
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
) -> User:
    """Dependency موحّد (Middleware) يُستخدم في كل الـ routes المحمية للتحقق من JWT.

    ملاحظة أداء حرجة: يفتح جلسة قاعدة بيانات قصيرة جداً لجلب المستخدم وفحص التوكن ثم يغلقها
    فوراً (خلال <2ms) عبر `with SessionLocal() as db:` بدلاً من إبقاء الاتصال محجوزاً طوال
    فترة تنفيذ الطلب (كطلبات الذكاء الاصطناعي أو توليد ملفات PDF)، مما يمنع استنزاف QueuePool.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if token is None:
        raise credentials_exception

    payload = decode_access_token(token)
    if payload.get("type") != "access":
        raise credentials_exception
    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    try:
        parsed_user_id = int(user_id)
    except (TypeError, ValueError) as exc:
        raise credentials_exception from exc

    token_tv = payload.get("tv")
    if token_tv is None or token_tv != get_user_token_version(parsed_user_id):
        raise credentials_exception

    with SessionLocal() as db:
        user = db.query(User).filter(User.id == parsed_user_id).first()
        if user is None:
            raise credentials_exception
        db.expunge(user)
        return user
