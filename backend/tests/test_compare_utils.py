from app.services.compare_utils import compute_comparison, compute_matched_skills_set


def _make_doc(career_score, matched_skills_per_job):
    return {
        "career_score": career_score,
        "top_jobs": [{"matched_skills": skills} for skills in matched_skills_per_job],
    }


def test_compute_matched_skills_set_unions_across_jobs():
    doc = _make_doc(50, [["Python", "SQL"], ["SQL", "Docker"]])
    assert compute_matched_skills_set(doc) == {"Python", "SQL", "Docker"}


def test_compute_matched_skills_set_empty_when_no_jobs():
    doc = {"top_jobs": []}
    assert compute_matched_skills_set(doc) == set()


def test_compute_comparison_positive_delta_and_new_skills():
    doc_a = _make_doc(40, [["Python"]])
    doc_b = _make_doc(65, [["Python", "SQL", "Docker"]])
    result = compute_comparison(doc_a, doc_b)
    assert result["career_score_delta"] == 25.0
    assert result["new_skills_gained"] == ["Docker", "SQL"]
    assert result["skills_lost"] == []


def test_compute_comparison_negative_delta_and_skills_lost():
    doc_a = _make_doc(70, [["Python", "SQL", "AWS"]])
    doc_b = _make_doc(55, [["Python"]])
    result = compute_comparison(doc_a, doc_b)
    assert result["career_score_delta"] == -15.0
    assert result["new_skills_gained"] == []
    assert result["skills_lost"] == ["AWS", "SQL"]


def test_compute_comparison_identical_analyses():
    doc = _make_doc(60, [["Python", "SQL"]])
    result = compute_comparison(doc, doc)
    assert result["career_score_delta"] == 0.0
    assert result["new_skills_gained"] == []
    assert result["skills_lost"] == []
