"""
اتصال قاعدة البيانات العلائقية (MySQL) عبر SQLAlchemy.
يدعم أيضاً وضع SQLite كبديل للتطوير المحلي أو الاختبار السريع بدون خادم MySQL.
"""
from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import settings

connect_args = {}
if settings.SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.SQLALCHEMY_DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency لحقن جلسة قاعدة بيانات في كل route."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """إنشاء كل الجداول إذا لم تكن موجودة (لا يُستخدم بدل نظام Migrations في الإنتاج الحقيقي)."""
    from app.models import mysql_models  # noqa: F401  ensures models are registered

    Base.metadata.create_all(bind=engine)
