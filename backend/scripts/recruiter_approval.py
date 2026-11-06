"""Approve or revoke recruiter access after an administrator verifies the company."""
import argparse

from sqlalchemy import func

from app.core.database import SessionLocal
from app.core.mongo import mongo_db
from app.models.mysql_models import User


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("email")
    parser.add_argument("action", choices=("approve", "revoke"))
    args = parser.parse_args()
    with SessionLocal() as db:
        user = db.query(User).filter(func.lower(User.email) == args.email.strip().lower()).first()
        if user is None:
            parser.error("User not found")
        companies = list(mongo_db["companies"].find({"owner_id": user.id}))
        if len(companies) != 1:
            parser.error("Account must own exactly one company; use the platform dashboard otherwise")
        mongo_db["companies"].update_one(
            {"_id": companies[0]["_id"]}, {"$set": {"status": "approved" if args.action == "approve" else "suspended"}}
        )
    print(f"Recruiter access: {args.action}")


if __name__ == "__main__":
    main()
