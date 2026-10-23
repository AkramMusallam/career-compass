"""
اتصال قاعدة البيانات غير العلائقية (MongoDB).
تُستخدم لتخزين البيانات المرنة: نتائج التحليل الكاملة (Analysis Results / Career DNA / Roadmap)
والاستخراج الخام من السيرة الذاتية وسجل الإجابات.

في بيئة الاختبار (USE_MONGOMOCK=1) يُستخدم mongomock بدلاً من خادم Mongo حقيقي،
بحيث يمكن تشغيل الاختبارات وتجربة الـ API دون الحاجة لتثبيت MongoDB فعلياً.
"""
from __future__ import annotations

from app.core.config import settings

if settings.USE_MONGOMOCK:
    import mongomock

    _client = mongomock.MongoClient()
else:
    from pymongo import MongoClient

    _client = MongoClient(settings.MONGO_URI, serverSelectionTimeoutMS=5000)

mongo_db = _client[settings.MONGO_DB]

# الـ Collections المستخدمة في المشروع
uploads_collection = mongo_db["uploads"]
extractions_collection = mongo_db["extractions"]
assessments_collection = mongo_db["assessments"]
analysis_results_collection = mongo_db["analysis_results"]
feedback_collection = mongo_db["feedback"]  # Batch 1.2 — تقييم 👍/👎 على التوصيات
logs_collection = mongo_db["logs"]
cv_tasks_collection = mongo_db["cv_tasks"]  # Phase 2 — تتبع مهام استخراج الـ CV غير المتزامنة (Celery)


def ensure_mongo_indexes() -> None:
    """إنشاء الفهارس الأساسية في MongoDB لتسريع الاستعلامات."""
    try:
        uploads_collection.create_index("file_id", unique=True)
        uploads_collection.create_index("user_id")
        extractions_collection.create_index("extraction_id", unique=True)
        extractions_collection.create_index("user_id")
        assessments_collection.create_index("assessment_id", unique=True)
        assessments_collection.create_index("user_id")
        analysis_results_collection.create_index("analysis_id", unique=True)
        analysis_results_collection.create_index([("user_id", 1), ("date", -1)])
        analysis_results_collection.create_index("share_token", sparse=True)
        feedback_collection.create_index([("user_id", 1), ("analysis_id", 1)], unique=True)
        mongo_db["interviews"].create_index("session_id", unique=True)
        mongo_db["interviews"].create_index("user_id")
        cv_tasks_collection.create_index("task_id", unique=True)
        cv_tasks_collection.create_index("user_id")
    except Exception:
        pass


def get_mongo_db():
    return mongo_db
