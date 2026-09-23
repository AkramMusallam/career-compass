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


def get_mongo_db():
    return mongo_db
