"""Record the initial platform owner using an existing account.

Run on the server: python -m scripts.bootstrap_platform_owner EMAIL
"""
import argparse
from datetime import datetime, timezone

from pymongo.errors import DuplicateKeyError
from sqlalchemy import func

from app.core.database import SessionLocal
from app.core.mongo import mongo_db
from app.models.mysql_models import User


def bootstrap_owner(db, owners, email):
    user = db.query(User).filter(func.lower(User.email) == email.strip().lower()).first()
    if user is None:
        raise ValueError("User not found")
    try:
        owners.insert_one({"_id": "owner", "user_id": user.id, "created_at": datetime.now(timezone.utc)})
    except DuplicateKeyError:
        if owners.find_one({"_id": "owner", "user_id": user.id}) is None:
            raise ValueError("A different platform owner is already configured")
    return user.id


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("email")
    args = parser.parse_args()
    with SessionLocal() as db:
        try:
            bootstrap_owner(db, mongo_db["platform_owner"], args.email)
        except ValueError as exc:
            parser.error(str(exc))
    print("Platform owner recorded")


if __name__ == "__main__":
    main()
