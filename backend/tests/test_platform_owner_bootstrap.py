import uuid

import mongomock
import pytest

from app.core.database import SessionLocal
from app.models.mysql_models import User
from scripts.bootstrap_platform_owner import bootstrap_owner


def test_owner_bootstrap_is_singleton_and_requires_existing_user():
    owners = mongomock.MongoClient().db.platform_owner
    with SessionLocal() as db:
        email = f"owner-{uuid.uuid4().hex}@example.com"
        user = User(full_name="Owner", email=email, hashed_password="unused")
        other = User(full_name="Other", email=f"other-{uuid.uuid4().hex}@example.com", hashed_password="unused")
        db.add_all([user, other])
        db.commit()
        with pytest.raises(ValueError, match="User not found"):
            bootstrap_owner(db, owners, "missing@example.com")
        assert bootstrap_owner(db, owners, email.upper()) == user.id
        assert bootstrap_owner(db, owners, email) == user.id
        with pytest.raises(ValueError, match="different platform owner"):
            bootstrap_owner(db, owners, other.email)
        assert owners.find_one({"_id": "owner"})["user_id"] == user.id
