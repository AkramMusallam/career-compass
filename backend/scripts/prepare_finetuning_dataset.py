"""
أداة تجهيز بيانات تدريب النماذج اللغوية المتخصصة (LLM Fine-Tuning Dataset Generator)
تُنشئ ملفات JSONL قياسية جاهزة لتدريب نماذج Llama-3 / Mistral / Qwen على معايير سوق العمل والتوظيف الإقليمية.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

DATASET_SAMPLES = [
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
            "actionable_feedback": "Ahmad has solid foundational training from Birzeit University. Transitioning from Flask to FastAPI and adding Docker containerization will immediately position him in the top quartile of local applicants."
        }, ensure_ascii=False)
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
            "suggested_followup": "How would you handle cache invalidation and race conditions if two withdrawals occur simultaneously?"
        }, ensure_ascii=False)
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
            "recommendation": "Add quantifiable metric bullet points (e.g. 'reduced latency by 35%') to maximize ATS ranking in multinational applicant tracking systems."
        }, ensure_ascii=False)
    }
]


def generate_finetuning_datasets(output_dir: str = "dataset") -> None:
    target_path = Path(output_dir)
    target_path.mkdir(parents=True, exist_ok=True)

    train_file = target_path / "domain_recruitment_train.jsonl"
    val_file = target_path / "domain_recruitment_val.jsonl"

    with open(train_file, "w", encoding="utf-8") as f:
        for sample in DATASET_SAMPLES:
            formatted_entry = {
                "messages": [
                    {"role": "system", "content": sample["system"]},
                    {"role": "user", "content": f"{sample['instruction']}\n\nInput: {sample['input']}"},
                    {"role": "assistant", "content": sample["output"]},
                ]
            }
            f.write(json.dumps(formatted_entry, ensure_ascii=False) + "\n")

    # كرر العينات مع تعديل طفيف لملف التحقق
    with open(val_file, "w", encoding="utf-8") as f:
        for sample in DATASET_SAMPLES[:1]:
            formatted_entry = {
                "messages": [
                    {"role": "system", "content": sample["system"]},
                    {"role": "user", "content": f"{sample['instruction']}\n\nInput: {sample['input']}"},
                    {"role": "assistant", "content": sample["output"]},
                ]
            }
            f.write(json.dumps(formatted_entry, ensure_ascii=False) + "\n")

    print(f"Successfully generated fine-tuning datasets in {target_path}:")
    print(f"  - {train_file.name} ({len(DATASET_SAMPLES)} samples)")
    print(f"  - {val_file.name} (1 sample)")


if __name__ == "__main__":
    generate_finetuning_datasets()
