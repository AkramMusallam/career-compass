import os
import shutil
import sys
import tempfile
from pathlib import Path

_TEST_DB_PATH = Path(__file__).resolve().parent / "test_career_compass.db"
_TEST_UPLOAD_DIR = Path(tempfile.mkdtemp(prefix="career_compass_test_uploads_"))

# يجب ضبط متغيرات البيئة قبل استيراد أي وحدة من app.* لأن app.config يقرأها عند الاستيراد
os.environ["ENV"] = "testing"
os.environ["USE_SQLITE_FALLBACK"] = "1"
os.environ["SQLITE_PATH"] = str(_TEST_DB_PATH)
os.environ["UPLOAD_DIR"] = str(_TEST_UPLOAD_DIR)
os.environ["USE_MONGOMOCK"] = "1"
os.environ["JWT_SECRET_KEY"] = "test-secret-key"
os.environ["CELERY_TASK_ALWAYS_EAGER"] = "1"
os.environ["EMAIL_NOTIFICATIONS_ENABLED"] = "0"

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from fastapi.testclient import TestClient

from app.core.database import Base, engine
from app.main import app
from app.seed.seed_runner import run_seed


@pytest.fixture(scope="session", autouse=True)
def _setup_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    run_seed()
    yield
    engine.dispose()
    for suffix in ("", "-wal", "-shm"):
        Path(f"{_TEST_DB_PATH}{suffix}").unlink(missing_ok=True)
    shutil.rmtree(_TEST_UPLOAD_DIR, ignore_errors=True)


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
