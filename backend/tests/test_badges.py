from datetime import datetime, timedelta

from app.services.badges import compute_user_badges

BASE_DATE = datetime(2026, 1, 1)


def _analysis(days_offset, score, roadmap=None, completed_skills=None):
    return {
        "date": BASE_DATE + timedelta(days=days_offset),
        "career_score": score,
        "roadmap": roadmap or [],
        "completed_skills": completed_skills or [],
    }


def _badge_map(analyses):
    return {b["id"]: b for b in compute_user_badges(analyses)}


def test_no_analyses_no_badges_achieved():
    badges = _badge_map([])
    assert all(not b["achieved"] for b in badges.values())


def test_first_analysis_achieved_with_one_analysis():
    badges = _badge_map([_analysis(0, 40)])
    assert badges["first_analysis"]["achieved"] is True
    assert badges["first_analysis"]["achieved_at"] == BASE_DATE
    assert badges["score_boost_10"]["achieved"] is False
    assert badges["first_month_roadmap"]["achieved"] is False


def test_score_boost_10_achieved_across_two_analyses():
    analyses = [_analysis(0, 40), _analysis(10, 51)]
    badges = _badge_map(analyses)
    assert badges["score_boost_10"]["achieved"] is True
    assert badges["score_boost_10"]["achieved_at"] == BASE_DATE + timedelta(days=10)


def test_score_boost_10_not_achieved_with_small_improvement():
    analyses = [_analysis(0, 40), _analysis(10, 45)]
    badges = _badge_map(analyses)
    assert badges["score_boost_10"]["achieved"] is False


def test_score_boost_10_uses_minimum_seen_so_far():
    # حتى لو انخفضت الدرجة مؤقتاً ثم ارتفعت لاحقاً بفارق 10 عن أدنى نقطة، يُعتبر إنجازاً
    analyses = [_analysis(0, 50), _analysis(5, 30), _analysis(10, 41)]
    badges = _badge_map(analyses)
    assert badges["score_boost_10"]["achieved"] is True


def test_first_month_roadmap_achieved_when_all_skills_completed():
    roadmap = [{"month": 1, "skills_to_learn": ["AWS", "CI/CD"], "goals": []}]
    analyses = [_analysis(0, 40, roadmap=roadmap, completed_skills=["AWS", "CI/CD"])]
    badges = _badge_map(analyses)
    assert badges["first_month_roadmap"]["achieved"] is True


def test_first_month_roadmap_not_achieved_when_partial():
    roadmap = [{"month": 1, "skills_to_learn": ["AWS", "CI/CD"], "goals": []}]
    analyses = [_analysis(0, 40, roadmap=roadmap, completed_skills=["AWS"])]
    badges = _badge_map(analyses)
    assert badges["first_month_roadmap"]["achieved"] is False


def test_first_month_roadmap_skipped_when_no_skills_required():
    roadmap = [{"month": 1, "skills_to_learn": [], "goals": ["تعزيز المهارات الحالية"]}]
    analyses = [_analysis(0, 40, roadmap=roadmap, completed_skills=[])]
    badges = _badge_map(analyses)
    assert badges["first_month_roadmap"]["achieved"] is False
