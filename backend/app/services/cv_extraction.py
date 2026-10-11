"""
CV Analysis Engine — استخراج المهارات والمشاريع والتعليم والخبرة من ملف PDF (القسم 3.2 و 4، الخطوة 5).

المنهجية (Heuristic Rule-Based Extraction):
1. تحويل PDF إلى نص كامل عبر pdfplumber.
2. مطابقة قائمة المهارات المرجعية (Skills catalogue) مقابل النص كاملاً لاستخراج skills[].
3. تقسيم النص إلى أقسام بالاعتماد على عناوين شائعة (Projects / Experience / Education) بالعربية والإنجليزية.
4. استخراج كل قسم بقواعد نمطية (Regex) مبنية على أنماط شائعة في السير الذاتية.

هذا محرك عملي وقابل للتطوير لاحقاً (مثلاً استبداله بنموذج NLP/LLM لتحسين الدقة)
دون التأثير على بقية النظام، لأن الواجهة (extract_cv_data) ثابتة.

============================================================
Batch 5.2 — مراجعة نقاط الاعتماد على نصوص إنجليزية فقط، ودعم استخراج CV باللغة العربية
============================================================
نقاط الاعتماد على الإنجليزية التي تمت مراجعتها ومعالجتها هنا:
1. مطابقة المهارات (_extract_skills) كانت تكتفي بقائمة SKILL_NAMES الإنجليزية فقط
   → أُضيف مسار مطابقة منفصل وإضافي لقاموس المرادفات العربية ARABIC_SKILL_SYNONYMS
     (seed/skills_data.py)، يُطبَّع الاسم الناتج دائماً للمفتاح الإنجليزي الكنسي حتى يبقى
     التوافق كاملاً مع محرك التوصية وجدول Job_Skills.
2. الأرقام: YEAR_RE/DATE_RANGE_RE تتعرّف فقط على الأرقام اللاتينية (0-9) — أي سيرة ذاتية
   عربية تستخدم الأرقام الهندية (٠-٩) أو الفارسية (۰-۹) لسنوات التخرج/الخبرة كانت ستُفقَد
   بالكامل → أُضيفت normalize_digits() تُطبَّق على النص الكامل أولاً قبل أي معالجة أخرى.
3. عناوين الأقسام (SECTION_PATTERNS) كانت تحوي فقط كلمة عربية مفردة واحدة لكل قسم (مثال:
   "المهارات" فقط) → وُسِّعت لتشمل الصيغ الشائعة الإضافية (مثال: "المهارات التقنية"،
   "الخبرة العملية"، "المؤهلات العلمية").
4. فاصل نطاق التاريخ (DATE_RANGE_RE) كان يتعرّف فقط على "-"/"–"/"—"/"to" الإنجليزية،
   ولا "حتى الآن"/"الآن" كمرادف لـ present/current → أُضيفت المرادفات العربية المكافئة.
5. أسماء الأشهر في نطاق التاريخ كانت مقيَّدة بحروف A-Za-z فقط، فلا تتعرّف على "يناير 2022"
   → وُسِّع الصنف الحرفي (character class) ليشمل نطاق الحروف العربية (\u0600-\u06FF) أيضاً.
6. الفاصلة المستخدمة لتقسيم الأسطر (title/institution/company) كانت الفاصلة اللاتينية ","
   فقط، دون الفاصلة العربية "،" (U+060C) الشائعة في السير الذاتية العربية → أُضيفت أينما
   استُخدمت الفاصلة اللاتينية في هذا الملف.
7. علامات الترقيم غير المرئية (Bidi control marks مثل RLM/LRM) التي قد تُدرجها بعض
   محرّرات PDF عند تصدير نصوص عربية يمكن أن تكسر المطابقة النصية بصمت → تُزال بالكامل ضمن
   normalize_digits() قبل أي معالجة.

ملاحظة صادقة (قيد معروف): pdfplumber يعتمد على ترتيب المحارف في ملف الـ PDF نفسه لاستخراج
النص. مع ملفات PDF عربية "سليمة" (مُصدَّرة من Word/Google Docs/LibreOffice بترميز Unicode
عادي)، يُخرج pdfplumber النص بالترتيب المنطقي الصحيح وتعمل كل الأنماط أعلاه بشكل سليم (وهذا
ما تتحقق منه tests/test_arabic_extraction.py عبر PDF عربي حقيقي مبني بنفس آلية pdf_helper.py
الموجودة). أما ملفات PDF نادرة تحفظ النص العربي بترتيب بصري معكوس داخل الملف نفسه (ناتجة عن
أدوات تصدير قديمة/غير قياسية) فتحتاج معالجة bidi إضافية على مستوى استخراج pdfplumber نفسه؛
هذا خارج نطاق هذه الدفعة ولم يُدّعَ حله هنا.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

import pdfplumber

from app.seed.skills_data import SKILLS

SKILL_NAMES = list(SKILLS.keys())

# English-only section headers
SECTION_PATTERNS = {
    "skills": r"(skills|technical skills|core skills|key skills|competencies)",
    "projects": r"(projects|personal projects|academic projects|selected projects)",
    "education": r"(education|academic background|educational background|qualifications)",
    "experience": r"(experience|work experience|employment|professional experience|work history)",
}

YEAR_RE = re.compile(r"(19|20)\d{2}")
DATE_RANGE_RE = re.compile(
    r"(?P<start>(19|20)\d{2}|[A-Za-z]{3,12}\.?\s+(19|20)\d{2})"
    r"\s*(?:-|–|—|to)\s*"
    r"(?P<end>present|current|now|(19|20)\d{2}|[A-Za-z]{3,12}\.?\s+(19|20)\d{2})",
    re.IGNORECASE,
)
MONTH_NAMES_RE = re.compile(
    r"jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec",
    re.IGNORECASE,
)

def clean_text(text: str) -> str:
    """Basic text cleanup for English CVs."""
    if not text:
        return text
    return text.strip()


@dataclass
class ExtractedProject:
    title: str
    description: str = ""
    technologies: list = field(default_factory=list)


@dataclass
class ExtractedEducation:
    degree: str
    institution: str
    year: int | None = None


@dataclass
class ExtractedExperience:
    title: str
    company: str
    duration_months: int = 0
    description: str = ""


@dataclass
class ExtractedCVData:
    skills: list
    projects: list
    education: list
    experience: list
    is_linkedin: bool = False


def _read_pdf_text(file_path: str | Path) -> str:
    text_chunks: list[str] = []
    with pdfplumber.open(str(file_path)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            text_chunks.append(page_text)
    return "\n".join(text_chunks)


def _find_section_bounds(lines: list[str]) -> dict[str, tuple[int, int]]:
    """يحدد بداية/نهاية كل قسم بحسب أول سطر يطابق عنوان القسم."""
    headers: list[tuple[int, str]] = []
    for idx, line in enumerate(lines):
        clean = line.strip().lower()
        if not clean or len(clean) > 60:
            continue
        for section, pattern in SECTION_PATTERNS.items():
            if re.fullmatch(rf"[\s#*:-]*{pattern}[\s#*:-]*", clean, re.IGNORECASE):
                headers.append((idx, section))
                break

    bounds: dict[str, tuple[int, int]] = {}
    for i, (start_idx, section) in enumerate(headers):
        end_idx = headers[i + 1][0] if i + 1 < len(headers) else len(lines)
        bounds[section] = (start_idx + 1, end_idx)
    return bounds


def _extract_skills(full_text: str) -> list[str]:
    lowered = full_text.lower()
    found = []
    for skill in SKILL_NAMES:
        # Match with word boundaries
        pattern = r"(?<![a-zA-Z0-9])" + re.escape(skill.lower()) + r"(?![a-zA-Z0-9])"
        if re.search(pattern, lowered):
            found.append(skill)
    return found


def _duration_to_months(start: str, end: str) -> int:
    def parse_year(token: str) -> int | None:
        m = YEAR_RE.search(token)
        return int(m.group()) if m else None

    start_year = parse_year(start)
    if re.search(r"present|current|now", end, re.IGNORECASE):
        import datetime

        end_year = datetime.date.today().year
    else:
        end_year = parse_year(end)

    if start_year is None or end_year is None or end_year < start_year:
        return 0
    return max(0, (end_year - start_year) * 12)


def _extract_projects(block_lines: list[str]) -> list[ExtractedProject]:
    projects: list[ExtractedProject] = []
    current: ExtractedProject | None = None
    for raw in block_lines:
        line = raw.strip("•-*► 	")
        if not line:
            continue
        is_bullet = raw.strip().startswith(("•", "-", "*", "►"))
        if not is_bullet and len(line) < 90 and (current is None or len(line.split()) <= 12):
            if current:
                projects.append(current)
            current = ExtractedProject(title=line)
        else:
            if current is None:
                current = ExtractedProject(title=line[:80])
            current.description = (current.description + " " + line).strip()

    if current:
        projects.append(current)

    for project in projects:
        combined = f"{project.title} {project.description}"
        project.technologies = _extract_skills(combined)

    return [p for p in projects if p.title]


def _extract_education(block_lines: list[str]) -> list[ExtractedEducation]:
    education: list[ExtractedEducation] = []
    degree_keywords = r"(bachelor|master|phd|b\.?sc|m\.?sc|diploma)"
    buffer = " ".join(l.strip() for l in block_lines if l.strip())
    
    for line in block_lines:
        clean = line.strip("•-*► 	")
        if not clean:
            continue
        year_match = YEAR_RE.search(clean)
        year = int(year_match.group()) if year_match else None
        degree_match = re.search(degree_keywords, clean, re.IGNORECASE)
        
        degree = degree_match.group(0) if degree_match else re.split(r"[,]", clean, maxsplit=1)[0][:80]
        institution = clean
        if degree_match:
            institution = clean[degree_match.end():].strip(" ,-|") or clean
        education.append(ExtractedEducation(degree=degree.strip() or "Degree", institution=institution[:150], year=year))

    if not education and buffer:
        year_match = YEAR_RE.search(buffer)
        education.append(
            ExtractedEducation(degree=buffer[:80], institution=buffer[:150], year=int(year_match.group()) if year_match else None)
        )
    return education[:6]


def _extract_experience(block_lines: list[str]) -> list[ExtractedExperience]:
    experience: list[ExtractedExperience] = []
    current: ExtractedExperience | None = None
    for raw in block_lines:
        line = raw.strip("•-*► 	")
        if not line:
            continue
        is_bullet = raw.strip().startswith(("•", "-", "*", "►"))
        date_match = DATE_RANGE_RE.search(line)

        if not is_bullet and (date_match or (len(line) < 100 and (current is None or "," in line or "-" in line))):
            if current:
                experience.append(current)
            months = _duration_to_months(date_match.group("start"), date_match.group("end")) if date_match else 0
            
            title_company = re.split(r"[-|,]", line, maxsplit=1)
            title = title_company[0].strip() or "Role"
            company = title_company[1].strip() if len(title_company) > 1 and title_company[1] else ""
            current = ExtractedExperience(title=title[:150], company=company[:150], duration_months=months)
        else:
            if current is None:
                current = ExtractedExperience(title=line[:80], company="")
            current.description = (current.description + " " + line).strip()

    if current:
        experience.append(current)
    return [e for e in experience if e.title]


import json
import logging
import ollama
try:
    import openai
except ImportError:
    openai = None
from app.core.config import settings

logger = logging.getLogger(__name__)


def call_llm(prompt: str, system_prompt: str, is_json: bool = False) -> str:
    """Wrapper to call OpenAI if configured, otherwise fallback to Ollama."""
    # Try OpenAI first
    if settings.OPENAI_API_KEY and openai is not None:
        try:
            client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
            kwargs = {
                "model": "gpt-3.5-turbo",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.7
            }
            if is_json:
                kwargs["response_format"] = {"type": "json_object"}
            
            resp = client.chat.completions.create(**kwargs)
            return resp.choices[0].message.content
        except Exception as e:
            logger.warning(f"OpenAI fallback failed: {e}. Trying Ollama...")

    # Fallback to Ollama
    try:
        kwargs = {
            "model": "llama3.2",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ]
        }
        if is_json:
            kwargs["format"] = "json"
            
        response = ollama.chat(**kwargs)
        return response['message']['content']
    except Exception as e:
        logger.warning(f"Ollama local extraction failed: {e}")
        raise e


def _extract_with_ollama(full_text: str) -> ExtractedCVData | None:
    """Uses a local Ollama model to intelligently extract CV data."""
    prompt = f"""
You are an expert HR data extractor. Extract the following information from the provided English CV text.
Return ONLY a valid JSON object matching exactly this structure, with no markdown formatting or extra text:
{{
  "skills": ["Skill 1", "Skill 2"],
  "projects": [{{"title": "Project Name", "description": "What they did", "technologies": ["Tech 1"]}}],
  "education": [{{"degree": "BSc Computer Science", "institution": "University Name", "year": 2020}}],
  "experience": [{{"title": "Software Engineer", "company": "Company Name", "duration_months": 24, "description": "What they did"}}]
}}

CV Text:
{full_text}
"""
    try:
        content = call_llm(prompt, 'You are a precise data extraction API that only outputs valid JSON.', is_json=True)
        data = json.loads(content)
        
        # Convert dictionaries to dataclass instances
        return ExtractedCVData(
            skills=data.get('skills', []),
            projects=[ExtractedProject(**p) for p in data.get('projects', [])],
            education=[ExtractedEducation(**e) for e in data.get('education', [])],
            experience=[ExtractedExperience(**e) for e in data.get('experience', [])]
        )
    except Exception as e:
        logger.warning(f"Ollama local extraction failed (maybe model not running?): {e}")
        return None



def is_linkedin_profile(text: str) -> bool:
    """Epic 6 Feature 6.3: Detect if text comes from an exported LinkedIn PDF profile."""
    if not text:
        return False
    lowered = text.lower()
    has_contact = "contact" in lowered or "linkedin.com/in" in lowered
    has_top_skills = "top skills" in lowered
    has_experience = "experience" in lowered or "education" in lowered
    return (has_contact and has_experience) or (has_top_skills and has_experience)


def extract_linkedin_top_skills(text: str) -> list[str]:
    """Extract skills directly from LinkedIn's 'Top Skills' block."""
    m = re.search(
        r"top\s+skills\s*[\r\n]+(.*?)(?=(?:[\r\n]+\s*(?:languages|certifications|summary|experience|education)\b)|\Z)",
        text,
        re.IGNORECASE | re.DOTALL,
    )
    extracted = []
    if m:
        block = m.group(1)
        for line in block.splitlines():
            s = line.strip("•-*► \t\r\n")
            if s and len(s) < 45 and not s.lower().startswith("page "):
                extracted.append(s)
    return extracted

def extract_cv_data(file_path: str | Path) -> ExtractedCVData:
    """Entry point for local AI/Heuristic English and Arabic extraction with LinkedIn profile support."""
    raw_text = _read_pdf_text(file_path)
    full_text = clean_text(raw_text)
    is_linkedin = is_linkedin_profile(full_text)
    if is_linkedin:
        logger.info("LinkedIn Profile PDF export detected; applying specialized LinkedIn heuristics.")
    
    # 1. Try Local AI Model First (Ollama)
    ai_result = _extract_with_ollama(full_text)
    if ai_result:
        ai_result.is_linkedin = is_linkedin
        logger.info("Successfully extracted CV data using local AI (Ollama).")
        return ai_result
        
    logger.info("Falling back to Heuristic Regex extraction.")
    # 2. Fallback to classic Regex logic if local AI is not available
    lines = full_text.splitlines()

    bounds = _find_section_bounds(lines)

    def section_lines(name: str) -> list[str]:
        if name not in bounds:
            return []
        start, end = bounds[name]
        return lines[start:end]

    skills = _extract_skills(full_text)
    if is_linkedin:
        li_skills = extract_linkedin_top_skills(full_text)
        for s in li_skills:
            if s not in skills:
                skills.append(s)

    projects = _extract_projects(section_lines("projects"))
    education = _extract_education(section_lines("education"))
    experience = _extract_experience(section_lines("experience"))

    return ExtractedCVData(
        skills=skills,
        projects=projects,
        education=education,
        experience=experience,
        is_linkedin=is_linkedin
    )

def evaluate_ats_score(file_path: str | Path) -> dict:
    raw_text = _read_pdf_text(file_path)
    full_text = clean_text(raw_text)
    prompt = f"""
You are an expert ATS (Applicant Tracking System). Evaluate the following CV text.
Return ONLY a valid JSON object matching exactly this structure:
{{
  "score": 85,
  "feedback": ["Good use of keywords", "Missing specific metrics in experience"]
}}

CV Text:
{full_text}
"""
    try:
        content = call_llm(prompt, 'You are a precise JSON-only ATS evaluator.', is_json=True)
        import json
        data = json.loads(content)
        return {"score": data.get("score", 0), "feedback": data.get("feedback", [])}
    except Exception as e:
        logger.warning(f"Ollama ATS evaluation failed: {e}")
        return {"score": 50, "feedback": ["Could not evaluate due to AI engine error."]}

def generate_cover_letter(file_path: str | Path, job_description: str) -> str:
    raw_text = _read_pdf_text(file_path)
    full_text = clean_text(raw_text)
    prompt = f"""
You are an expert career coach. Write a professional, tailored cover letter for the following job description based on the candidate's CV.
Return ONLY the cover letter text, no markdown, no intro or outro.

Job Description:
{job_description}

Candidate CV:
{full_text}
"""
    try:
        content = call_llm(prompt, 'You are a professional cover letter writer.', is_json=False)
        return content.strip()
    except Exception as e:
        logger.warning(f"Ollama Cover Letter generation failed: {e}")
        return "Could not generate cover letter due to AI engine error."
