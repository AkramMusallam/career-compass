"""
Batch 5.1 — اختبارات POST /extract/manual (إدخال بيانات يدوي كامل بدون رفع CV).
"""


def test_manual_extract_requires_auth(client):
    resp = client.post("/extract/manual", json={"skills": ["Python"]})
    assert resp.status_code == 401


def test_manual_extract_creates_empty_shell_by_default(client, registered_user_token):
    """الاستخدام المتوقع من الفرونت (F5.1): استدعاء فوري بجسم فارغ عند اختيار "إدخال يدوي"،
    قبل توجيه المستخدم لصفحة المراجعة ليملأ بياناته هناك."""
    token, _ = registered_user_token
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.post("/extract/manual", headers=headers, json={})
    assert resp.status_code == 200
    data = resp.json()
    assert data["skills"] == []
    assert data["projects"] == []
    assert data["education"] == []
    assert data["experience"] == []
    assert data["extraction_id"]


def test_manual_extract_accepts_prefilled_data_and_matches_extract_response_shape(client, registered_user_token):
    token, _ = registered_user_token
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "skills": ["Python", "SQL", "Docker"],
        "projects": [{"title": "Personal Portfolio", "description": "Built with React", "technologies": ["React"]}],
        "education": [{"degree": "Bachelor", "institution": "Test University", "year": 2023}],
        "experience": [
            {"title": "Backend Developer", "company": "Acme Inc", "duration_months": 12, "description": "APIs"}
        ],
    }
    resp = client.post("/extract/manual", headers=headers, json=payload)
    assert resp.status_code == 200
    data = resp.json()

    # نفس بنية استجابة /extract تماماً (نفس المفاتيح)
    assert set(data.keys()) == {"extraction_id", "skills", "projects", "education", "experience", "is_linkedin"}
    assert data["is_linkedin"] is False
    assert data["skills"] == payload["skills"]
    assert data["projects"][0]["title"] == "Personal Portfolio"
    assert data["education"][0]["year"] == 2023
    assert data["experience"][0]["company"] == "Acme Inc"


def test_manual_extract_flows_into_confirm_and_analyze(client, registered_user_token):
    """يتحقق أن extraction_id الناتج من /extract/manual صالح تماماً لبقية الرحلة
    (/extract/confirm ثم /assessment ثم /analyze)، بدون أي معاملة خاصة له في هذه المسارات."""
    token, _ = registered_user_token
    headers = {"Authorization": f"Bearer {token}"}

    manual_resp = client.post(
        "/extract/manual",
        headers=headers,
        json={"skills": ["Python", "SQL", "Docker", "React", "Git", "API Design"]},
    )
    extraction_id = manual_resp.json()["extraction_id"]

    confirm_resp = client.post(
        "/extract/confirm",
        headers=headers,
        json={
            "extraction_id": extraction_id,
            "skills": ["Python", "SQL", "Docker", "React", "Git", "API Design"],
            "projects": [],
            "education": [],
            "experience": [],
        },
    )
    assert confirm_resp.status_code == 200
    assert confirm_resp.json()["status"] == "confirmed"

    questions = client.get("/assessment", headers=headers).json()["questions"]
    answers = []
    for q in questions:
        if q["type"] == "scale":
            answers.append({"question_id": q["id"], "value": 3})
        elif q["type"] == "single_choice":
            answers.append({"question_id": q["id"], "value": q["options"][0] if q["options"] else ""})
        elif q["type"] == "multiple_choice":
            answers.append({"question_id": q["id"], "value": q["options"][:1]})
    assessment_id = client.post("/assessment", headers=headers, json={"answers": answers}).json()["assessment_id"]

    analyze_resp = client.post(
        "/analyze", headers=headers, json={"extraction_id": extraction_id, "assessment_id": assessment_id}
    )
    assert analyze_resp.status_code == 200
    assert analyze_resp.json()["career_score"] >= 0


def test_manual_extract_rejects_other_users_data_on_confirm(client):
    """extraction_id من /extract/manual يخص المستخدم الذي أنشأه فقط — أمان أساسي مطابق
    لنفس نمط الحماية المستخدم في كل مكان آخر بالمشروع (get_current_user)."""
    import uuid

    email_a = f"user.a.{uuid.uuid4().hex[:8]}@example.com"
    email_b = f"user.b.{uuid.uuid4().hex[:8]}@example.com"
    client.post("/register", json={"full_name": "User A", "email": email_a, "password": "Passw0rd123"})
    client.post("/register", json={"full_name": "User B", "email": email_b, "password": "Passw0rd123"})
    token_a = client.post("/login", json={"email": email_a, "password": "Passw0rd123"}).json()["access_token"]
    token_b = client.post("/login", json={"email": email_b, "password": "Passw0rd123"}).json()["access_token"]

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    extraction_id = client.post("/extract/manual", headers=headers_a, json={}).json()["extraction_id"]

    resp = client.post(
        "/extract/confirm",
        headers=headers_b,
        json={"extraction_id": extraction_id, "skills": ["Python"], "projects": [], "education": [], "experience": []},
    )
    assert resp.status_code == 404
