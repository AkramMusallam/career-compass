"""
اختبارات معمّقة للأمان والمصادقة وإدارة الحساب والملف الشخصي (Security, Auth & Profile Deep Suite)
تغطي:
- قواعد قوة كلمة المرور الصارمة (طول، أرقام، أحرف كبيرة وصغيرة).
- التحقق من تكرار البريد والتعامل مع الأحرف الكبيرة والصغيرة (Case-Insensitivity).
- دورة استعادة كلمة المرور وإبطال الرمز بعد الاستخدام الأول (Single-use reset tokens).
- تحديثات الملف الشخصي وتفضيلات الإشعارات والـ Benchmark.
- الحذف الآمن للحساب ومسح كافة السجلات التابعة في MySQL و MongoDB.
"""
import uuid
import pytest
from app.models.mysql_models import User
from app.core.database import SessionLocal
from app.core.mongo import (
    analysis_results_collection,
    extractions_collection,
    subscriptions_collection,
)


def test_password_strength_enforcement(client):
    """التحقق من رفض كلمات المرور الضعيفة بحسب متطلبات الأمان."""
    base_email = f"sec.{uuid.uuid4().hex[:6]}@test.com"

    # 1. لا تحتوي على حرف كبير
    resp_no_upper = client.post("/register", json={"full_name": "Test", "email": base_email, "password": "password123"})
    assert resp_no_upper.status_code == 400

    # 2. لا تحتوي على حرف صغير
    resp_no_lower = client.post("/register", json={"full_name": "Test", "email": base_email, "password": "PASSWORD123"})
    assert resp_no_lower.status_code == 400

    # 3. لا تحتوي على رقم
    resp_no_digit = client.post("/register", json={"full_name": "Test", "email": base_email, "password": "PasswordWithoutDigit"})
    assert resp_no_digit.status_code == 400

    # 4. قصيرة أقل من 8 أحرف
    resp_short = client.post("/register", json={"full_name": "Test", "email": base_email, "password": "Pass1"})
    assert resp_short.status_code == 400


def test_login_case_insensitivity(client):
    """تسجيل الدخول يجب أن يقبل البريد بغض النظر عن حالة الأحرف (Uppercase/Lowercase)."""
    raw_email = f"MiXeD.CaSe.{uuid.uuid4().hex[:6]}@ExamPle.Com"
    password = "ValidPassword123"

    reg_resp = client.post("/register", json={"full_name": "Mixed Case User", "email": raw_email, "password": password})
    assert reg_resp.status_code == 201

    # محاولة الدخول ببريد بأحرف صغيرة كاملة
    resp_lower = client.post("/login", json={"email": raw_email.lower(), "password": password})
    assert resp_lower.status_code == 200
    assert "access_token" in resp_lower.json()

    # محاولة الدخول ببريد بأحرف كبيرة كاملة
    resp_upper = client.post("/login", json={"email": raw_email.upper(), "password": password})
    assert resp_upper.status_code == 200
    assert "access_token" in resp_upper.json()


def test_password_reset_single_use_enforcement(client):
    """التحقق من أن رمز استعادة كلمة المرور يُستخدم لمرة واحدة فقط ثم يُلغى فورياً."""
    email = f"reset.user.{uuid.uuid4().hex[:6]}@example.com"
    old_pw = "OldPassword123"
    new_pw = "NewPassword456"

    client.post("/register", json={"full_name": "Reset User", "email": email, "password": old_pw})

    # طلب رمز الاستعادة من خلال وظيفة create_reset_token
    from app.core.security import create_reset_token
    with SessionLocal() as db:
        u = db.query(User).filter(User.email == email).first()
        token = create_reset_token(str(u.id), u.hashed_password)

    # 1. الاستخدام الأول للرمز -> نجاح
    resp_reset1 = client.post("/reset-password", json={"token": token, "new_password": new_pw})
    assert resp_reset1.status_code == 200

    # 2. التحقق من القدرة على الدخول بكلمة المرور الجديدة
    login_new = client.post("/login", json={"email": email, "password": new_pw})
    assert login_new.status_code == 200

    # 3. محاولة إعادة استخدام نفس الرمز القديم مرة أخرى -> يجب أن يُرفض (400)
    resp_reset2 = client.post("/reset-password", json={"token": token, "new_password": "AnotherPassword789"})
    assert resp_reset2.status_code == 400


def test_profile_update_and_preferences(client):
    """التحقق من تحديث الاسم والخيارات الاختيارية للملف الشخصي."""
    email = f"pref.user.{uuid.uuid4().hex[:6]}@example.com"
    client.post("/register", json={"full_name": "Original Name", "email": email, "password": "Passw0rd123"})
    token = client.post("/login", json={"email": email, "password": "Passw0rd123"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. تحديث الاسم
    resp_update = client.put("/profile", json={"full_name": "Updated Great Name"}, headers=headers)
    assert resp_update.status_code == 200
    assert resp_update.json()["full_name"] == "Updated Great Name"

    # 2. تفعيل مشاركة متوسط الأقران (Benchmark Opt-in)
    resp_bench = client.put("/settings/benchmark-opt-in", json={"opted_in": True}, headers=headers)
    assert resp_bench.status_code == 200
    assert resp_bench.json()["opted_in"] is True

    # 3. إيقاف التنبيهات البريدية (Notifications Opt-out)
    resp_notif = client.put("/settings/notifications", json={"notifications_opt_in": False}, headers=headers)
    assert resp_notif.status_code == 200
    assert resp_notif.json()["notifications_opt_in"] is False

    # 4. جلب البروفايل للتحقق من حفظ كافة التغييرات
    prof = client.get("/profile", headers=headers).json()
    assert prof["full_name"] == "Updated Great Name"
    assert prof["benchmark_opt_in"] is True
    assert prof["notifications_opt_in"] is False


def test_account_deletion_cascading_cleanup(client):
    """حذف الحساب يجب أن يحذف المستخدم وسجلاته التابعة في كل من MySQL و MongoDB."""
    email = f"delete.me.{uuid.uuid4().hex[:6]}@example.com"
    client.post("/register", json={"full_name": "To Delete", "email": email, "password": "Passw0rd123"})
    token = client.post("/login", json={"email": email, "password": "Passw0rd123"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    with SessionLocal() as db:
        uid = db.query(User).filter(User.email == email).first().id

    # إضافة بيانات مرتبطة في MongoDB
    extractions_collection.insert_one({"user_id": uid, "test": "data"})
    analysis_results_collection.insert_one({"user_id": uid, "test": "analysis"})
    subscriptions_collection.insert_one({"user_id": uid, "test": "sub"})

    # تنفيذ الحذف
    resp_del = client.delete("/profile", headers=headers)
    assert resp_del.status_code == 200

    # التحقق من حذف المستخدم من MySQL
    with SessionLocal() as db:
        assert db.query(User).filter(User.id == uid).first() is None

    # التحقق من مسح بياناته في MongoDB
    assert extractions_collection.count_documents({"user_id": uid}) == 0
    assert analysis_results_collection.count_documents({"user_id": uid}) == 0
    assert subscriptions_collection.count_documents({"user_id": uid}) == 0

    # محاولة استخدام التوكن بعد الحذف -> مرفوض 401
    resp_after = client.get("/profile", headers=headers)
    assert resp_after.status_code == 401
