"""
مخططات Pydantic لكل Request/Response — تطبيق حرفي لـ "عقد الـ API" (القسم 8)
وتفاصيل كل واجهة في القسم 5 من دليل التطوير التقني.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.seed.skills_data import normalize_and_dedupe_skills

# ============================================================
# الواجهة 1 و 2: Auth (Login / Register)
# ============================================================


class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    role: Optional[str] = "candidate"
    company_name: Optional[str] = None

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
    def validate_password(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    role: str = "candidate"
    subscription_tier: str = "free"
    company_name: Optional[str] = None


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
    is_linkedin: bool = False


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
    date: Optional[datetime] = None
    career_score: float
    career_dna: dict
    top_jobs: List[JobMatchOut]
    strengths: List[str]
    weaknesses: List[str]
    skill_gap: SkillGapOut
    roadmap: List[RoadmapMonthOut]
    suggested_courses: List[SuggestedCourseOut]
    skills: List[str] = Field(default_factory=list)
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
    role: str = "candidate"
    subscription_tier: str = "free"
    company_name: Optional[str] = None


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
    job_description: str = Field(..., min_length=2, max_length=5000)


class CoverLetterResponse(BaseModel):
    cover_letter: str


# ============================================================
# Phase 3 & Epic 4: AI Mock Interview & Voice Evaluation Schemas
# ============================================================


class InterviewStartRequest(BaseModel):
    analysis_id: str = Field(..., min_length=1, max_length=120)
    job_title: str = Field(..., min_length=2, max_length=150)


class InterviewMessage(BaseModel):
    role: str
    content: str
    voice_feedback: Optional[Dict[str, Any]] = None


class VoiceFeedbackModel(BaseModel):
    transcript: str
    clarity_score: int
    pace_score: int
    confidence_score: int
    words_per_minute: int
    pace_label: str
    filler_words_count: int = 0
    feedback_summary: str
    tips: List[str] = Field(default_factory=list)


class InterviewVoiceResponse(BaseModel):
    session_id: str
    status: str
    transcript: str
    voice_feedback: VoiceFeedbackModel
    messages: List[InterviewMessage]


class InterviewStartResponse(BaseModel):
    session_id: str
    job_title: str
    messages: List[InterviewMessage]


class InterviewChatRequest(BaseModel):
    session_id: str = Field(..., min_length=1, max_length=120)
    message: str = Field(..., min_length=1, max_length=4000)


class InterviewChatResponse(BaseModel):
    session_id: str
    status: str
    messages: List[InterviewMessage]


class ModelAnswerItem(BaseModel):
    question: str
    model_answer: str


class InterviewEvaluationResponse(BaseModel):
    session_id: str
    final_score: int
    technical_score: int
    communication_score: int
    strengths: List[str]
    technical_mistakes: List[str]
    grammar_mistakes: List[str]
    model_answers: List[ModelAnswerItem]
    overall_feedback: str


class InterviewSessionDetailResponse(BaseModel):
    session_id: str
    job_title: str
    status: str
    messages: List[InterviewMessage]
    evaluation: Optional[Dict[str, Any]] = None


# ============================================================
# Phase 2: Celery Asynchronous PDF Worker & ATS CV Builder
# ============================================================


class AsyncExtractResponse(BaseModel):
    task_id: str
    status: str = "processing"


class CVTaskStatusResponse(BaseModel):
    task_id: str
    status: str  # "processing" | "completed" | "failed"
    extraction_id: Optional[str] = None
    result: Optional[ExtractResponse] = None
    error: Optional[str] = None


class ATSResumeBuildRequest(BaseModel):
    full_name: str = ""
    target_role: str = ""
    email: str = ""
    phone: str = ""
    location: str = ""
    linkedin_url: str = ""
    summary: str = ""
    skills: List[str] = Field(default_factory=list)
    experience: List[ExperienceItem] = Field(default_factory=list)
    projects: List[ProjectItem] = Field(default_factory=list)
    education: List[EducationItem] = Field(default_factory=list)


class ATSResumeOptimizeResponse(BaseModel):
    full_name: str
    target_role: str
    email: str
    phone: str = ""
    location: str = ""
    linkedin_url: str = ""
    summary: str
    skills: List[str]
    experience: List[ExperienceItem]
    projects: List[ProjectItem]
    education: List[EducationItem]


class ErrorDetail(BaseModel):
    detail: str


# ============================================================
# Phase 3: B2B HR & Recruiter Portal Schemas (Section 7.2)
# ============================================================


class RecruiterJobCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    company_name: Optional[str] = Field(None, max_length=200)
    field: str = Field("Engineering", max_length=150)
    experience_level: str = Field("Junior", max_length=100)
    location: str = Field("Ramallah / Remote", max_length=150)
    work_type: str = Field("Full-time", max_length=100)  # Full-time, Part-time, Remote, Hybrid
    salary_range: Optional[str] = Field(None, max_length=100)
    required_skills: List[str] = Field(..., min_length=1)
    bonus_skills: List[str] = Field(default_factory=list)
    description: str = Field(..., min_length=10, max_length=4000)


class RecruiterJobUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=200)
    company_name: Optional[str] = None
    field: Optional[str] = None
    experience_level: Optional[str] = None
    location: Optional[str] = None
    work_type: Optional[str] = None
    salary_range: Optional[str] = None
    required_skills: Optional[List[str]] = None
    bonus_skills: Optional[List[str]] = None
    description: Optional[str] = None
    status: Optional[str] = Field(None, max_length=50)  # "active" | "closed"


class RecruiterJobResponse(BaseModel):
    job_id: str
    recruiter_id: int
    title: str
    company_name: str
    field: str
    experience_level: str
    location: str
    work_type: str
    salary_range: Optional[str] = None
    required_skills: List[str]
    bonus_skills: List[str]
    description: str
    status: str = "active"
    created_at: str
    total_candidates_count: int = 0
    shortlisted_count: int = 0


class CandidateMatchItem(BaseModel):
    candidate_id: str
    user_id: int
    full_name: str
    email: str
    match_percentage: int
    matched_skills: List[str]
    missing_skills: List[str]
    experience_years_summary: str
    target_role: str
    ats_score: Optional[int] = None
    career_score: Optional[int] = None
    fit_reasoning: str
    pipeline_status: str = "discovered"  # discovered | shortlisted | contacted | interviewed | rejected
    notes: Optional[str] = ""
    updated_at: Optional[str] = None


class CandidateListResponse(BaseModel):
    job_id: str
    job_title: str
    total_matches: int
    candidates: List[CandidateMatchItem]


class UpdateCandidatePipelineRequest(BaseModel):
    pipeline_status: str = Field(..., max_length=50)  # discovered | shortlisted | contacted | interviewed | offered | rejected
    notes: Optional[str] = Field(None, max_length=1000)


class CandidateProfileDetail(BaseModel):
    candidate_id: str
    user_id: int
    full_name: str
    email: str
    target_role: str
    ats_score: Optional[int] = None
    skills: List[str]
    experience: List[Dict[str, Any]]
    projects: List[Dict[str, Any]]
    education: List[Dict[str, Any]]
    career_score: Optional[int] = None
    pipeline_status: str = "discovered"
    notes: Optional[str] = ""


# ============================================================
# Phase 3: Monetization & Subscriptions Schemas
# ============================================================


class PlanPricingTier(BaseModel):
    id: str
    name: str
    name_ar: str
    price_monthly: float
    price_annual: float
    currency: str = "USD"
    description: str
    description_ar: str
    badge: Optional[str] = None
    features: List[str]
    features_ar: List[str]
    limits: Dict[str, Any]
    recommended: bool = False


class CheckoutSessionRequest(BaseModel):
    plan_id: str = Field(..., max_length=50)  # "pro" | "enterprise"
    billing_cycle: str = Field("monthly", max_length=20)  # "monthly" | "annual"
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None
    test_token: Optional[str] = None  # allows instant simulation upgrade


class CheckoutSessionResponse(BaseModel):
    session_id: str
    checkout_url: str
    provider: str = "stripe"
    mode: str = "payment"


class CurrentSubscriptionResponse(BaseModel):
    tier: str
    tier_label: str
    status: str
    billing_cycle: str
    features: List[str]
    features_ar: List[str]
    limits: Dict[str, Any]
    expires_at: Optional[str] = None


class CancelSubscriptionResponse(BaseModel):
    status: str
    message: str
    tier: str


# ============================================================
# Phase 3: Chrome Browser Extension Schemas
# ============================================================


class ExtensionMatchRequest(BaseModel):
    job_title: str = Field(..., min_length=2, max_length=300)
    company: Optional[str] = Field("", max_length=200)
    location: Optional[str] = Field("", max_length=200)
    job_description: str = Field(..., min_length=5)
    extracted_skills: Optional[List[str]] = Field(default_factory=list)


class ExtensionMatchResponse(BaseModel):
    job_title: str
    company: str
    candidate_name: str
    match_score: int
    verdict: str
    matched_skills: List[str]
    missing_skills: List[str]
    recommendations: List[str]
    suggested_cover_letter_snippet: str
    candidate_skills_count: int
    required_skills_count: int
