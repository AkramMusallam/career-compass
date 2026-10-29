"""
خدمة التصنيف والتوطين الإقليمي لسوق العمل والتوظيف (Regional Recruitment Taxonomy & Domain Intelligence)
تُعنى بنمذجة معايير التوظيف الإقليمية لمنطقة الشرق الأوسط وشمال أفريقيا والسوق التقني الفلسطيني.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

# شركات التكنولوجيا والمؤسسات الرائدة في السوق الإقليمي
REGIONAL_COMPANIES = {
    "asal technologies": {"type": "Outsourcing & Enterprise", "location": "Ramallah", "tier": "Tier-1"},
    "exalt technologies": {"type": "Telecommunications & Embedded", "location": "Ramallah / Nablus", "tier": "Tier-1"},
    "harri": {"type": "Global SaaS / Hospitality Tech", "location": "Ramallah", "tier": "Product Company"},
    "foothill technology solutions": {"type": "HealthTech & Fintech", "location": "Nablus", "tier": "Tier-1"},
    "souktel": {"type": "Digital Solutions & Humanitarian Tech", "location": "Ramallah", "tier": "Tier-2"},
    "progineer technologies": {"type": "Software R&D", "location": "Ramallah", "tier": "Tier-1"},
    "paltel group": {"type": "Telecom & Cloud Infrastructure", "location": "Palestine", "tier": "Enterprise"},
    "jawwal": {"type": "Mobile Networks & Fintech", "location": "Palestine", "tier": "Enterprise"},
    "arab bank": {"type": "Fintech & Digital Banking", "location": "Regional / MENA", "tier": "Banking"},
    "bank of palestine": {"type": "Digital Banking & Payments", "location": "Palestine", "tier": "Banking"},
}

# الجامعات المرموقة ومعايير المعدلات التراكمية
REGIONAL_UNIVERSITIES = [
    "birzeit university",
    "جامعة بيرزيت",
    "an-najah national university",
    "جامعة النجاح الوطنية",
    "al-quds university",
    "جامعة القدس",
    "islamic university of gaza",
    "الجامعة الإسلامية بغزة",
    "palestine polytechnic university",
    "جامعة بوليتكنك فلسطين",
    "arab american university",
    "الجامعة العربية الأمريكية",
    "german jordanian university",
    "جامعة الأميرة سمية للتكنولوجيا",
]

# قاموس المصطلحات والمسميات الوظيفية الثنائية (عربي / إنجليزي)
BILINGUAL_ROLE_TAXONOMY = {
    "frontend developer": ["مطوّر واجهات أمامية", "مطور فرونت إند", "مهندس واجهات المستخدم", "frontend engineer"],
    "backend developer": ["مطوّر واجهات خلفية", "مطور باك إند", "مهندس خوادم ونظم خلفية", "backend engineer"],
    "full stack developer": ["مطوّر فل ستاك", "مطور ويب شامل", "full stack engineer"],
    "mobile developer": ["مطور تطبيقات الهواتف", "مطوّر تطبيقات ذكية", "ios/android developer", "flutter developer"],
    "devops engineer": ["مهندس ديف أوبس", "مهندس بنية تحتية وأتمتة", "cloud infrastructure engineer"],
    "data engineer": ["مهندس بيانات", "أخصائي معالجة البيانات الضخمة", "etl developer"],
    "data scientist": ["عالم بيانات", "أخصائي ذكاء اصطناعي", "ai specialist", "machine learning engineer"],
    "qa engineer": ["مهندس ضبط الجودة", "فاحص برمجيات", "software test automation engineer"],
    "ui/ux designer": ["مصمم تجربة وواجهة المستخدم", "مصمم منتجات رقمية", "product designer"],
}

# سلم الرواتب التقديري حسب سنوات الخبرة في السوق الفلسطيني / الإقليمي (بالدولار الأمريكي شهرياً)
SALARY_BENCHMARKS = {
    "junior": {"min": 1000, "max": 1800, "label": "$1,000 - $1,800"},
    "mid": {"min": 1800, "max": 3200, "label": "$1,800 - $3,200"},
    "senior": {"min": 3200, "max": 5500, "label": "$3,200 - $5,500"},
    "lead": {"min": 5000, "max": 8000, "label": "$5,000 - $8,000"},
}


def normalize_regional_job_title(title: str) -> str:
    """توحيد المسمى الوظيفي سواء كان مكتوباً بالعربية أو الإنجليزية."""
    lower_title = title.strip().lower()
    for standard_eng, synonyms in BILINGUAL_ROLE_TAXONOMY.items():
        if lower_title == standard_eng or lower_title in [s.lower() for s in synonyms]:
            return standard_eng.title()
        if any(syn in lower_title for syn in synonyms):
            return standard_eng.title()
    return title.strip().title()


def extract_regional_market_insights(skills: List[str], target_role: str, years_exp: float = 1.0) -> Dict[str, Any]:
    """استخراج تقييم سوقي يتضمن النطاق المالي والشركات المستهدفة محلياً."""
    norm_role = normalize_regional_job_title(target_role)

    if years_exp < 2:
        tier_key = "junior"
        level_label = "مبتدئ / خريج جديد (Junior / Graduate)"
    elif years_exp < 5:
        tier_key = "mid"
        level_label = "متوسط الخبرة (Mid-Level)"
    else:
        tier_key = "senior"
        level_label = "خبير / متقدم (Senior Professional)"

    salary_info = SALARY_BENCHMARKS.get(tier_key, SALARY_BENCHMARKS["junior"])

    # مطابقة الشركات الإقليمية المهتمة بهذه المهارات
    matched_companies = []
    norm_skills_lower = {s.strip().lower() for s in skills}
    for comp, meta in REGIONAL_COMPANIES.items():
        matched_companies.append({
            "name": comp.title(),
            "location": meta["location"],
            "type": meta["type"],
            "tier": meta["tier"],
        })

    return {
        "normalized_role": norm_role,
        "market_level": level_label,
        "estimated_salary_usd": salary_info["label"],
        "recommended_regional_hubs": ["Ramallah", "Nablus", "Remote (MENA / Global)", "Amman / Dubai"],
        "top_regional_employers": matched_companies[:5],
        "in_demand_regional_skills": ["FastAPI", "React", "Docker", "PostgreSQL", "Next.js", "TypeScript", "Tailwind CSS"],
    }
