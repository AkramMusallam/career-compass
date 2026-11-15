"""
خدمة جلب ومطابقة الوظائف الحية من أسواق العمل الخارجية (Live Market Job Aggregator — Section 7.1).

تدعم:
- Remotive Public Jobs API (تقني عن بُعد، بدون مفتاح API).
- Arbeitnow Public Job Board API (فرص عالمية وعن بُعد، بدون مفتاح API).
- Adzuna API اختيارياً عند ضبط ADZUNA_APP_ID / ADZUNA_APP_KEY في متغيرات البيئة.
مع تخزين مؤقت (Redis ثم MongoDB) وتنظيف صارم للروابط (SSRF / XSS safe) وعزل الشبكة أثناء الاختبارات.
"""
from __future__ import annotations

import html
import ipaddress
import json
import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from unittest.mock import AsyncMock, MagicMock, NonCallableMagicMock
from urllib.parse import quote_plus, urlparse

import httpx

from app.core.config import settings
from app.core.mongo import mongo_db

logger = logging.getLogger("career_compass.live_jobs")

_HTML_TAG_RE = re.compile(r"<[^>]+>")
_WHITESPACE_RE = re.compile(r"\s+")

_COMMON_EXTRACTED_SKILLS: tuple[str, ...] = (
    "Python",
    "FastAPI",
    "Django",
    "Flask",
    "JavaScript",
    "TypeScript",
    "React",
    "Next.js",
    "Vue",
    "Node.js",
    "SQL",
    "PostgreSQL",
    "MySQL",
    "MongoDB",
    "Redis",
    "Docker",
    "Kubernetes",
    "AWS",
    "GCP",
    "Azure",
    "Git",
    "CI/CD",
    "Linux",
    "REST API",
    "GraphQL",
    "Java",
    "Spring Boot",
    "Go",
    "Rust",
    "C#",
    ".NET",
    "Flutter",
    "React Native",
    "Machine Learning",
    "PyTorch",
    "TensorFlow",
    "Pandas",
    "Spark",
    "Terraform",
    "Tailwind CSS",
)


def _is_httpx_mocked() -> bool:
    return isinstance(getattr(httpx, "get", None), (MagicMock, NonCallableMagicMock, AsyncMock))


def sanitize_external_url(raw_url: Any) -> Optional[str]:
    """Allows only safe public http/https URLs; blocks javascript:, data:, credentials, and loopback/private IPs."""
    if not isinstance(raw_url, str):
        return None
    candidate = raw_url.strip()
    if not candidate or len(candidate) > 1000:
        return None
    try:
        parsed = urlparse(candidate)
    except Exception:
        return None

    if parsed.scheme.lower() not in ("http", "https"):
        return None
    if not parsed.netloc or not parsed.hostname or parsed.username or parsed.password:
        return None

    host = parsed.hostname.strip().lower()
    if host in ("localhost", "ip6-localhost") or host.endswith(".local") or host.endswith(".internal"):
        return None
    try:
        ip_obj = ipaddress.ip_address(host)
        if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local or ip_obj.is_reserved or ip_obj.is_multicast:
            return None
    except ValueError:
        pass
    return candidate


def _clean_html_text(raw: Any, max_len: int = 500) -> str:
    if not raw:
        return ""
    text = html.unescape(str(raw))
    text = _HTML_TAG_RE.sub(" ", text)
    text = _WHITESPACE_RE.sub(" ", text).strip()
    if len(text) > max_len:
        return text[: max_len - 3].rstrip() + "..."
    return text


def _extract_job_skills(raw_tags: Any, title: str, description: str) -> List[str]:
    seen_lower: set[str] = set()
    skills: List[str] = []

    if isinstance(raw_tags, list):
        for tag in raw_tags:
            cleaned = str(tag or "").strip()
            if cleaned and len(cleaned) <= 40 and cleaned.lower() not in seen_lower:
                seen_lower.add(cleaned.lower())
                skills.append(cleaned)

    searchable = f"{title} {description}".lower()
    for skill in _COMMON_EXTRACTED_SKILLS:
        sl = skill.lower()
        if sl in seen_lower:
            continue
        pattern = rf"(?<![a-z0-9]){re.escape(sl)}(?![a-z0-9])"
        if re.search(pattern, searchable):
            seen_lower.add(sl)
            skills.append(skill)
        if len(skills) >= 12:
            break

    return skills[:12]


def _format_epoch_or_iso(raw_val: Any) -> str:
    if isinstance(raw_val, (int, float)) and raw_val > 0:
        try:
            return datetime.fromtimestamp(float(raw_val), tz=timezone.utc).date().isoformat()
        except Exception:
            pass
    if isinstance(raw_val, str) and raw_val.strip():
        return raw_val.strip()[:25]
    return datetime.now(timezone.utc).date().isoformat()


def _fetch_remotive_jobs(timeout: float) -> List[Dict[str, Any]]:
    resp = httpx.get("https://remotive.com/api/remote-jobs?limit=40", timeout=timeout)
    resp.raise_for_status()
    payload = resp.json() or {}
    out: List[Dict[str, Any]] = []
    for item in payload.get("jobs") or []:
        if not isinstance(item, dict) or not item.get("title"):
            continue
        apply_url = sanitize_external_url(item.get("url"))
        if not apply_url:
            continue
        desc = _clean_html_text(item.get("description"), 500)
        title = _clean_html_text(item.get("title"), 150)
        skills = _extract_job_skills(item.get("tags"), title, desc)
        out.append(
            {
                "id": f"remotive-{item.get('id') or len(out)}",
                "title": title,
                "company": _clean_html_text(item.get("company_name"), 120) or "Remote Company",
                "company_url": apply_url,
                "location": _clean_html_text(item.get("candidate_required_location"), 100) or "Remote",
                "type": _clean_html_text(item.get("job_type"), 40) or "Full-time",
                "experience_level": _clean_html_text(item.get("category"), 60) or "Mid/Senior",
                "salary_range": _clean_html_text(item.get("salary"), 60) or "حسب السوق",
                "description": desc,
                "apply_url": apply_url,
                "posted_date": _format_epoch_or_iso(item.get("publication_date")),
                "required_skills": skills,
                "bonus_skills": [],
                "source": "external",
                "source_name": "Remotive",
            }
        )
    return out


def _fetch_arbeitnow_jobs(timeout: float) -> List[Dict[str, Any]]:
    resp = httpx.get("https://www.arbeitnow.com/api/job-board-api", timeout=timeout)
    resp.raise_for_status()
    payload = resp.json() or {}
    out: List[Dict[str, Any]] = []
    for idx, item in enumerate((payload.get("data") or [])[:40]):
        if not isinstance(item, dict) or not item.get("title"):
            continue
        apply_url = sanitize_external_url(item.get("url"))
        if not apply_url:
            continue
        desc = _clean_html_text(item.get("description"), 500)
        title = _clean_html_text(item.get("title"), 150)
        skills = _extract_job_skills(item.get("tags"), title, desc)
        location = _clean_html_text(item.get("location"), 100) or ("Remote" if item.get("remote") else "Global")
        out.append(
            {
                "id": f"arbeitnow-{item.get('slug') or idx}",
                "title": title,
                "company": _clean_html_text(item.get("company_name"), 120) or "Hiring Company",
                "company_url": apply_url,
                "location": location,
                "type": "Remote" if item.get("remote") else "Full-time",
                "experience_level": "All Levels",
                "salary_range": "حسب السوق",
                "description": desc,
                "apply_url": apply_url,
                "posted_date": _format_epoch_or_iso(item.get("created_at")),
                "required_skills": skills,
                "bonus_skills": [],
                "source": "external",
                "source_name": "Arbeitnow",
            }
        )
    return out


def _fetch_adzuna_jobs(query_role: str, timeout: float) -> List[Dict[str, Any]]:
    if not (settings.ADZUNA_APP_ID and settings.ADZUNA_APP_KEY):
        return []
    country = (settings.ADZUNA_COUNTRY or "gb").strip().lower()
    what = quote_plus((query_role or "software engineer")[:80])
    url = (
        f"https://api.adzuna.com/v1/api/jobs/{country}/search/1"
        f"?app_id={quote_plus(settings.ADZUNA_APP_ID)}"
        f"&app_key={quote_plus(settings.ADZUNA_APP_KEY)}"
        f"&results_per_page=20&what={what}"
    )
    resp = httpx.get(url, timeout=timeout)
    resp.raise_for_status()
    payload = resp.json() or {}
    out: List[Dict[str, Any]] = []
    for item in payload.get("results") or []:
        if not isinstance(item, dict) or not item.get("title"):
            continue
        apply_url = sanitize_external_url(item.get("redirect_url"))
        if not apply_url:
            continue
        desc = _clean_html_text(item.get("description"), 500)
        title = _clean_html_text(item.get("title"), 150)
        company_info = item.get("company") if isinstance(item.get("company"), dict) else {}
        loc_info = item.get("location") if isinstance(item.get("location"), dict) else {}
        s_min = item.get("salary_min")
        s_max = item.get("salary_max")
        salary_label = f"{int(s_min)} - {int(s_max)}" if isinstance(s_min, (int, float)) and isinstance(s_max, (int, float)) else "حسب السوق"
        out.append(
            {
                "id": f"adzuna-{item.get('id') or len(out)}",
                "title": title,
                "company": _clean_html_text(company_info.get("display_name"), 120) or "Employer",
                "company_url": apply_url,
                "location": _clean_html_text(loc_info.get("display_name"), 100) or country.upper(),
                "type": _clean_html_text(item.get("contract_time") or item.get("contract_type"), 40) or "Full-time",
                "experience_level": "Market Role",
                "salary_range": salary_label,
                "description": desc,
                "apply_url": apply_url,
                "posted_date": _format_epoch_or_iso(item.get("created")),
                "required_skills": _extract_job_skills([], title, desc),
                "bonus_skills": [],
                "source": "external",
                "source_name": "Adzuna",
            }
        )
    return out


def _read_cached_feed(cache_key: str) -> Optional[List[Dict[str, Any]]]:
    try:
        import redis

        r = redis.from_url(settings.REDIS_URL, socket_connect_timeout=1.0, socket_timeout=1.0)
        raw = r.get(f"career_compass:{cache_key}")
        if raw:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return parsed
    except Exception:
        pass

    try:
        doc = mongo_db["external_jobs_cache"].find_one({"cache_key": cache_key})
        if doc:
            expires_at = float(doc.get("expires_at") or 0.0)
            if expires_at > datetime.now(timezone.utc).timestamp() and isinstance(doc.get("jobs"), list):
                return doc["jobs"]
    except Exception:
        pass

    return None


def _write_cached_feed(cache_key: str, jobs: List[Dict[str, Any]]) -> None:
    ttl = max(60, int(settings.LIVE_JOBS_CACHE_TTL_SECONDS))
    try:
        import redis

        r = redis.from_url(settings.REDIS_URL, socket_connect_timeout=1.0, socket_timeout=1.0)
        r.setex(f"career_compass:{cache_key}", ttl, json.dumps(jobs, ensure_ascii=False))
    except Exception:
        pass

    try:
        now_ts = datetime.now(timezone.utc).timestamp()
        mongo_db["external_jobs_cache"].update_one(
            {"cache_key": cache_key},
            {
                "$set": {
                    "cache_key": cache_key,
                    "jobs": jobs,
                    "expires_at": now_ts + ttl,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            },
            upsert=True,
        )
    except Exception:
        pass


def fetch_live_external_jobs(target_role: str = "") -> List[Dict[str, Any]]:
    """Fetches normalized external market jobs with Redis/Mongo TTL caching and graceful offline fallback."""
    if not settings.LIVE_JOBS_ENABLED:
        return []
    if settings.ENV == "testing" and not _is_httpx_mocked():
        return []

    role_slug = re.sub(r"[^a-z0-9]+", "-", (target_role or "default").strip().lower()).strip("-")[:40] or "default"
    cache_key = f"external_jobs:{role_slug}" if (settings.ADZUNA_APP_ID and settings.ADZUNA_APP_KEY) else "external_jobs:public"

    cached = _read_cached_feed(cache_key)
    if cached is not None:
        return cached

    timeout = float(settings.LIVE_JOBS_FETCH_TIMEOUT)
    aggregated: List[Dict[str, Any]] = []
    seen_ids: set[str] = set()

    for provider_name, fetcher in (
        ("Remotive", lambda: _fetch_remotive_jobs(timeout)),
        ("Arbeitnow", lambda: _fetch_arbeitnow_jobs(timeout)),
        ("Adzuna", lambda: _fetch_adzuna_jobs(target_role, timeout)),
    ):
        try:
            items = fetcher()
            for item in items:
                jid = str(item.get("id") or "")
                if jid and jid not in seen_ids:
                    seen_ids.add(jid)
                    aggregated.append(item)
        except Exception as exc:
            logger.warning("External job feed '%s' unavailable: %s", provider_name, exc)

    if aggregated:
        _write_cached_feed(cache_key, aggregated)
    return aggregated
