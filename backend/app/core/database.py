"""
اتصال قاعدة البيانات العلائقية (MySQL) عبر SQLAlchemy.
يدعم أيضاً وضع SQLite كبديل للتطوير المحلي أو الاختبار السريع بدون خادم MySQL.
"""
from __future__ import annotations

from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings

if settings.SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False, "timeout": 15}
    engine = create_engine(
        settings.SQLALCHEMY_DATABASE_URL,
        connect_args=connect_args,
        pool_pre_ping=True,
    )

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA synchronous=NORMAL")
            cursor.execute("PRAGMA busy_timeout=5000")
        except Exception:
            pass
        finally:
            cursor.close()
else:
    engine = create_engine(
        settings.SQLALCHEMY_DATABASE_URL,
        pool_pre_ping=True,
        pool_size=25,
        max_overflow=50,
        pool_timeout=30,
        pool_recycle=1800,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, expire_on_commit=False)

Base = declarative_base()


def get_db():
    """Dependency لحقن جلسة قاعدة بيانات في كل route يحتاج تعاملاً مباشراً مع MySQL."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """إنشاء كل الجداول إذا لم تكن موجودة."""
    from app.models import mysql_models  # noqa: F401  ensures models are registered

    Base.metadata.create_all(bind=engine)
