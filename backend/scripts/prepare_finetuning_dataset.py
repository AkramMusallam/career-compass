"""
أداة تجهيز بيانات تدريب النماذج اللغوية المتخصصة (LLM Fine-Tuning Dataset Generator)
تُنشئ ملفات JSONL قياسية جاهزة لتدريب نماذج Llama-3 / Mistral / Qwen على معايير سوق العمل والتوظيف الإقليمية.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

from app.services.regional_taxonomy import (
    BILINGUAL_ROLE_TAXONOMY,
    REGIONAL_COMPANIES,
    REGIONAL_UNIVERSITIES,
    SALARY_BENCHMARKS,
)

DATASET_SAMPLES: List[Dict[str, str]] = [
    {
        "system": "You are a bilingual Arab/MENA senior technical recruiter and talent advisor.",
        "instruction": "Analyze this candidate's resume snippet for a Junior Backend Developer role in Ramallah and provide structured feedback according to Palestinian tech market standards.",
        "input": "Candidate: Ahmad Khalil. Education: BSc Computer Science, Birzeit University (GPA 84.5%). Skills: Python, Flask, SQLite, Git, Linux. Projects: Built an e-commerce REST API with JWT auth and Stripe checkout.",
        "output": json.dumps({
            "regional_fit_score": 88,
            "tier_readiness": "Tier-1 Palestinian Tech Ready (Asal / Exalt / Harri)",
            "matched_skills": ["Python", "REST API", "Git", "Linux", "JWT"],
            "missing_for_market": ["FastAPI / Django", "Docker", "PostgreSQL", "Unit Testing"],
            "salary_range_usd": "$1,100 - $1,600",
            "actionable_feedback": "Ahmad has solid foundational training from Birzeit University. Transitioning from Flask to FastAPI and adding Docker containerization will immediately position him in the top quartile of local applicants.",
        }, ensure_ascii=False),
    },
    {
        "system": "You are a bilingual Arab/MENA senior technical recruiter and talent advisor.",
        "instruction": "Evaluate the technical interview performance of a candidate responding to a system design question about handling high concurrency in a regional fintech gateway.",
        "input": "Candidate response: 'I would put a Redis cache in front of MySQL to cache account balances, and use Celery or Kafka for asynchronous background transaction logs.'",
        "output": json.dumps({
            "score": 9,
            "communication_clarity": "High",
            "technical_depth": "Strong architectural reasoning separating caching layer from async write queues.",
            "feedback_ar": "إجابة ممتازة تعكس وعياً بحماية قاعدة البيانات عبر Redis وفصل تسجيل العمليات غير المتزامنة.",
            "suggested_followup": "How would you handle cache invalidation and race conditions if two withdrawals occur simultaneously?",
        }, ensure_ascii=False),
    },
    {
        "system": "You are an ATS compliance auditor specializing in bilingual Arabic-English resumes.",
        "instruction": "Audit the following resume text for ATS parsing safety and regional formatting requirements.",
        "input": "مهندس برمجيات | خبرة سنتين في تطوير تطبيقات الويب باستخدام React و Node.js | خريج جامعة النجاح الوطنية",
        "output": json.dumps({
            "ats_compatibility": 92,
            "bilingual_structure_safe": True,
            "detected_skills": ["React", "Node.js", "Web Development"],
            "institution": "An-Najah National University",
            "recommendation": "Add quantifiable metric bullet points (e.g. 'reduced latency by 35%') to maximize ATS ranking in multinational applicant tracking systems.",
        }, ensure_ascii=False),
    },
]


_ROLE_SKILL_CLUSTERS: Dict[str, tuple[List[str], List[str]]] = {
    "frontend developer": (["React", "TypeScript", "Tailwind CSS", "HTML", "CSS"], ["Next.js", "Testing Library"]),
    "backend developer": (["Python", "FastAPI", "PostgreSQL", "Docker", "REST API"], ["Redis", "Kubernetes"]),
    "full stack developer": (["React", "Node.js", "TypeScript", "SQL", "Docker"], ["Next.js", "CI/CD"]),
    "mobile developer": (["Flutter", "Dart", "REST API", "Firebase", "Git"], ["Swift", "Kotlin"]),
    "devops engineer": (["Docker", "Kubernetes", "Linux", "Terraform", "CI/CD"], ["AWS", "Prometheus"]),
    "data engineer": (["Python", "SQL", "Apache Spark", "PostgreSQL", "Docker"], ["Airflow", "dbt"]),
    "data scientist": (["Python", "PyTorch", "Pandas", "SQL", "Scikit-learn"], ["MLflow", "FastAPI"]),
    "qa engineer": (["Pytest", "Playwright", "Selenium", "REST API", "SQL"], ["CI/CD", "k6"]),
    "ui/ux designer": (["Figma", "Design Systems", "Prototyping", "Wireframing", "UX Research"], ["Tailwind CSS", "Accessibility"]),
}


def build_regional_taxonomy_samples() -> List[Dict[str, str]]:
    """Builds structured bilingual evaluation samples grounded in regional companies, universities, and salary tiers."""
    samples: List[Dict[str, str]] = list(DATASET_SAMPLES)
    company_items = list(REGIONAL_COMPANIES.items())
    universities = REGIONAL_UNIVERSITIES
    salary_tiers = list(SALARY_BENCHMARKS.items())

    for idx, (eng_role, ar_synonyms) in enumerate(BILINGUAL_ROLE_TAXONOMY.items()):
        req_skills, bon_skills = _ROLE_SKILL_CLUSTERS.get(
            eng_role,
            (["Python", "SQL", "Git"], ["Docker", "CI/CD"]),
        )
        comp_name, comp_meta = company_items[idx % len(company_items)]
        uni_name = universities[idx % len(universities)]
        tier_key, salary_meta = salary_tiers[idx % len(salary_tiers)]
        ar_role = ar_synonyms[0] if ar_synonyms else eng_role

        # 1. Strong Fit sample (Arabic B2B Recruiter Verdict JSON)
        strong_skills = req_skills + bon_skills[:1]
        samples.append(
            {
                "system": "أنت خبير توظيف تقني أول متخصص في أسواق التكنولوجيا الإقليمية والعالمية وتُرجع JSON صالحاً فقط.",
                "instruction": f"قيّم ملاءمة المرشح لوظيفة {eng_role.title()} لدى شركة {comp_name.title()} في {comp_meta['location']}.",
                "input": (
                    f"المرشح: خريج {uni_name} | المسمى المستهدف: {ar_role} | "
                    f"المهارات: {', '.join(strong_skills)} | التطابق: 90% | النطاق المالي المتوقع ({tier_key}): {salary_meta['label']}"
                ),
                "output": json.dumps(
                    {
                        "verdict": f"مرشح متميز - موصى به بقوة لمقابلة {comp_name.title()}",
                        "fit_summary": (
                            f"يغطي المرشح المهارات الجوهرية لدور {eng_role.title()} ({', '.join(req_skills[:3])}) "
                            f"ويتوافق مع بيئة {comp_meta['type']} في {comp_meta['location']}."
                        ),
                        "interview_focus_areas": [
                            f"مناقشة تطبيق عملي متقدم في {req_skills[0]} ومقاييس الأداء",
                            f"تقييم الخبرة المعمارية في {bon_skills[-1] if bon_skills else 'اختبارات الجودة'}",
                        ],
                        "hiring_readiness": "High",
                    },
                    ensure_ascii=False,
                ),
            }
        )

        # 2. Medium Fit sample (Missing 2 required skills -> actionable Arabic coaching)
        partial_skills = req_skills[:2]
        missing = req_skills[2:4]
        samples.append(
            {
                "system": "أنت خبير توظيف تقني أول متخصص في أسواق التكنولوجيا الإقليمية والعالمية وتُرجع JSON صالحاً فقط.",
                "instruction": f"قدّم توصية فحص فني لمرشح متوسط التطابق يتقدم لشواغر {ar_role} ({comp_meta['tier']}).",
                "input": (
                    f"الخلفية الأكاديمية: {uni_name} | المهارات المتوفرة: {', '.join(partial_skills)} | "
                    f"المهارات الناقصة: {', '.join(missing)} | نسبة التطابق: 56%"
                ),
                "output": json.dumps(
                    {
                        "verdict": "مرشح مناسب للمقابلة الأولية مع اختبار عملي مركز",
                        "fit_summary": (
                            f"يمتلك المرشح أساساً جيداً في {', '.join(partial_skills)}، مع حاجة للتحقق من قدرته "
                            f"على استيعاب {', '.join(missing)} سريعاً ضمن فريق {comp_name.title()}."
                        ),
                        "interview_focus_areas": [
                            f"تكليف عملي قصير أو سؤال سيناريو حول {missing[0] if missing else req_skills[-1]}",
                            f"فحص جودة المشاريع المبنية سابقاً باستخدام {partial_skills[0]}",
                        ],
                        "hiring_readiness": "Medium",
                    },
                    ensure_ascii=False,
                ),
            }
        )

        # 3. Upskilling sample
        samples.append(
            {
                "system": "You are a bilingual Arab/MENA career advisor converting skill gaps into actionable 90-day learning plans.",
                "instruction": f"Recommend a targeted upskilling focus for a junior applicant aiming at {eng_role.title()} ({comp_meta['tier']} salary tier {salary_meta['label']}).",
                "input": f"University: {uni_name}. Current skills: {req_skills[0]}. Target role: {ar_role}. Missing critical skills: {', '.join(req_skills[1:])}.",
                "output": json.dumps(
                    {
                        "verdict": "يحتاج إلى برنامج تأهيل وتطوير قبل المقابلة النهائية",
                        "fit_summary": (
                            f"المرشح في مرحلة بناء الأساس لدور {eng_role.title()}؛ إتقان {req_skills[1]} و{req_skills[2] if len(req_skills) > 2 else req_skills[-1]} "
                            f"سيرفع فرص قبوله لدى شركات {comp_meta['location']}."
                        ),
                        "interview_focus_areas": [
                            f"تقييم أساسيات {req_skills[0]} وقدرات حل المشكلات البرمجية",
                            f"مراجعة خطة التعلم العملية لبناء مشروع متكامل يضم {', '.join(req_skills[1:3])}",
                        ],
                        "hiring_readiness": "Needs Upskilling",
                    },
                    ensure_ascii=False,
                ),
            }
        )

    return samples


def generate_finetuning_datasets(output_dir: str = "dataset") -> None:
    target_path = Path(output_dir)
    target_path.mkdir(parents=True, exist_ok=True)

    all_samples = build_regional_taxonomy_samples()
    split_idx = max(1, int(len(all_samples) * 0.85))
    train_samples = all_samples[:split_idx]
    val_samples = all_samples[split_idx:] or all_samples[:2]

    train_file = target_path / "domain_recruitment_train.jsonl"
    val_file = target_path / "domain_recruitment_val.jsonl"

    def _write_jsonl(path: Path, rows: List[Dict[str, str]]) -> None:
        with open(path, "w", encoding="utf-8") as f:
            for sample in rows:
                formatted_entry = {
                    "messages": [
                        {"role": "system", "content": sample["system"]},
                        {"role": "user", "content": f"{sample['instruction']}\n\nInput: {sample['input']}"},
                        {"role": "assistant", "content": sample["output"]},
                    ]
                }
                f.write(json.dumps(formatted_entry, ensure_ascii=False) + "\n")

    _write_jsonl(train_file, train_samples)
    _write_jsonl(val_file, val_samples)

    print(f"Successfully generated fine-tuning datasets in {target_path}:")
    print(f"  - {train_file.name} ({len(train_samples)} samples)")
    print(f"  - {val_file.name} ({len(val_samples)} samples)")


if __name__ == "__main__":
    generate_finetuning_datasets()
