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
_RESERVED_JWT_CLAIMS = {"sub", "type", "iat", "exp", "jti", "tv", "scope"}


def _get_sql_token_version(user_id: int) -> int:
    try:
        with SessionLocal() as db:
            row = db.query(User.token_version).filter(User.id == int(user_id)).first()
            if row and row[0] is not None:
                return int(row[0])
    except Exception:
        pass
    return 1


def get_user_token_version(user_id: int, sql_token_version: Optional[int] = None) -> int:
    """Fetches current authoritative per-user JWT token version across SQL and MongoDB."""
    doc = mongo_db["user_auth_state"].find_one({"_id": int(user_id)}, {"token_version": 1})
    mongo_tv = int(doc.get("token_version", 1)) if doc else 1
    sql_tv = int(sql_token_version) if sql_token_version is not None else _get_sql_token_version(user_id)
    return max(1, mongo_tv, sql_tv)


def bump_user_token_version(user_id: int, min_version: Optional[int] = None) -> int:
    """Atomically increments a user's token version to invalidate all prior JWTs."""
    uid = int(user_id)
    mongo_db["user_auth_state"].update_one({"_id": uid}, {"$setOnInsert": {"token_version": 1}}, upsert=True)
    doc = mongo_db["user_auth_state"].find_one_and_update(
        {"_id": uid},
        {"$inc": {"token_version": 1}},
        return_document=True,
    )
    current = int(doc.get("token_version", 2)) if doc else 2
    if min_version is not None and current < int(min_version):
        mongo_db["user_auth_state"].update_one({"_id": uid}, {"$set": {"token_version": int(min_version)}})
        return int(min_version)
    return current


def revoke_token_jti(jti: Optional[str], user_id: int, exp: Optional[int | float] = None) -> None:
    """Records a JWT jti as revoked until its natural expiration."""
    if not jti:
        return
    if isinstance(exp, (int, float)):
        expires_at = datetime.fromtimestamp(exp, tz=timezone.utc)
    else:
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=max(settings.JWT_EXPIRE_MINUTES, 60))
    mongo_db["revoked_tokens"].update_one(
        {"_id": str(jti)},
        {"$set": {"user_id": int(user_id), "revoked_at": datetime.now(timezone.utc), "expires_at": expires_at}},
        upsert=True,
    )


def is_token_jti_revoked(jti: Optional[str]) -> bool:
    if not jti:
        return False
    return mongo_db["revoked_tokens"].find_one({"_id": str(jti)}) is not None


def mark_user_deleted_auth_state(user_id: int) -> None:
    """Invalidates all prior tokens for a deleted user ID, guarding against SQLite ID reuse."""
    uid = int(user_id)
    now_ts = datetime.now(timezone.utc).timestamp()
    bump_user_token_version(uid)
    mongo_db["user_auth_state"].update_one(
        {"_id": uid},
        {"$set": {"deleted_at_ts": now_ts, "suspended": False}},
        upsert=True,
    )


def get_user_suspension(user_id: int) -> Optional[dict]:
    """Returns active suspension record from MongoDB user_auth_state if user is suspended."""
    doc = mongo_db["user_auth_state"].find_one({"_id": int(user_id)})
    if doc and doc.get("suspended") is True:
        return doc
    return None


def set_user_suspension(
    user_id: int,
    suspended: bool,
    reason: Optional[str] = None,
    actor_id: Optional[int] = None,
) -> dict:
    """Suspends or reactivates a user account in MongoDB and revokes active JWTs when suspended."""
    uid = int(user_id)
    now_iso = datetime.now(timezone.utc).isoformat()
    mongo_db["user_auth_state"].update_one(
        {"_id": uid},
        {
            "$set": {
                "suspended": bool(suspended),
                "suspended_reason": (reason or "").strip()[:300] if suspended else None,
                "suspended_at": now_iso if suspended else None,
                "updated_by": actor_id,
                "updated_at": now_iso,
            },
            "$setOnInsert": {"token_version": 1},
        },
        upsert=True,
    )
    if suspended:
        bump_user_token_version(uid)
    doc = mongo_db["user_auth_state"].find_one({"_id": uid}) or {}
    return {
        "user_id": uid,
        "suspended": bool(doc.get("suspended", False)),
        "suspended_reason": doc.get("suspended_reason"),
        "suspended_at": doc.get("suspended_at"),
    }


def consume_reset_token_jti(jti: str, user_id: int) -> bool:
    """Records a single-use token jti as used; returns False if already consumed."""
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
    if len(pwd_bytes) > 72:
        raise ValueError("Password exceeds bcrypt 72-byte maximum length")
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(pwd_bytes, salt)
    return hashed_password.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    # Check hashed password. Using bcrypt, the salt is extracted from the hash.
    pwd_bytes = plain_password.encode("utf-8")
    if len(pwd_bytes) > 72:
        return False
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


def create_extension_token(
    subject: str,
    origin: Optional[str] = None,
) -> str:
    """Issues a short-lived, match-only token strictly scoped to Chrome extension job matching."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.EXTENSION_TOKEN_EXPIRE_MINUTES)
    to_encode: dict = {
        "sub": subject,
        "type": "extension_match",
        "scope": "extension:match",
        "iat": now,
        "exp": expire,
        "jti": str(uuid.uuid4()),
        "tv": _token_version_for_subject(subject),
    }
    if origin:
        to_encode["origin"] = origin
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_email_verification_token(subject: str, email: str) -> str:
    """Issues a single-use 24-hour token proving mailbox ownership."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(hours=24)
    to_encode = {
        "sub": subject,
        "type": "email_verification",
        "email": email.strip().lower(),
        "iat": now,
        "exp": expire,
        "jti": str(uuid.uuid4()),
        "tv": _token_version_for_subject(subject),
    }
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


def _validate_token_for_user(token: Optional[str], expected_type: str, required_scope: Optional[str] = None) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if token is None:
        raise credentials_exception

    payload = decode_access_token(token)
    if payload.get("type") != expected_type:
        raise credentials_exception
    if required_scope and payload.get("scope") != required_scope:
        raise credentials_exception
    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    try:
        parsed_user_id = int(user_id)
    except (TypeError, ValueError) as exc:
        raise credentials_exception from exc

    if is_token_jti_revoked(payload.get("jti")):
        raise credentials_exception

    auth_doc = mongo_db["user_auth_state"].find_one({"_id": parsed_user_id})
    if auth_doc:
        deleted_ts = auth_doc.get("deleted_at_ts")
        token_iat = payload.get("iat")
        if isinstance(deleted_ts, (int, float)) and isinstance(token_iat, (int, float)) and token_iat <= deleted_ts:
            raise credentials_exception

    with SessionLocal() as db:
        user = db.query(User).filter(User.id == parsed_user_id).first()
        if user is None:
            raise credentials_exception
        token_tv = payload.get("tv")
        effective_tv = get_user_token_version(parsed_user_id, sql_token_version=getattr(user, "token_version", 1))
        if token_tv is None or token_tv != effective_tv:
            raise credentials_exception
        if auth_doc and auth_doc.get("suspended") is True:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is suspended",
            )
        db.expunge(user)
        return user


def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
) -> User:
    """Dependency موحّد (Middleware) يُستخدم في كل الـ routes المحمية للتحقق من JWT."""
    return _validate_token_for_user(token, expected_type="access")


def get_extension_user(
    token: Optional[str] = Depends(oauth2_scheme),
) -> User:
    """Dependency محدود النطاق لمطابقة الوظائف عبر إضافة Chrome فقط."""
    return _validate_token_for_user(token, expected_type="extension_match", required_scope="extension:match")
