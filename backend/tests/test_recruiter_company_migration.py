import uuid

import mongomock
import pytest

from app.core.database import SessionLocal
from app.models.mysql_models import User
from scripts.migrate_recruiter_companies import migrate


def test_migration_is_repeatable_and_preserves_data():
    mongo = mongomock.MongoClient().db
    with SessionLocal() as db:
        user = User(full_name="Legacy", email=f"legacy-{uuid.uuid4().hex}@example.com", hashed_password="unused")
        db.add(user)
        db.commit()
        mongo.recruiter_approvals.insert_one({"_id": user.id, "approved": True})
        mongo.recruiter_jobs.insert_one({"job_id": "job", "recruiter_id": user.id, "title": "Engineer"})
        mongo.recruitment_pipeline.insert_one({"job_id": "job", "candidate_id": "candidate", "notes": "keep"})
        assert migrate(db, mongo)["jobs"] == 1
        assert mongo.companies.count_documents({}) == 0
        migrate(db, mongo, apply=True)
        migrate(db, mongo, apply=True)
        company_id = f"legacy-{user.id}"
        assert mongo.companies.find_one({"company_id": company_id})["status"] == "pending"
        assert mongo.recruiter_jobs.find_one({"job_id": "job"})["company_id"] == company_id
        pipeline = mongo.recruitment_pipeline.find_one({"job_id": "job"})
        assert pipeline["company_id"] == company_id and pipeline["notes"] == "keep"
        mongo.recruitment_pipeline.insert_one({"job_id": "missing"})
        with pytest.raises(ValueError, match="missing job"):
            migrate(db, mongo, apply=True)
