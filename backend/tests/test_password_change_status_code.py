"""
مراجعة شاملة بعد الدفعة 5 — اختبار إصلاح خلل حرج: 401 خاطئ عند إدخال كلمة مرور حالية غير صحيحة.

الخلل المُكتشف: PUT /settings/password كان يُرجع 401 Unauthorized عند إدخال كلمة المرور
الحالية بشكل خاطئ. لأن معالج axios العام في الفرونت إند (api/client.js) يُسجّل خروج
المستخدم تلقائياً ويوجّهه لصفحة تسجيل الدخول عند استقبال أي 401 (بافتراض أنه يعني دائماً
"الجلسة/التوكن غير صالح")، كان هذا يتسبب في تسجيل خروج المستخدم فجأة بمجرد كتابة كلمة مروره
الحالية بشكل خاطئ، بدل عرض رسالة "كلمة المرور الحالية غير صحيحة" المصمَّمة أصلاً في
Settings.jsx. الإصلاح: تغيير رمز الحالة إلى 400 Bad Request، لأن المستخدم هنا مُصادَق فعلاً
(يملك JWT صالحاً) والخطأ هو في بيانات النموذج المُرسَلة، لا في صلاحية الجلسة.
"""


def test_wrong_current_password_returns_400_not_401(client, registered_user_token):
    """هذا هو الاختبار الحاسم: يتحقق تحديداً من رمز الحالة 400 (وليس 401)، لأن الفرونت إند
    يبني سلوكه (تسجيل خروج تلقائي أم لا) على هذا الرمز بالذات."""
    token, _ = registered_user_token
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.put(
        "/settings/password",
        headers=headers,
        json={"current_password": "ThisIsWrong123", "new_password": "NewPassw0rd1"},
    )
    assert resp.status_code == 400
    assert "incorrect" in resp.json()["detail"].lower()


def test_wrong_current_password_does_not_change_password(client, registered_user_token):
    """تأكيد إضافي: رفض الطلب لا يجب أن يغيّر كلمة المرور الفعلية — المستخدم لازم يقدر يسجّل
    دخول لاحقاً بنفس كلمة مروره القديمة تماماً كأن شي ما صار."""
    token, email = registered_user_token
    headers = {"Authorization": f"Bearer {token}"}

    client.put(
        "/settings/password",
        headers=headers,
        json={"current_password": "WrongOne123", "new_password": "AttemptedNew1"},
    )

    login_resp = client.post("/login", json={"email": email, "password": "Passw0rd123"})
    assert login_resp.status_code == 200


def test_correct_current_password_still_returns_200(client, registered_user_token):
    """اختبار سلبي مقابل: التأكد أن الإصلاح لم يكسر الحالة الناجحة (200) عند إدخال كلمة
    المرور الحالية الصحيحة فعلاً."""
    token, _ = registered_user_token
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.put(
        "/settings/password",
        headers=headers,
        json={"current_password": "Passw0rd123", "new_password": "BrandNewPass1"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "password_updated"


def test_password_update_requires_auth(client):
    resp = client.put("/settings/password", json={"current_password": "x", "new_password": "y"})
    assert resp.status_code == 401  # هذا 401 صحيح ومطلوب: لا يوجد توكن أصلاً هنا
