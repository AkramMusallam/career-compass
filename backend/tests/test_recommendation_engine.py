from app.services.recommendation_engine import (
    JobMatchResult,
    UserProfileInput,
    calculate_job_match,
    calculate_profile_completeness,
    calculate_skill_diversity,
    calculate_skill_proficiency,
    generate_explanation,
)


def test_skill_proficiency_base_presence_only():
    proficiency = calculate_skill_proficiency(
        "Python",
        user_skills=["Python"],
        projects=[],
        experience=[],
        assessment_answers=[],
        questions_by_id={},
    )
    assert proficiency == 30.0


def test_skill_proficiency_absent_skill_is_zero():
    proficiency = calculate_skill_proficiency(
        "Python",
        user_skills=["SQL"],
        projects=[],
        experience=[],
        assessment_answers=[],
        questions_by_id={},
    )
    assert proficiency == 0.0


def test_skill_proficiency_with_projects_and_experience():
    projects = [
        {"title": "P1", "technologies": ["Python"]},
        {"title": "P2", "technologies": ["Python"]},
    ]
    experience = [{"title": "Backend Intern", "description": "Worked with Python daily", "duration_months": 12}]
    proficiency = calculate_skill_proficiency(
        "Python",
        user_skills=["Python"],
        projects=projects,
        experience=experience,
        assessment_answers=[],
        questions_by_id={},
    )
    # base 30 + project_usage(2*15=30) + experience(12/6*10=20) = 80
    assert proficiency == 80.0


def test_skill_proficiency_capped_at_100():
    projects = [{"title": f"P{i}", "technologies": ["Python"]} for i in range(5)]
    experience = [{"title": "Senior Dev", "description": "Python expert", "duration_months": 60}]
    proficiency = calculate_skill_proficiency(
        "Python",
        user_skills=["Python"],
        projects=projects,
        experience=experience,
        assessment_answers=[],
        questions_by_id={},
    )
    assert proficiency == 100.0


def test_job_match_no_penalty_when_all_essential_present():
    profile = {"SQL": 100.0, "API Design": 100.0, "Python": 100.0}
    match_pct, missing_essential, missing_important, missing_bonus = calculate_job_match(
        profile,
        essential_skills=["SQL", "API Design", "Python"],
        important_skills=[],
        bonus_skills=[],
    )
    assert match_pct == 60.0  # 100 * 0.60
    assert missing_essential == []


def test_job_match_penalty_for_missing_essential_skill():
    profile = {"SQL": 100.0, "API Design": 100.0}  # Python missing entirely
    match_pct, missing_essential, missing_important, missing_bonus = calculate_job_match(
        profile,
        essential_skills=["SQL", "API Design", "Python"],
        important_skills=[],
        bonus_skills=[],
    )
    # avg = (100+100+0)/3 = 66.67 * 0.6 = 40, minus 5 penalty = 35
    assert missing_essential == ["Python"]
    assert match_pct == 35.0


def test_job_match_percentage_never_negative():
    profile = {}
    match_pct, missing_essential, *_ = calculate_job_match(
        profile,
        essential_skills=["A", "B", "C", "D"],
        important_skills=[],
        bonus_skills=[],
    )
    assert match_pct == 0.0
    assert len(missing_essential) == 4


def test_profile_completeness_full():
    profile = UserProfileInput(
        skills=["Python"],
        projects=[{"title": "P"}],
        education=[{"degree": "BSc"}],
        experience=[{"title": "Dev"}],
        assessment_answers=[],
    )
    assert calculate_profile_completeness(profile) == 100.0


def test_profile_completeness_missing_two_sections():
    profile = UserProfileInput(
        skills=["Python"],
        projects=[{"title": "P"}],
        education=[],
        experience=[],
        assessment_answers=[],
    )
    assert calculate_profile_completeness(profile) == 50.0


def test_skill_diversity_scales_with_categories():
    # مهارات من فئة واحدة فقط (Programming) -> تنوع منخفض
    low_diversity = calculate_skill_diversity(["Python", "Java", "C++"])
    # مهارات من 4 فئات مختلفة -> تنوع كامل (100)
    high_diversity = calculate_skill_diversity(["Python", "SQL", "Docker", "UI Design"])
    assert low_diversity < high_diversity
    assert high_diversity == 100.0


def _make_job_match(matched_skills=None, missing_essential=None):
    return JobMatchResult(
        job_title="Backend Developer",
        match_percentage=50.0,
        matched_skills=matched_skills or [],
        missing_skills=missing_essential or [],
        essential_skills=[],
        missing_essential=missing_essential or [],
        missing_important=[],
        missing_bonus=[],
    )


def test_generate_explanation_all_essential_present():
    job_match = _make_job_match(matched_skills=["Python", "SQL", "Docker"], missing_essential=[])
    explanation = generate_explanation(job_match)
    assert "جميع المهارات الأساسية" in explanation
    assert "Python" in explanation


def test_generate_explanation_all_essential_present_no_matched_skills():
    # حالة نادرة: لا مهارات أساسية أصلاً للوظيفة، فلا يوجد شيء مفقود ولا شيء متطابق
    job_match = _make_job_match(matched_skills=[], missing_essential=[])
    explanation = generate_explanation(job_match)
    assert "جميع المهارات الأساسية" in explanation


def test_generate_explanation_partial_match_with_missing_essential():
    job_match = _make_job_match(matched_skills=["Python", "SQL"], missing_essential=["AWS", "Docker"])
    explanation = generate_explanation(job_match)
    assert "Python" in explanation
    assert "AWS" in explanation
    assert "يُنصح بتطوير" in explanation


def test_generate_explanation_no_matched_skills_at_all():
    job_match = _make_job_match(matched_skills=[], missing_essential=["Python", "SQL"])
    explanation = generate_explanation(job_match)
    assert "لا تمتلك حالياً" in explanation
    assert "Python" in explanation
