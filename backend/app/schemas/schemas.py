"""
مخططات Pydantic لكل Request/Response — تطبيق حرفي لـ "عقد الـ API" (القسم 8)
وتفاصيل كل واجهة في القسم 5 من دليل التطوير التقني.
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional, Union

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.seed.skills_data import normalize_and_dedupe_skills

# ============================================================
# الواجهة 1 و 2: Auth (Login / Register)
# ============================================================


class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class RegisterResponse(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    created_at: datetime


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v):
        if not any(char.isdigit() for char in v):
            raise ValueError("Password must contain at least one number")
        if not any(char.isalpha() for char in v):
            raise ValueError("Password must contain at least one letter")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    id: str
    full_name: str
    email: EmailStr


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


# ============================================================
# الواجهة 4: Upload CV
# ============================================================


class UploadCVResponse(BaseModel):
    file_id: str
    filename: str
    status: Literal["uploaded"] = "uploaded"


class ExtractRequest(BaseModel):
    file_id: str


class ProjectItem(BaseModel):
    title: str
    description: str = ""
    technologies: List[str] = []


class EducationItem(BaseModel):
    degree: str
    institution: str
    year: Optional[int] = None


class ExperienceItem(BaseModel):
    title: str
    company: str
    duration_months: int = 0
    description: str = ""


class ExtractResponse(BaseModel):
    extraction_id: str
    skills: List[str]
    projects: List[ProjectItem]
    education: List[EducationItem]
    experience: List[ExperienceItem]


# ============================================================
# الواجهة 5: Review Extracted Data — POST /extract/confirm
# ============================================================


class ManualExtractRequest(BaseModel):
    """Batch 5.1 — POST /extract/manual: إنشاء سجل استخراج مباشرة من إدخال المستخدم بدون ملف.

    لا يوجد حد أدنى إلزامي هنا عمداً (بخلاف ExtractConfirmRequest أدناه)، لأن هذا الـ endpoint
    يُستدعى فوراً عند اختيار "إدخال يدوي" في UploadCV.jsx لإنشاء سجل فارغ (أو مبدئي) يوجَّه بعده
    المستخدم مباشرة إلى نفس صفحة ReviewExtractedData.jsx المستخدمة لمسار رفع الملف، حيث يملأ
    بياناته ثم يؤكدها عبر /extract/confirm الموجود أصلاً (الذي يفرض شرط مهارة واحدة على الأقل).
    كما يمكن استخدامه أيضاً لإرسال بيانات مُعبّأة مسبقاً بالكامل في طلب واحد إن رغب أي مستهلك
    آخر لهذا الـ endpoint بذلك.
    """

    skills: List[str] = []
    projects: List[ProjectItem] = []
    education: List[EducationItem] = []
    experience: List[ExperienceItem] = []

    @field_validator("skills")
    @classmethod
    def _normalize_skills(cls, v: List[str]) -> List[str]:
        """إصلاح خلل حرج (اكتُشف بمراجعة شاملة بعد الدفعة 5): بدون هذا التطبيع، مستخدم يكتب
        "python" بدل "Python" يحصل على Career Score شبه صفري بصمت تام لاحقاً في /analyze —
        راجع normalize_and_dedupe_skills في skills_data.py للتفاصيل الكاملة."""
        return normalize_and_dedupe_skills(v)


class ExtractConfirmRequest(BaseModel):
    extraction_id: str
    skills: List[str] = Field(..., min_length=1)
    projects: List[ProjectItem] = []
    education: List[EducationItem] = []
    experience: List[ExperienceItem] = []

    @field_validator("skills")
    @classmethod
    def _normalize_skills(cls, v: List[str]) -> List[str]:
        """نفس الإصلاح الحرج المطبَّق في ManualExtractRequest أعلاه — ضروري هنا بالتحديد
        لأن هذا الـ endpoint هو مسار التأكيد النهائي لكل من (رفع CV، الإدخال اليدوي، وأي
        مهارة يضيفها المستخدم يدوياً في صفحة المراجعة عبر مربع نص حر بدون أي تحقق)."""
        normalized = normalize_and_dedupe_skills(v)
        if not normalized:
            raise ValueError("At least one valid skill is required")
        return normalized


class ExtractConfirmResponse(BaseModel):
    extraction_id: str
    status: Literal["confirmed"] = "confirmed"


# ============================================================
# الواجهة 6: Assessment Questions
# ============================================================


class AssessmentQuestionOut(BaseModel):
    id: str
    text: str
    type: Literal["single_choice", "multiple_choice", "scale"]
    options: List[str] = []
    required: bool = True


class AssessmentQuestionsResponse(BaseModel):
    questions: List[AssessmentQuestionOut]


class AssessmentAnswer(BaseModel):
    question_id: str
    value: Union[str, List[str], float]


class AssessmentSubmitRequest(BaseModel):
    answers: List[AssessmentAnswer]


class AssessmentSubmitResponse(BaseModel):
    assessment_id: str
    status: Literal["submitted"] = "submitted"


# ============================================================
# الواجهة 8: Results — POST /analyze
# ============================================================


class AnalyzeRequest(BaseModel):
    extraction_id: str
    assessment_id: str


class JobMatchOut(BaseModel):
    job_title: str
    match_percentage: float
    matched_skills: List[str]
    missing_skills: List[str]
    explanation: str = ""  # Batch 3.2 — جملة توضيحية لسبب هذه التوصية


class SkillGapOut(BaseModel):
    critical: List[str]
    recommended: List[str]
    nice_to_have: List[str]


class RoadmapMonthOut(BaseModel):
    month: int
    goals: List[str]
    skills_to_learn: List[str]


class SuggestedCourseOut(BaseModel):
    title: str
    platform: str
    url: str
    covers_skill: str


class AnalyzeResponse(BaseModel):
    analysis_id: str
    career_score: float
    career_dna: dict
    top_jobs: List[JobMatchOut]
    strengths: List[str]
    weaknesses: List[str]
    skill_gap: SkillGapOut
    roadmap: List[RoadmapMonthOut]
    suggested_courses: List[SuggestedCourseOut]
    completed_skills: List[str] = Field(default_factory=list)  # Batch 2.2 — Skill Checklist
    share_token: Optional[str] = None  # Batch 4.1 — رمز المشاركة العامة إن وُجد (None = غير مُشارك)


# ============================================================
# الواجهة 9: History
# ============================================================


class HistoryItemOut(BaseModel):
    analysis_id: str
    date: datetime
    career_score: float
    top_job_title: str


class HistoryResponse(BaseModel):
    total: int
    page: int
    limit: int
    analyses: List[HistoryItemOut]


# ============================================================
# الواجهة 10: Profile
# ============================================================


class ProfileResponse(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    created_at: datetime
    total_analyses: int
    highest_career_score: float
    benchmark_opt_in: bool = False  # Batch 4.2 — لتهيئة حالة التبديل الصحيحة في Settings.jsx
    notifications_opt_in: bool = True  # Batch 5.6 — لتهيئة حالة مفتاح التنبيهات البريدية في Settings.jsx


class ProfileUpdateRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255)


class ProfileUpdateResponse(BaseModel):
    id: str
    full_name: str
    email: EmailStr


# ============================================================
# الواجهة 11: Settings
# ============================================================

class PasswordUpdateRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class PasswordUpdateResponse(BaseModel):
    status: Literal["password_updated"] = "password_updated"


# ============================================================
# Batch 1.2: Feedback Loop (👍/👎) على التوصيات
# ============================================================


class FeedbackRequest(BaseModel):
    useful: bool
    comment: Optional[str] = Field(default=None, max_length=1000)


class FeedbackResponse(BaseModel):
    status: Literal["recorded"] = "recorded"
    useful: bool


# ============================================================
# Batch 2.1: مقارنة تحليلين (Compare Analyses)
# ============================================================


class CompareAnalysesResponse(BaseModel):
    analysis_a: AnalyzeResponse
    analysis_b: AnalyzeResponse
    career_score_delta: float  # analysis_b.career_score - analysis_a.career_score
    new_skills_gained: List[str]  # مهارات ظهرت كـ matched في analysis_b ولم تكن كذلك في analysis_a
    skills_lost: List[str]  # مهارات كانت matched في analysis_a ولم تعد كذلك في analysis_b


# ============================================================
# Batch 2.2: Skill Checklist تفاعلي على الـ Roadmap
# ============================================================


class RoadmapProgressRequest(BaseModel):
    skill: str
    completed: bool


class RoadmapProgressResponse(BaseModel):
    analysis_id: str
    completed_skills: List[str]


# ============================================================
# Batch 4.1: مشاركة رابط عام للنتائج
# قرارات الخصوصية المعتمدة: الرابط لا ينتهي إلا بإلغاء يدوي من المستخدم؛ النسخة العامة
# تقتصر حصراً على Career Score + Career DNA + Top Jobs (لا مشاريع، لا خبرة، لا Roadmap شخصي،
# لا كورسات، لا أي بيانات تعريف شخصية).
# ============================================================


class ShareCreateResponse(BaseModel):
    share_token: str
    already_existed: bool  # true إذا كان هناك رابط مُفعَّل مسبقاً وأُعيد إرجاعه كما هو


class ShareRevokeResponse(BaseModel):
    status: Literal["revoked"] = "revoked"


class SharedJobMatchOut(BaseModel):
    """نسخة عامة من JobMatchOut — لا تُخفي شيئاً إضافياً لأن matched/missing هي أسماء مهارات
    عامة وليست بيانات شخصية، لكنها مُعرَّفة بشكل مستقل لضمان عدم تسرّب أي حقل جديد مستقبلاً
    (كالمشاريع أو الخبرة) لهذا الـ endpoint العام تلقائياً دون مراجعة."""

    job_title: str
    match_percentage: float
    matched_skills: List[str]
    missing_skills: List[str]
    explanation: str = ""


class SharedAnalysisResponse(BaseModel):
    career_score: float
    career_dna: dict
    top_jobs: List[SharedJobMatchOut]
    date: datetime


# ============================================================
# Batch 4.2: مقارنة مجهولة مع الأقران (Anonymous Benchmark) — Opt-in فقط
# ============================================================


class BenchmarkOptInRequest(BaseModel):
    opted_in: bool


class BenchmarkOptInResponse(BaseModel):
    opted_in: bool


class BenchmarkResponse(BaseModel):
    average_career_score: Optional[float] = None
    sample_size: int
    by_job_title: dict[str, float] = Field(default_factory=dict)


# ============================================================
# Batch 5.6: تفضيل التنبيهات البريدية الأسبوعية — PUT /settings/notifications
# ============================================================


class NotificationsPreferenceRequest(BaseModel):
    notifications_opt_in: bool


class NotificationsPreferenceResponse(BaseModel):
    notifications_opt_in: bool


# ============================================================
# Batch 4.3: Badges / إنجازات
# ============================================================


class BadgeOut(BaseModel):
    id: str
    title: str
    description: str
    achieved: bool
    achieved_at: Optional[datetime] = None


class BadgesResponse(BaseModel):
    badges: List[BadgeOut]


# ============================================================
# رسائل خطأ عامة
# ============================================================


class ATSScoreResponse(BaseModel):
    score: int
    feedback: List[str]

class CoverLetterRequest(BaseModel):
    job_description: str

class CoverLetterResponse(BaseModel):
    cover_letter: str

class ErrorDetail(BaseModel):
    detail: str
