"""Company applications, team membership, and platform-owner review."""
import hashlib
import html
import secrets
from datetime import datetime, timedelta, timezone
from typing import Literal
from urllib.parse import urlsplit
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.mongo import mongo_db
from app.core.security import get_current_user
from app.models.mysql_models import User
from app.services.email_notifications import send_email

router = APIRouter(prefix="/companies", tags=["Companies"])


class CompanyRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("Company name is required")
        return value


class CompanyStatus(BaseModel):
    status: Literal["approved", "rejected", "suspended"]


class InvitationRequest(BaseModel):
    email: EmailStr


class InvitationAcceptance(BaseModel):
    token: str = Field(min_length=1, max_length=200)


def require_platform_owner(user: User = Depends(get_current_user)) -> User:
    if not mongo_db["platform_owner"].find_one({"_id": "owner", "user_id": user.id}):
        raise HTTPException(status_code=403, detail="Platform owner access required")
    return user


def public_company(company):
    return {key: value for key, value in company.items() if key not in {"_id", "invitations"}}


@router.post("", status_code=201)
def request_company(payload: CompanyRequest, user: User = Depends(get_current_user)):
    company = {
        "company_id": str(uuid4()),
        "name": payload.name,
        "owner_id": user.id,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    mongo_db["companies"].insert_one(company)
    return public_company(company)


@router.get("/mine")
def my_companies(user: User = Depends(get_current_user)):
    return [public_company(company) for company in mongo_db["companies"].find({"$or": [{"owner_id": user.id}, {"members": user.id}]})]


@router.get("/review")
def review_companies(user: User = Depends(require_platform_owner)):
    return [public_company(company) for company in mongo_db["companies"].find()]


@router.post("/invitations/accept")
def accept_invitation(payload: InvitationAcceptance, user: User = Depends(get_current_user)):
    token_hash = hashlib.sha256(payload.token.encode()).hexdigest()
    match = {"token_hash": token_hash, "email": user.email.strip().lower(),
             "expires_at": {"$gt": datetime.now(timezone.utc).isoformat()}, "delivery": {"$in": ["sending", "sent"]}}
    company = mongo_db["companies"].find_one_and_update(
        {"status": "approved", "invitations": {"$elemMatch": match}},
        {"$addToSet": {"members": user.id}, "$pull": {"invitations": {"token_hash": token_hash}}},
        return_document=True,
    )
    if not company:
        raise HTTPException(status_code=404, detail="Invitation is invalid or expired")
    return public_company(company)


@router.post("/{company_id}/invitations", status_code=201)
def invite_member(company_id: str, payload: InvitationRequest, user: User = Depends(get_current_user)):
    company = mongo_db["companies"].find_one({"company_id": company_id, "owner_id": user.id, "status": "approved"})
    if not company:
        raise HTTPException(status_code=404, detail="Approved company not found")
    if settings.ENV == "production" and urlsplit(settings.FRONTEND_BASE_URL).scheme != "https":
        raise HTTPException(status_code=503, detail="HTTPS must be configured before sending invitations")
    email = str(payload.email).strip().lower()
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    url = f"{settings.FRONTEND_BASE_URL.rstrip('/')}/company-invitation/{token}"
    text = f"You have been invited to join {company['name']} on Career Compass. Open {url} within 7 days."
    invitation = {"token_hash": token_hash, "email": email,
                  "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
                  "delivery": "sending"}
    result = mongo_db["companies"].update_one(
        {"company_id": company_id, "owner_id": user.id, "status": "approved"},
        {"$push": {"invitations": invitation}},
    )
    if not result.matched_count:
        raise HTTPException(status_code=409, detail="Company status changed")
    body = f"<p>{html.escape(company['name'])}</p><p><a href=\"{html.escape(url, quote=True)}\">Accept invitation</a></p>"
    sent = settings.EMAIL_NOTIFICATIONS_ENABLED and send_email(email, "Career Compass invitation", body, text)
    delivery = "sent" if sent else "failed"
    mongo_db["companies"].update_one(
        {"company_id": company_id, "invitations.token_hash": token_hash},
        {"$set": {"invitations.$.delivery": delivery}},
    )
    return {"email": email, "delivery": delivery, "expires_at": invitation["expires_at"]}


@router.get("/{company_id}/invitations")
def list_invitations(company_id: str, user: User = Depends(get_current_user)):
    company = mongo_db["companies"].find_one({"company_id": company_id, "owner_id": user.id})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return [{key: value for key, value in invitation.items() if key != "token_hash"}
            for invitation in company.get("invitations", [])]


@router.put("/{company_id}")
def update_company(company_id: str, payload: CompanyRequest, user: User = Depends(get_current_user)):
    company = mongo_db["companies"].find_one_and_update(
        {"company_id": company_id, "owner_id": user.id}, {"$set": {"name": payload.name}}, return_document=True,
    )
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    mongo_db["recruiter_jobs"].update_many({"company_id": company_id}, {"$set": {"company_name": payload.name}})
    return public_company(company)


@router.delete("/{company_id}/members/{member_id}")
def remove_member(company_id: str, member_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    member = db.query(User).filter(User.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Company member not found")
    result = mongo_db["companies"].update_one(
        {"company_id": company_id, "owner_id": user.id, "members": member_id},
        {"$pull": {"members": member_id, "invitations": {"email": member.email.strip().lower()}}},
    )
    if not result.modified_count:
        raise HTTPException(status_code=404, detail="Company member not found")
    return {"detail": "Member removed"}


@router.patch("/{company_id}/status")
def set_company_status(company_id: str, payload: CompanyStatus, user: User = Depends(require_platform_owner)):
    company = mongo_db["companies"].find_one_and_update(
        {"company_id": company_id},
        {"$set": {"status": payload.status, "reviewed_by": user.id,
                  "reviewed_at": datetime.now(timezone.utc).isoformat()}},
        return_document=True,
    )
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return public_company(company)
