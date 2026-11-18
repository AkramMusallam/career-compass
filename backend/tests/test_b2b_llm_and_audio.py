import io
import json
import math
import struct
import uuid
import wave
from pathlib import Path
from unittest.mock import patch

from app.core.mongo import extractions_collection, mongo_db, recruiter_jobs_collection
from app.core.security import decode_access_token
from app.services.audio_metrics import extract_acoustic_metrics
from app.services.interview_service import analyze_vocal_delivery
from scripts.prepare_finetuning_dataset import build_regional_taxonomy_samples, generate_finetuning_datasets


def _build_synthetic_wav_bytes(*, speech_seconds: float = 1.5, silence_seconds: float = 1.0, sample_rate: int = 16000) -> bytes:
    """Builds a valid in-memory WAV stream with tone bursts and quiet pauses."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        frames = bytearray()
        speech_samples = int(speech_seconds * sample_rate)
        silence_samples = int(silence_seconds * sample_rate)
        for i in range(speech_samples):
            val = int(12000 * math.sin(2.0 * math.pi * 440.0 * i / sample_rate))
            frames.extend(struct.pack("<h", val))
        frames.extend(b"\x00\x00" * silence_samples)
        for i in range(speech_samples // 2):
            val = int(11000 * math.sin(2.0 * math.pi * 440.0 * i / sample_rate))
            frames.extend(struct.pack("<h", val))
        wf.writeframes(bytes(frames))
    return buf.getvalue()


def test_pyav_extract_acoustic_metrics_and_vocal_delivery():
    wav_bytes = _build_synthetic_wav_bytes(speech_seconds=1.4, silence_seconds=1.2)
    metrics = extract_acoustic_metrics(wav_bytes)
    assert metrics is not None
    assert 3.0 <= metrics.decoded_duration_seconds <= 4.2
    assert 0.2 <= metrics.silence_ratio <= 0.65
    assert metrics.pause_count >= 1
    assert metrics.rms_db > -30.0

    # Corrupt / empty bytes gracefully return None without breaking vocal delivery
    assert extract_acoustic_metrics(b"") is None
    assert extract_acoustic_metrics(b"not-valid-audio-data" * 10) is None

    transcript = "We used FastAPI with Redis caching and PostgreSQL indexing to cut API latency cleanly in production."
    feedback = analyze_vocal_delivery(transcript, duration_seconds=0.0, job_title="Backend Engineer", audio_bytes=wav_bytes)
    assert feedback.acoustic_analysis_used is True
    assert feedback.audio_duration_seconds is not None and feedback.audio_duration_seconds > 2.5
    assert feedback.silence_ratio is not None
    assert 5 <= feedback.clarity_score <= 10
    assert 5 <= feedback.confidence_score <= 10


def test_recruiter_cached_and_on_demand_ai_review(client, registered_user_token):
    token, _ = registered_user_token
    headers = {"Authorization": f"Bearer {token}"}
    recruiter_id = int(decode_access_token(token)["sub"])

    cand_email = f"cand.{uuid.uuid4().hex[:8]}@example.com"
    client.post("/register", json={"full_name": "B2B Candidate", "email": cand_email, "password": "Passw0rd123"})
    cand_login = client.post("/login", json={"email": cand_email, "password": "Passw0rd123"})
    cand_token = cand_login.json()["access_token"]
    cand_id = int(decode_access_token(cand_token)["sub"])

    company_id = f"comp-{uuid.uuid4().hex[:8]}"
    job_id = f"job-{uuid.uuid4().hex[:8]}"
    ext_id = f"ext-{uuid.uuid4().hex[:8]}"

    mongo_db["companies"].insert_one(
        {"company_id": company_id, "owner_id": recruiter_id, "status": "approved", "name": "B2BCo"}
    )
    recruiter_jobs_collection.insert_one(
        {
            "job_id": job_id,
            "company_id": company_id,
            "recruiter_id": recruiter_id,
            "status": "active",
            "title": "Backend Engineer",
            "company_name": "B2BCo",
            "required_skills": ["Python", "FastAPI", "Docker"],
            "bonus_skills": ["Redis"],
        }
    )
    mongo_db["recruiter_consent"].update_one({"_id": cand_id}, {"$set": {"consented": True}}, upsert=True)
    extractions_collection.insert_one(
        {
            "extraction_id": ext_id,
            "user_id": cand_id,
            "skills": ["Python", "FastAPI"],
            "target_role": "Backend Developer",
            "experience": [],
            "projects": [],
            "education": [],
            "ats_score": 84,
            "status": "confirmed",
        }
    )

    llm_json = json.dumps(
        {
            "verdict": "مرشح ممتاز للمقابلة التقنية",
            "fit_summary": "خبرة متينة في Python و FastAPI مع فرصة سريعة لتغطية Docker.",
            "interview_focus_areas": ["معمارية FastAPI", "نشر الحاويات بـ Docker"],
            "hiring_readiness": "High",
        },
        ensure_ascii=False,
    )

    try:
        with patch("ollama.Client.chat", return_value={"message": {"content": llm_json}}) as mock_chat:
            ai_res = client.post(
                f"/recruiter/jobs/{job_id}/candidates/{ext_id}/ai-review",
                headers={**headers, "X-Company-Id": company_id},
            )
            assert ai_res.status_code == 200
            ai_data = ai_res.json()
            assert ai_data["evaluation_source"] == "llm"
            assert ai_data["hiring_readiness"] == "High"
            assert len(ai_data["interview_focus_areas"]) == 2
            assert mock_chat.call_count == 1

            # Subsequent ranked list read hits Mongo recruiter_fit_cache without extra Ollama call
            list_res = client.get(
                f"/recruiter/jobs/{job_id}/candidates",
                headers={**headers, "X-Company-Id": company_id},
            )
            assert list_res.status_code == 200
            matched_cand = next(c for c in list_res.json()["candidates"] if c["candidate_id"] == ext_id)
            assert matched_cand["evaluation_source"] == "llm"
            assert matched_cand["fit_verdict"] == "مرشح ممتاز للمقابلة التقنية"
            assert mock_chat.call_count == 1
    finally:
        mongo_db["recruiter_fit_cache"].delete_many({"job_id": job_id})
        extractions_collection.delete_one({"extraction_id": ext_id})
        mongo_db["recruiter_consent"].delete_one({"_id": cand_id})
        recruiter_jobs_collection.delete_one({"job_id": job_id})
        mongo_db["companies"].delete_one({"company_id": company_id})


def test_prepare_finetuning_dataset_expands_regional_corpus(tmp_path: Path):
    samples = build_regional_taxonomy_samples()
    assert len(samples) >= 24
    generate_finetuning_datasets(str(tmp_path))
    train_lines = (tmp_path / "domain_recruitment_train.jsonl").read_text(encoding="utf-8").strip().splitlines()
    val_lines = (tmp_path / "domain_recruitment_val.jsonl").read_text(encoding="utf-8").strip().splitlines()
    assert len(train_lines) >= 20
    assert len(val_lines) >= 2
    first = json.loads(train_lines[0])
    assert "messages" in first and len(first["messages"]) == 3
