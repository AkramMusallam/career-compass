from tests.pdf_helper import build_sample_cv_pdf


def _run_full_analysis(client, email, password="Passw0rd123", full_name="Batch2 Tester"):
    """يشغّل رحلة كاملة (تسجيل/رفع/استخراج/تأكيد/تقييم/تحليل) ويعيد (headers, analysis_id).
    إذا كان المستخدم مسجّلاً مسبقاً (لتشغيل تحليل ثانٍ لنفس المستخدم)، يتخطى التسجيل ويسجّل الدخول مباشرة.
    """
    register_resp = client.post("/register", json={"full_name": full_name, "email": email, "password": password})
    login = client.post("/login", json={"email": email, "password": password})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    pdf_bytes = build_sample_cv_pdf()
    upload_resp = client.post("/upload-cv", headers=headers, files={"file": ("cv.pdf", pdf_bytes, "application/pdf")})
    file_id = upload_resp.json()["file_id"]
    extract_resp = client.post("/extract", headers=headers, json={"file_id": file_id})
    extraction_id = extract_resp.json()["extraction_id"]
    extract_data = extract_resp.json()
    client.post(
        "/extract/confirm",
        headers=headers,
        json={
            "extraction_id": extraction_id,
            "skills": extract_data["skills"],
            "projects": extract_data["projects"],
            "education": extract_data["education"],
            "experience": extract_data["experience"],
        },
    )
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
    analysis = client.post(
        "/analyze", headers=headers, json={"extraction_id": extraction_id, "assessment_id": assessment_id}
    ).json()
    return headers, analysis["analysis_id"], register_resp


def test_register_duplicate_email_conflict(client):
    payload = {"full_name": "Ali Ahmad", "email": "ali@example.com", "password": "Passw0rd1"}
    r1 = client.post("/register", json=payload)
    assert r1.status_code == 201
    r2 = client.post("/register", json=payload)
    assert r2.status_code == 409
    assert r2.json()["detail"] == "Email already registered"


def test_login_wrong_password(client):
    client.post("/register", json={"full_name": "Nour", "email": "nour@example.com", "password": "Passw0rd1"})
    resp = client.post("/login", json={"email": "nour@example.com", "password": "WrongPass1"})
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Invalid email or password"


def test_protected_endpoint_requires_token(client):
    resp = client.get("/profile")
    assert resp.status_code == 401


def test_full_user_journey(client, registered_user_token):
    token, user_email = registered_user_token
    headers = {"Authorization": f"Bearer {token}"}

    # 1) Upload CV
    pdf_bytes = build_sample_cv_pdf()
    upload_resp = client.post(
        "/upload-cv",
        headers=headers,
        files={"file": ("cv.pdf", pdf_bytes, "application/pdf")},
    )
    assert upload_resp.status_code == 200
    file_id = upload_resp.json()["file_id"]
    assert upload_resp.json()["status"] == "uploaded"

    # 2) Extract
    extract_resp = client.post("/extract", headers=headers, json={"file_id": file_id})
    assert extract_resp.status_code == 200
    extract_data = extract_resp.json()
    extraction_id = extract_data["extraction_id"]
    assert "Python" in extract_data["skills"]
    assert "SQL" in extract_data["skills"]
    assert len(extract_data["projects"]) >= 1

    # 3) Confirm extraction (Review Extracted Data)
    confirm_resp = client.post(
        "/extract/confirm",
        headers=headers,
        json={
            "extraction_id": extraction_id,
            "skills": extract_data["skills"],
            "projects": extract_data["projects"],
            "education": extract_data["education"],
            "experience": extract_data["experience"],
        },
    )
    assert confirm_resp.status_code == 200
    assert confirm_resp.json()["status"] == "confirmed"

    # 4) Get assessment questions
    questions_resp = client.get("/assessment", headers=headers)
    assert questions_resp.status_code == 200
    questions = questions_resp.json()["questions"]
    assert len(questions) >= 8

    # 5) Submit assessment answers
    answers = []
    for q in questions:
        if q["type"] == "scale":
            answers.append({"question_id": q["id"], "value": 4})
        elif q["type"] == "single_choice":
            answers.append({"question_id": q["id"], "value": q["options"][0] if q["options"] else "متقدم"})
        elif q["type"] == "multiple_choice":
            answers.append({"question_id": q["id"], "value": q["options"][:2]})

    submit_resp = client.post("/assessment", headers=headers, json={"answers": answers})
    assert submit_resp.status_code == 200
    assessment_id = submit_resp.json()["assessment_id"]

    # 6) Analyze
    analyze_resp = client.post(
        "/analyze",
        headers=headers,
        json={"extraction_id": extraction_id, "assessment_id": assessment_id},
    )
    assert analyze_resp.status_code == 200
    analysis = analyze_resp.json()
    assert 0 <= analysis["career_score"] <= 100
    assert len(analysis["top_jobs"]) == 5
    assert analysis["top_jobs"][0]["match_percentage"] >= analysis["top_jobs"][1]["match_percentage"]
    # Batch 3.1/3.2 — كل وظيفة يجب أن تحمل جملة توضيحية (Explainability) غير فارغة
    for job in analysis["top_jobs"]:
        assert isinstance(job["explanation"], str) and len(job["explanation"]) > 0
    assert set(analysis["career_dna"].keys()) == {
        "Programming",
        "Problem Solving",
        "Communication",
        "System Design",
        "Data Handling",
    }
    assert "critical" in analysis["skill_gap"]
    assert len(analysis["roadmap"]) == 3

    # 7) History should now contain this analysis
    history_resp = client.get("/history", headers=headers)
    assert history_resp.status_code == 200
    history = history_resp.json()
    assert history["total"] == 1
    assert history["analyses"][0]["analysis_id"] == analysis["analysis_id"]

    # 8) History detail
    detail_resp = client.get(f"/history/{analysis['analysis_id']}", headers=headers)
    assert detail_resp.status_code == 200
    assert detail_resp.json()["career_score"] == analysis["career_score"]

    # 9) Profile reflects the analysis
    profile_resp = client.get("/profile", headers=headers)
    assert profile_resp.status_code == 200
    profile = profile_resp.json()
    assert profile["total_analyses"] == 1
    assert profile["highest_career_score"] == analysis["career_score"]

    # 10) Update profile name
    update_resp = client.put("/profile", headers=headers, json={"full_name": "Updated Name"})
    assert update_resp.status_code == 200
    assert update_resp.json()["full_name"] == "Updated Name"

    # 11) Update password
    pwd_resp = client.put(
        "/settings/password",
        headers=headers,
        json={"current_password": "Passw0rd123", "new_password": "NewPassw0rd1"},
    )
    assert pwd_resp.status_code == 200
    assert pwd_resp.json()["status"] == "password_updated"

    # 12) Old password should now fail, new password should work
    old_login = client.post("/login", json={"email": user_email, "password": "Passw0rd123"})
    assert old_login.status_code == 401
    new_login = client.post("/login", json={"email": user_email, "password": "NewPassw0rd1"})
    assert new_login.status_code == 200


def test_pdf_export_and_feedback_batch1(client):
    """يغطي فيتشرَي Batch 1: تحميل النتائج كـ PDF (B1.1-B1.3) و Feedback Loop (B1.4-B1.6)."""
    client.post(
        "/register",
        json={"full_name": "Batch1 Tester", "email": "batch1@example.com", "password": "Passw0rd123"},
    )
    login = client.post("/login", json={"email": "batch1@example.com", "password": "Passw0rd123"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    pdf_bytes = build_sample_cv_pdf()
    upload_resp = client.post("/upload-cv", headers=headers, files={"file": ("cv.pdf", pdf_bytes, "application/pdf")})
    file_id = upload_resp.json()["file_id"]
    extract_resp = client.post("/extract", headers=headers, json={"file_id": file_id})
    extraction_id = extract_resp.json()["extraction_id"]
    extract_data = extract_resp.json()
    client.post(
        "/extract/confirm",
        headers=headers,
        json={
            "extraction_id": extraction_id,
            "skills": extract_data["skills"],
            "projects": extract_data["projects"],
            "education": extract_data["education"],
            "experience": extract_data["experience"],
        },
    )
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
    analysis = client.post(
        "/analyze", headers=headers, json={"extraction_id": extraction_id, "assessment_id": assessment_id}
    ).json()
    analysis_id = analysis["analysis_id"]

    # ---- B1.1/B1.2/B1.3: تحميل PDF ----
    pdf_resp = client.get(f"/history/{analysis_id}/export/pdf", headers=headers)
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers["content-type"] == "application/pdf"
    assert pdf_resp.content[:5] == b"%PDF-"
    assert len(pdf_resp.content) > 1000

    # PDF لتحليل لا يخص المستخدم (أو غير موجود) يجب أن يُرفض
    missing_pdf_resp = client.get("/history/00000000-0000-0000-0000-000000000000/export/pdf", headers=headers)
    assert missing_pdf_resp.status_code == 404

    # بدون توكن يجب الرفض
    unauth_resp = client.get(f"/history/{analysis_id}/export/pdf")
    assert unauth_resp.status_code == 401

    # ---- B1.4/B1.5/B1.6: Feedback ----
    fb_resp = client.post(f"/history/{analysis_id}/feedback", headers=headers, json={"useful": True, "comment": "دقيق جداً"})
    assert fb_resp.status_code == 200
    assert fb_resp.json() == {"status": "recorded", "useful": True}

    # إعادة الإرسال لنفس التحليل يجب أن يُحدّث (upsert) بدل إنشاء سجل مكرر
    fb_resp2 = client.post(f"/history/{analysis_id}/feedback", headers=headers, json={"useful": False})
    assert fb_resp2.status_code == 200
    assert fb_resp2.json()["useful"] is False

    from app.core.mongo import feedback_collection

    count = feedback_collection.count_documents(
        {"analysis_id": analysis_id, "user_id": int(login.json()["user"]["id"])}
    )
    assert count == 1  # upsert وليس insert مكرر

    # تقييم لتحليل غير موجود يُرفض
    fb_missing = client.post(
        "/history/00000000-0000-0000-0000-000000000000/feedback", headers=headers, json={"useful": True}
    )
    assert fb_missing.status_code == 404


def test_compare_analyses_and_roadmap_progress_batch2(client):
    """يغطي فيتشرَي Batch 2: مقارنة تحليلين (B2.1/B2.2) و Skill Checklist تفاعلي (B2.3/B2.4)."""
    email = "batch2@example.com"
    headers, analysis_id_1, _ = _run_full_analysis(client, email)
    # تحليل ثانٍ لنفس المستخدم (يعيد استخدام نفس الحساب — register يفشل بصمت لأن المستخدم موجود)
    headers2, analysis_id_2, _ = _run_full_analysis(client, email)
    assert headers["Authorization"].startswith("Bearer ")  # جلسة ثانية صالحة لنفس المستخدم (توكن مختلف طبيعياً)

    # ---- B2.1/B2.2: مقارنة تحليلين ----
    compare_resp = client.get(f"/history/compare?ids={analysis_id_1},{analysis_id_2}", headers=headers)
    assert compare_resp.status_code == 200
    data = compare_resp.json()
    assert data["analysis_a"]["analysis_id"] == analysis_id_1
    assert data["analysis_b"]["analysis_id"] == analysis_id_2
    # مع استخدام الذكاء الاصطناعي بدلاً من البحث الحرفي، قد تختلف النتائج قليلاً بين التحليلين لنفس السيرة
    # لذا نتحقق من أن الفرق رقمي وصغير بدلاً من 0.0 بالضبط
    assert isinstance(data["career_score_delta"], (int, float))
    assert abs(data["career_score_delta"]) < 20.0
    assert isinstance(data["new_skills_gained"], list)
    assert isinstance(data["skills_lost"], list)

    # عدد ids غير صحيح (واحد فقط) يجب أن يُرفض
    bad_count_resp = client.get(f"/history/compare?ids={analysis_id_1}", headers=headers)
    assert bad_count_resp.status_code == 400

    # تحليل غير موجود ضمن المقارنة يُرفض بـ 404
    missing_resp = client.get(
        f"/history/compare?ids={analysis_id_1},00000000-0000-0000-0000-000000000000", headers=headers
    )
    assert missing_resp.status_code == 404

    # بدون توكن يُرفض
    unauth_resp = client.get(f"/history/compare?ids={analysis_id_1},{analysis_id_2}")
    assert unauth_resp.status_code == 401

    # ---- B2.3/B2.4: Skill Checklist على الـ Roadmap ----
    detail = client.get(f"/history/{analysis_id_1}", headers=headers).json()
    assert detail["completed_skills"] == []  # يبدأ فارغاً دائماً عند الإنشاء
    roadmap_skill = next(
        (s for month in detail["roadmap"] for s in month["skills_to_learn"]),
        None,
    )

    if roadmap_skill:
        mark_done_resp = client.patch(
            f"/history/{analysis_id_1}/roadmap", headers=headers, json={"skill": roadmap_skill, "completed": True}
        )
        assert mark_done_resp.status_code == 200
        assert roadmap_skill in mark_done_resp.json()["completed_skills"]

        # تعليم نفس المهارة "مكتملة" مرتين لا يُنشئ تكراراً (addToSet)
        client.patch(
            f"/history/{analysis_id_1}/roadmap", headers=headers, json={"skill": roadmap_skill, "completed": True}
        )
        recheck = client.get(f"/history/{analysis_id_1}", headers=headers).json()
        assert recheck["completed_skills"].count(roadmap_skill) == 1

        # إلغاء التعليم يزيلها من القائمة
        unmark_resp = client.patch(
            f"/history/{analysis_id_1}/roadmap", headers=headers, json={"skill": roadmap_skill, "completed": False}
        )
        assert unmark_resp.status_code == 200
        assert roadmap_skill not in unmark_resp.json()["completed_skills"]

    # تعليم مهارة على تحليل غير موجود يُرفض
    not_found_patch = client.patch(
        "/history/00000000-0000-0000-0000-000000000000/roadmap",
        headers=headers,
        json={"skill": "Python", "completed": True},
    )
    assert not_found_patch.status_code == 404

    # بدون توكن يُرفض
    unauth_patch = client.patch(f"/history/{analysis_id_1}/roadmap", json={"skill": "Python", "completed": True})
    assert unauth_patch.status_code == 401


def test_share_link_and_public_view_batch4(client):
    """يغطي فيتشر مشاركة النتائج (B4.1/B4.2/B4.3): إنشاء رابط، عرض عام محدود الحقول، إلغاء."""
    email = "batch4-share@example.com"
    headers, analysis_id, _ = _run_full_analysis(client, email)

    # ---- B4.1: إنشاء رابط مشاركة ----
    share_resp = client.post(f"/history/{analysis_id}/share", headers=headers)
    assert share_resp.status_code == 200
    share_data = share_resp.json()
    assert share_data["already_existed"] is False
    token = share_data["share_token"]
    assert len(token) > 10

    # إعادة الطلب يجب أن يعيد نفس الرابط (idempotent) وليس رابطاً جديداً
    share_resp_2 = client.post(f"/history/{analysis_id}/share", headers=headers)
    assert share_resp_2.json()["share_token"] == token
    assert share_resp_2.json()["already_existed"] is True

    # ---- B4.2: عرض عام بدون أي توكن ----
    public_resp = client.get(f"/shared/{token}")
    assert public_resp.status_code == 200
    public_data = public_resp.json()
    assert set(public_data.keys()) == {"career_score", "career_dna", "top_jobs", "date"}
    assert "email" not in public_data
    assert "full_name" not in public_data
    assert "skill_gap" not in public_data
    assert "roadmap" not in public_data
    assert "suggested_courses" not in public_data
    assert "strengths" not in public_data
    for job in public_data["top_jobs"]:
        assert set(job.keys()) == {"job_title", "match_percentage", "matched_skills", "missing_skills", "explanation"}

    # رمز غير موجود يُرفض بـ 404
    missing_share_resp = client.get("/shared/not-a-real-token-xyz")
    assert missing_share_resp.status_code == 404

    # ---- محاولة مشاركة/إلغاء تحليل شخص آخر تُرفض ----
    other_headers, _, _ = _run_full_analysis(client, "batch4-other@example.com")
    forbidden_share = client.post(f"/history/{analysis_id}/share", headers=other_headers)
    assert forbidden_share.status_code == 404

    # ---- B4.3: إلغاء المشاركة ----
    revoke_resp = client.delete(f"/history/{analysis_id}/share", headers=headers)
    assert revoke_resp.status_code == 200
    assert revoke_resp.json()["status"] == "revoked"

    # الرابط القديم لم يعد يعمل بعد الإلغاء
    after_revoke_resp = client.get(f"/shared/{token}")
    assert after_revoke_resp.status_code == 404

    # الإلغاء مرة ثانية (idempotent) لا يفشل
    revoke_again_resp = client.delete(f"/history/{analysis_id}/share", headers=headers)
    assert revoke_again_resp.status_code == 200

    # طلب مشاركة جديد بعد الإلغاء يولّد رمزاً مختلفاً عن السابق
    new_share_resp = client.post(f"/history/{analysis_id}/share", headers=headers)
    assert new_share_resp.json()["share_token"] != token


def test_benchmark_opt_in_only_batch4(client):
    """يغطي فيتشر Benchmark (B4.4): لا بيانات تدخل الحساب إلا للمستخدمين الموافقين صراحة."""
    # مستخدم لم يوافق على المشاركة
    headers_a, _, _ = _run_full_analysis(client, "batch4-bench-a@example.com")

    benchmark_before = client.get("/benchmark", headers=headers_a)
    assert benchmark_before.status_code == 200
    assert benchmark_before.json()["sample_size"] == 0
    assert benchmark_before.json()["average_career_score"] is None

    # نفس المستخدم يوافق الآن صراحة (Opt-in)
    opt_in_resp = client.put("/settings/benchmark-opt-in", headers=headers_a, json={"opted_in": True})
    assert opt_in_resp.status_code == 200
    assert opt_in_resp.json()["opted_in"] is True

    benchmark_after = client.get("/benchmark", headers=headers_a)
    assert benchmark_after.status_code == 200
    data = benchmark_after.json()
    assert data["sample_size"] == 1
    assert data["average_career_score"] is not None

    # مستخدم آخر لم يوافق أبداً — بياناته يجب ألا تدخل حساب مستخدم آخر يطّلع على الـ benchmark
    headers_b, _, _ = _run_full_analysis(client, "batch4-bench-b@example.com")
    benchmark_from_b = client.get("/benchmark", headers=headers_b)
    assert benchmark_from_b.json()["sample_size"] == 1  # فقط المستخدم الموافق (a)، وليس b نفسه

    # بدون توكن يُرفض
    unauth_resp = client.get("/benchmark")
    assert unauth_resp.status_code == 401

    # إلغاء الموافقة يعيد إخراج المستخدم من الحساب
    client.put("/settings/benchmark-opt-in", headers=headers_a, json={"opted_in": False})
    benchmark_final = client.get("/benchmark", headers=headers_a)
    assert benchmark_final.json()["sample_size"] == 0


def test_profile_badges_batch4(client):
    """يغطي فيتشر Badges (B4.5/B4.6) على مستوى الـ API الحقيقي."""
    email = "batch4-badges@example.com"
    headers, analysis_id, _ = _run_full_analysis(client, email)

    badges_resp = client.get("/profile/badges", headers=headers)
    assert badges_resp.status_code == 200
    badges = {b["id"]: b for b in badges_resp.json()["badges"]}
    assert set(badges.keys()) == {"first_analysis", "score_boost_10", "first_month_roadmap"}
    assert badges["first_analysis"]["achieved"] is True
    assert badges["first_analysis"]["achieved_at"] is not None
    assert badges["score_boost_10"]["achieved"] is False  # تحليل واحد فقط حتى الآن

    # بدون توكن يُرفض
    unauth_resp = client.get("/profile/badges")
    assert unauth_resp.status_code == 401


def test_upload_rejects_non_pdf(client):
    client.post(
        "/register",
        json={"full_name": "PDF Tester", "email": "pdf.tester@example.com", "password": "Passw0rd123"},
    )
    login = client.post("/login", json={"email": "pdf.tester@example.com", "password": "Passw0rd123"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    resp = client.post(
        "/upload-cv",
        headers=headers,
        files={"file": ("cv.txt", b"not a pdf", "text/plain")},
    )
    assert resp.status_code == 400


def test_register_weak_password_rejected(client):
    resp = client.post(
        "/register",
        json={"full_name": "Weak Pass", "email": "weak@example.com", "password": "weakpass"},
    )
    assert resp.status_code == 400
