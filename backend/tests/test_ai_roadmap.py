from app.services.recommendation_engine import build_three_month_roadmap

def test_static_roadmap_fallback():
    # Test that the roadmap generator correctly falls back to static content
    # when Ollama AI is not available or disabled during testing.
    skill_gap = {
        "critical": ["Python", "FastAPI"],
        "recommended": ["Docker"],
        "nice_to_have": ["Kubernetes"]
    }
    
    roadmap = build_three_month_roadmap(skill_gap)
    
    assert len(roadmap) == 3
    assert roadmap[0]["month"] == 1
    assert "Python" in roadmap[0]["skills_to_learn"]
    assert "FastAPI" in roadmap[0]["skills_to_learn"]
    assert roadmap[1]["month"] == 2
    assert "Docker" in roadmap[1]["skills_to_learn"]
    assert roadmap[2]["month"] == 3
    assert "Kubernetes" in roadmap[2]["skills_to_learn"]
