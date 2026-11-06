"""Time-limited, documented support access to a candidate profile."""
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.api.routes.companies import require_platform_owner
from app.core.database import get_db
from app.core.mongo import mongo_db
from app.core.security import get_current_user
from app.models.mysql_models import User

router = APIRouter(prefix="/support", tags=["Support access"])


class SupportGrantRequest(BaseModel):
    candidate_id: str = Field(min_length=1, max_length=200)
    reason: str = Field(min_length=3, max_length=500)
    consent_evidence: str = Field(min_length=10, max_length=1000)
    hours: int = Field(ge=1, le=24)

    @field_validator("candidate_id", "reason", "consent_evidence")
    @classmethod
    def non_blank(cls, value, info):
        value = value.strip()
        minimum = {"candidate_id": 1, "reason": 3, "consent_evidence": 10}[info.field_name]
        if len(value) < minimum:
            raise ValueError("Value cannot be blank")
        return value


def public_grant(grant):
    return {key: value for key, value in grant.items() if key != "_id"}


@router.get("/my-profiles")
def my_profiles(user: User = Depends(get_current_user)):
    return [{"candidate_id": doc["extraction_id"], "target_role": doc.get("target_role")}
            for doc in mongo_db["extractions"].find({"user_id": user.id}, {"extraction_id": 1, "target_role": 1})
            if doc.get("extraction_id")]


@router.post("/grants", status_code=201)
def grant_support(payload: SupportGrantRequest, user: User = Depends(require_platform_owner)):
    extraction = mongo_db["extractions"].find_one({"extraction_id": payload.candidate_id})
    if not extraction or not isinstance(extraction.get("user_id"), int):
        raise HTTPException(status_code=404, detail="Candidate profile not found")
    now = datetime.now(timezone.utc)
    grant = {"grant_id": str(uuid4()), "candidate_id": payload.candidate_id,
             "candidate_user_id": extraction["user_id"], "owner_id": user.id,
             "reason": payload.reason, "consent_evidence": payload.consent_evidence,
             "created_at": now.isoformat(), "expires_at": (now + timedelta(hours=payload.hours)).isoformat(),
             "revoked": False}
    mongo_db["support_grants"].insert_one(grant)
    return public_grant(grant)


@router.get("/grants/mine")
def my_grants(user: User = Depends(get_current_user)):
    return [public_grant(grant) for grant in mongo_db["support_grants"].find({"candidate_user_id": user.id})]


@router.get("/grants")
def owner_grants(user: User = Depends(require_platform_owner)):
    return [public_grant(grant) for grant in mongo_db["support_grants"].find({"owner_id": user.id})]


@router.get("/grants/{grant_id}/access-log")
def grant_access_log(grant_id: str, user: User = Depends(get_current_user)):
    grant = mongo_db["support_grants"].find_one({"grant_id": grant_id})
    is_owner = mongo_db["platform_owner"].find_one({"_id": "owner", "user_id": user.id})
    if not grant or (grant["candidate_user_id"] != user.id and not is_owner):
        raise HTTPException(status_code=404, detail="Support grant not found")
    return [public_grant(record) for record in mongo_db["support_access_log"].find({"grant_id": grant_id})]


@router.delete("/grants/{grant_id}")
def revoke_grant(grant_id: str, user: User = Depends(get_current_user)):
    is_owner = bool(mongo_db["platform_owner"].find_one({"_id": "owner", "user_id": user.id}))
    query = {"grant_id": grant_id}
    if not is_owner:
        query["candidate_user_id"] = user.id
    grant = mongo_db["support_grants"].find_one_and_update(
        query, {"$set": {"revoked": True, "revoked_by": user.id,
                         "revoked_at": datetime.now(timezone.utc).isoformat()}}, return_document=True,
    )
    if not grant:
        raise HTTPException(status_code=404, detail="Support grant not found")
    return public_grant(grant)


@router.get("/grants/{grant_id}/profile")
def support_profile(grant_id: str, owner: User = Depends(require_platform_owner), db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc).isoformat()
    grant = mongo_db["support_grants"].find_one({"grant_id": grant_id, "owner_id": owner.id,
                                                 "revoked": False, "expires_at": {"$gt": now}})
    if not grant:
        raise HTTPException(status_code=404, detail="Active support grant not found")
    extraction = mongo_db["extractions"].find_one({"extraction_id": grant["candidate_id"], "user_id": grant["candidate_user_id"]})
    candidate = db.query(User).filter(User.id == grant["candidate_user_id"]).first()
    if not extraction or not candidate:
        raise HTTPException(status_code=404, detail="Candidate profile not found")
    mongo_db["support_access_log"].insert_one({"grant_id": grant_id, "owner_id": owner.id,
                                                "candidate_user_id": candidate.id, "candidate_id": grant["candidate_id"],
                                                "reason": grant["reason"], "accessed_at": now})
    return {"candidate_id": grant["candidate_id"], "user_id": candidate.id, "full_name": candidate.full_name,
            "email": candidate.email, "target_role": extraction.get("target_role"), "skills": extraction.get("skills", []),
            "experience": extraction.get("experience", []), "projects": extraction.get("projects", []),
            "education": extraction.get("education", [])}
