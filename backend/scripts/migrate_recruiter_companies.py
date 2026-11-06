"""Move legacy recruiter records into pending companies. Stop application writes first.

Dry run: python -m scripts.migrate_recruiter_companies
Apply:   python -m scripts.migrate_recruiter_companies --apply
Back up both databases before applying. Re-running after interruption is safe.
"""
import argparse
from datetime import datetime, timezone

from app.core.database import SessionLocal
from app.core.mongo import mongo_db
from app.models.mysql_models import User


def migrate(db, mongo, apply=False):
    jobs = list(mongo["recruiter_jobs"].find({"company_id": {"$exists": False}}))
    pipelines = list(mongo["recruitment_pipeline"].find({"company_id": {"$exists": False}}))
    approvals = list(mongo["recruiter_approvals"].find())
    job_documents = list(mongo["recruiter_jobs"].find())
    all_jobs = {job["job_id"]: job for job in job_documents if job.get("job_id")}
    if len(all_jobs) != len(job_documents):
        raise ValueError("Jobs have missing or duplicate IDs")
    if any(not job.get("job_id") or not isinstance(job.get("recruiter_id"), int) for job in jobs):
        raise ValueError("Legacy job has no valid job or recruiter ID")
    if any(pipeline.get("job_id") not in all_jobs for pipeline in pipelines):
        raise ValueError("Pipeline record references a missing job")
    if any(not isinstance(record.get("_id"), int) for record in approvals):
        raise ValueError("Recruiter approval has an invalid user ID")
    owner_ids = {job["recruiter_id"] for job in jobs}
    owner_ids.update(record["_id"] for record in approvals)
    owner_ids.update(user.id for user in db.query(User).filter(User.role == "recruiter").all()
                     if not mongo["companies"].find_one({"owner_id": user.id}))
    users = {user.id: user for user in db.query(User).filter(User.id.in_(owner_ids)).all()}
    if owner_ids - users.keys():
        raise ValueError("Legacy records reference missing user accounts")
    for owner_id in owner_ids:
        existing = mongo["companies"].find_one({"company_id": f"legacy-{owner_id}"})
        if existing and existing.get("owner_id") != owner_id:
            raise ValueError("Legacy company ID belongs to another account")
    if apply:
        for owner_id in owner_ids:
            user = users[owner_id]
            mongo["companies"].update_one(
                {"company_id": f"legacy-{owner_id}"},
                {"$setOnInsert": {"owner_id": owner_id, "name": user.company_name or user.full_name,
                                  "status": "pending", "created_at": datetime.now(timezone.utc).isoformat()}},
                upsert=True,
            )
        for job in jobs:
            mongo["recruiter_jobs"].update_one({"_id": job["_id"], "company_id": {"$exists": False}},
                                               {"$set": {"company_id": f"legacy-{job['recruiter_id']}"}})
        for pipeline in pipelines:
            job = all_jobs[pipeline["job_id"]]
            company_id = job.get("company_id") or f"legacy-{job['recruiter_id']}"
            mongo["recruitment_pipeline"].update_one({"_id": pipeline["_id"], "company_id": {"$exists": False}},
                                                      {"$set": {"company_id": company_id}})
    return {"companies": len(owner_ids), "jobs": len(jobs), "pipelines": len(pipelines)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    with SessionLocal() as db:
        try:
            result = migrate(db, mongo_db, apply=args.apply)
        except ValueError as exc:
            parser.error(str(exc))
    print(("Applied: " if args.apply else "Dry run: ") + str(result))


if __name__ == "__main__":
    main()
