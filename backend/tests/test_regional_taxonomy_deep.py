"""
اختبارات معمّقة لمنظومة التصنيف الإقليمي والذكاء الاصطناعي المتخصص (Regional Taxonomy & LLM Dataset Deep Suite)
تغطي:
- توحيد كافة المسميات الوظيفية والمصطلحات التقنية الثنائية (عربي/إنجليزي).
- حساب مستويات الخبرة والنطاقات المالية لسوق العمل الفلسطيني والإقليمي.
- سلامة ملفات تدريب النماذج (JSONL ChatML Format).
- معالجة الـ Markdown Fences وسرعة استجابة تقييم المرشحين.
"""
import json
import pytest
from app.services.regional_taxonomy import (
    BILINGUAL_ROLE_TAXONOMY,
    REGIONAL_COMPANIES,
    SALARY_BENCHMARKS,
    normalize_regional_job_title,
    extract_regional_market_insights,
)
from app.services.finetuned_llm_service import generate_candidate_fit_evaluation
from scripts.prepare_finetuning_dataset import generate_finetuning_datasets


def test_bilingual_taxonomy_all_roles_normalized():
    """التحقق من توحيد كافة المسميات الوظيفية التقنية الشائعة بالعربية والإنجليزية."""
    test_cases = [
        # Frontend
        ("مطوّر واجهات أمامية", "Frontend Developer"),
        ("مطور فرونت إند", "Frontend Developer"),
        ("مهندس واجهات المستخدم", "Frontend Developer"),
        ("frontend engineer", "Frontend Developer"),
        # Backend
        ("مطوّر واجهات خلفية", "Backend Developer"),
        ("مطور باك إند", "Backend Developer"),
        ("مهندس خوادم ونظم خلفية", "Backend Developer"),
        ("backend engineer", "Backend Developer"),
        # Full Stack
        ("مطوّر فل ستاك", "Full Stack Developer"),
        ("مطور ويب شامل", "Full Stack Developer"),
        # Mobile
        ("مطور تطبيقات الهواتف", "Mobile Developer"),
        ("flutter developer", "Mobile Developer"),
        # DevOps
        ("مهندس ديف أوبس", "Devops Engineer"),
        ("cloud infrastructure engineer", "Devops Engineer"),
        # Data
        ("مهندس بيانات", "Data Engineer"),
        ("عالم بيانات", "Data Scientist"),
        ("machine learning engineer", "Data Scientist"),
        # QA & UX
        ("مهندس ضبط الجودة", "Qa Engineer"),
        ("مصمم تجربة وواجهة المستخدم", "Ui/Ux Designer"),
    ]

    for raw_input, expected in test_cases:
        actual = normalize_regional_job_title(raw_input)
        assert actual == expected, f"Failed for {raw_input}: expected {expected}, got {actual}"


def test_unknown_title_falls_back_cleanly():
    """المسميات غير المعرّفة في القاموس تُعاد بصيغة Title Case نظيفة دون أخطاء."""
    assert normalize_regional_job_title("quantum computing researcher") == "Quantum Computing Researcher"
    assert normalize_regional_job_title("  embedded c engineer  ") == "Embedded C Engineer"


def test_regional_market_insights_experience_brackets():
    """التحقق من تصنيف سلم الرواتب والشركات حسب سنوات الخبرة."""
    # 1. مبتدئ (سنة واحدة)
    junior_res = extract_regional_market_insights(["Python"], "Backend Developer", years_exp=1.0)
    assert "Junior" in junior_res["market_level"] or "مبتدئ" in junior_res["market_level"]
    assert junior_res["estimated_salary_usd"] == SALARY_BENCHMARKS["junior"]["label"]

    # 2. متوسط (3.5 سنوات)
    mid_res = extract_regional_market_insights(["Python", "SQL"], "Backend Developer", years_exp=3.5)
    assert "Mid" in mid_res["market_level"] or "متوسط" in mid_res["market_level"]
    assert mid_res["estimated_salary_usd"] == SALARY_BENCHMARKS["mid"]["label"]

    # 3. خبير (7 سنوات)
    senior_res = extract_regional_market_insights(["Python", "Docker"], "Backend Developer", years_exp=7.0)
    assert "Senior" in senior_res["market_level"] or "خبير" in senior_res["market_level"]
    assert senior_res["estimated_salary_usd"] == SALARY_BENCHMARKS["senior"]["label"]

    # التحقق من وجود الشركات الإقليمية الرائدة
    assert len(senior_res["top_regional_employers"]) > 0
    top_employer_names = [e["name"].lower() for e in senior_res["top_regional_employers"]]
    assert any("asal" in n or "exalt" in n or "harri" in n for n in top_employer_names)


def test_finetuned_dataset_strict_jsonl_compliance(tmp_path):
    """التحقق من أن سكربت توليد بيانات التدريب ينتج ملفات JSONL قياسية صالحة تماماً."""
    out_dir = tmp_path / "llm_dataset_test"
    generate_finetuning_datasets(output_dir=str(out_dir))

    train_path = out_dir / "domain_recruitment_train.jsonl"
    val_path = out_dir / "domain_recruitment_val.jsonl"

    assert train_path.exists()
    assert val_path.exists()

    # فحص كل سطر في ملف التدريب ككائن JSON سليم يتضمن بنية رسائل ChatML
    with open(train_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
        assert len(lines) >= 3
        for line in lines:
            obj = json.loads(line.strip())
            assert "messages" in obj
            messages = obj["messages"]
            assert len(messages) == 3
            assert messages[0]["role"] == "system"
            assert messages[1]["role"] == "user"
            assert messages[2]["role"] == "assistant"
            # التأكد من أن محتوى المساعد هو JSON صالح للمخرجات الهيكلية
            assistant_content = json.loads(messages[2]["content"])
            assert isinstance(assistant_content, dict)


def test_candidate_fit_evaluation_score_tiers():
    """فحص نصوص التقييم الحتمية عند مستويات تطابق مختلفة."""
    # تطابق ممتاز (80%)
    high_eval = generate_candidate_fit_evaluation(
        candidate_name="Kareem",
        target_role="Full Stack",
        candidate_skills=["Python", "FastAPI", "React"],
        job_title="Full Stack Developer",
        required_skills=["Python", "React"],
        bonus_skills=[],
        matched_skills=["Python", "React"],
        missing_skills=[],
        match_percentage=80,
    )
    assert high_eval["hiring_readiness"] == "High"
    assert "متميز" in high_eval["verdict"]

    # تطابق متوسط (50%)
    mid_eval = generate_candidate_fit_evaluation(
        candidate_name="Lina",
        target_role="Data Engineer",
        candidate_skills=["Python"],
        job_title="Data Engineer",
        required_skills=["Python", "Spark", "Airflow"],
        bonus_skills=[],
        matched_skills=["Python"],
        missing_skills=["Spark", "Airflow"],
        match_percentage=50,
    )
    assert mid_eval["hiring_readiness"] == "Medium"
    assert "مناسب" in mid_eval["verdict"]

    # تطابق ضعيف (25%)
    low_eval = generate_candidate_fit_evaluation(
        candidate_name="Omar",
        target_role="DevOps",
        candidate_skills=["HTML"],
        job_title="Senior DevOps Engineer",
        required_skills=["Kubernetes", "Terraform", "CI/CD"],
        bonus_skills=[],
        matched_skills=[],
        missing_skills=["Kubernetes", "Terraform"],
        match_percentage=25,
    )
    assert low_eval["hiring_readiness"] == "Needs Upskilling"
    assert "تدريب وتطوير" in low_eval["verdict"]
