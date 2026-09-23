import os
import sys
from pathlib import Path

# يجب ضبط متغيرات البيئة قبل استيراد أي وحدة من app.* لأن app.config يقرأها عند الاستيراد
os.environ["ENV"] = "testing"
os.environ["USE_SQLITE_FALLBACK"] = "1"
os.environ["SQLITE_PATH"] = str(Path(__file__).resolve().parent / "test_career_compass.db")
os.environ["USE_MONGOMOCK"] = "1"
os.environ["JWT_SECRET_KEY"] = "test-secret-key"

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from fastapi.testclient import TestClient

from app.database import Base, engine
from app.main import app
from app.seed.seed_runner import run_seed


@pytest.fixture(scope="session", autouse=True)
def _setup_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    run_seed()
    yield


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def registered_user_token(client):
    import uuid

    email = f"test.user.{uuid.uuid4().hex[:8]}@example.com"
    client.post(
        "/register",
        json={"full_name": "Test User", "email": email, "password": "Passw0rd123"},
    )
    resp = client.post("/login", json={"email": email, "password": "Passw0rd123"})
    token = resp.json()["access_token"]
    return token, email
