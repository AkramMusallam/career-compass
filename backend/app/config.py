"""
إعدادات التطبيق العامة.
كل القيم قابلة للتعديل عبر متغيرات البيئة (.env) بدون تعديل الكود.
"""
from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


class Settings:
    # ---- عام ----
    APP_NAME: str = "Career Compass API"
    APP_VERSION: str = "1.0.0"
    ENV: str = os.getenv("ENV", "development")  # development | testing | production

    # ---- الأمان / JWT ----
    # Ensure JWT_SECRET_KEY is explicitly set in production, or fallback to dev secret.
    JWT_SECRET_KEY: str = os.getenv(
        "JWT_SECRET_KEY", 
        "CHANGE_ME_IN_PRODUCTION_SECRET_KEY" if os.getenv("ENV", "development") != "production" else ""
    )
    if not JWT_SECRET_KEY and ENV == "production":
        raise ValueError("JWT_SECRET_KEY must be set in production environment")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))  # 24 ساعة

    # ---- قاعدة البيانات العلائقية (MySQL) ----
    # في بيئة التطوير/الاختبار بدون MySQL متاح، يمكن استخدام SQLite تلقائياً
    # عبر ضبط USE_SQLITE_FALLBACK=1 أو عدم توفر MYSQL_URL.
    MYSQL_HOST: str = os.getenv("MYSQL_HOST", "localhost")
    MYSQL_PORT: str = os.getenv("MYSQL_PORT", "3306")
    MYSQL_USER: str = os.getenv("MYSQL_USER", "root")
    MYSQL_PASSWORD: str = os.getenv("MYSQL_PASSWORD", "")
    MYSQL_DB: str = os.getenv("MYSQL_DB", "career_compass")
    USE_SQLITE_FALLBACK: bool = os.getenv("USE_SQLITE_FALLBACK", "0") == "1"
    SQLITE_PATH: str = os.getenv("SQLITE_PATH", "career_compass.db")

    @property
    def SQLALCHEMY_DATABASE_URL(self) -> str:
        if self.USE_SQLITE_FALLBACK:
            return f"sqlite:///{self.SQLITE_PATH}"
        return (
            f"mysql+pymysql://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}"
            f"@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DB}?charset=utf8mb4"
        )

    # ---- قاعدة البيانات غير العلائقية (MongoDB) ----
    MONGO_URI: str = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    MONGO_DB: str = os.getenv("MONGO_DB", "career_compass")
    USE_MONGOMOCK: bool = os.getenv("USE_MONGOMOCK", "0") == "1"

    # ---- رفع الملفات ----
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "uploads")
    MAX_UPLOAD_MB: int = int(os.getenv("MAX_UPLOAD_MB", "5"))

    # ---- CORS ----
    CORS_ORIGINS: list = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")

    # ---- Batch 5.4: مهام مجدولة (Celery + Redis) ----
    # قرار هندسي: Celery + Redis بدل APScheduler لأنها أنسب للإنتاج الحقيقي (Worker منفصل
    # عن عملية الـ API، إعادة محاولة تلقائية عند الفشل، وقابلية للتوسع بعدة Workers لاحقاً).
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    CELERY_TASK_ALWAYS_EAGER: bool = os.getenv("CELERY_TASK_ALWAYS_EAGER", "0") == "1"

    # جدولة المهمة الأسبوعية: افتراضياً كل يوم اثنين الساعة 08:00 بتوقيت UTC (قابلة للتعديل)
    WEEKLY_EMAIL_DAY_OF_WEEK: str = os.getenv("WEEKLY_EMAIL_DAY_OF_WEEK", "monday")
    WEEKLY_EMAIL_HOUR: int = int(os.getenv("WEEKLY_EMAIL_HOUR", "8"))
    WEEKLY_EMAIL_MINUTE: int = int(os.getenv("WEEKLY_EMAIL_MINUTE", "0"))

    # ---- Batch 5.5: خدمة البريد الإلكتروني (SMTP) ----
    # مفتاح إيقاف شامل: يبقى False افتراضياً في التطوير/الاختبار حتى لا تُرسل أي رسائل فعلية
    # بدون ضبط بيانات اعتماد SMTP حقيقية صراحة.
    EMAIL_NOTIFICATIONS_ENABLED: bool = os.getenv("EMAIL_NOTIFICATIONS_ENABLED", "0") == "1"
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME: str = os.getenv("SMTP_USERNAME", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_USE_TLS: bool = os.getenv("SMTP_USE_TLS", "1") == "1"
    SMTP_FROM_EMAIL: str = os.getenv("SMTP_FROM_EMAIL", "no-reply@career-compass.app")
    SMTP_FROM_NAME: str = os.getenv("SMTP_FROM_NAME", "Career Compass")
    # يُستخدم لبناء روابط قابلة للنقر داخل الإيميل (مثال: رابط صفحة النتائج)
    FRONTEND_BASE_URL: str = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
