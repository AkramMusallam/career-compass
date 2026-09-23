import re

with open('backend/app/services/recommendation_engine.py', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = '''def match_courses_to_skills(skill_gap: dict[str, list[str]], db: Session) -> list[dict]:
    all_missing = skill_gap["critical"] + skill_gap["recommended"] + skill_gap["nice_to_have"]
    if not all_missing:
        return []

    skills = db.query(Skill).filter(Skill.name.in_(all_missing)).all()
    skill_ids = [s.id for s in skills]
    
    courses_out = []
    if skill_ids:
        courses = db.query(Course).filter(Course.covers_skill_id.in_(skill_ids)).all()
        courses_out = [
            {
                "title": c.title,
                "platform": c.platform,
                "url": c.url,
                "covers_skill": c.skill.name
            }
            for c in courses
        ]

    # Phase 2: Dynamic Resource Recommendation Engine
    covered_skills = {c["covers_skill"] for c in courses_out}
    for skill_name in all_missing:
        if skill_name not in covered_skills:
            courses_out.append({
                "title": f"Learn {skill_name} - Full Course",
                "platform": "YouTube",
                "url": f"https://www.youtube.com/results?search_query=Learn+{skill_name.replace(' ', '+')}+full+course",
                "covers_skill": skill_name
            })
            courses_out.append({
                "title": f"{skill_name} Specialization",
                "platform": "Coursera",
                "url": f"https://www.coursera.org/search?query={skill_name.replace(' ', '%20')}",
                "covers_skill": skill_name
            })
            covered_skills.add(skill_name)
            
    return courses_out'''

content = re.sub(r'def match_courses_to_skills\(.*?\)\s*->\s*list\[dict\]:.*?(?=\n\n\n|\Z)', replacement, content, flags=re.DOTALL)

with open('backend/app/services/recommendation_engine.py', 'w', encoding='utf-8') as f:
    f.write(content)