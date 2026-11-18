import apiClient from "./client";

// ============================================================
// الواجهة 1 و 2: Auth
// ============================================================
export const registerUser = (data) => apiClient.post("/register", data);
export const loginUser = (data) => apiClient.post("/login", data);
export const logoutUser = () => apiClient.post("/logout");
export const logoutAllSessions = () => apiClient.post("/logout-all");
export const verifyEmail = (token) => apiClient.post("/verify-email", { token });
export const resendVerification = (email) => apiClient.post("/resend-verification", { email });
export const requestPasswordReset = (data) => apiClient.post("/forgot-password", data);
export const resetPassword = (data) => apiClient.post("/reset-password", data);

// ============================================================
// الواجهة 3: Dashboard (تستخدم /profile و /history)
// ============================================================
export const getProfile = () => apiClient.get("/profile");
export const updateProfile = (data) => apiClient.put("/profile", data);
export const deleteAccount = () => apiClient.delete("/profile");

// ============================================================
// الواجهة 4 و 5: Upload CV / Review Extracted Data
// ============================================================
export const uploadCV = (file, onUploadProgress) => {
  const formData = new FormData();
  formData.append("file", file);
  return apiClient.post("/upload-cv", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress,
  });
};

export const extractCVData = (fileId) => apiClient.post("/extract", { file_id: fileId });

// ============================================================
// Batch 5.1: إدخال يدوي كامل بدون رفع CV
// ============================================================
export const extractManualData = (data = {}) => apiClient.post("/extract/manual", data);

export const confirmExtraction = (data) => apiClient.post("/extract/confirm", data);

// ============================================================
// الواجهة 6: Assessment Questions
// ============================================================
export const getAssessmentQuestions = () => apiClient.get("/assessment");
export const submitAssessment = (answers) => apiClient.post("/assessment", { answers });

// ============================================================
// الواجهة 8: Results
// ============================================================
export const runAnalysis = (extractionId, assessmentId) =>
  apiClient.post("/analyze", { extraction_id: extractionId, assessment_id: assessmentId });

// ============================================================
// الواجهة 9: History
// ============================================================
export const getHistory = (params) => apiClient.get("/history", { params });
export const getHistoryDetail = (analysisId) => apiClient.get(`/history/${analysisId}`);

// ============================================================
// الواجهة 11: Settings
// ============================================================
export const updatePassword = (data) => apiClient.put("/settings/password", data);

// ============================================================
// Batch 5.6: تفضيل التنبيهات البريدية الأسبوعية
// ============================================================
export const updateNotificationsOptIn = (optedIn) =>
  apiClient.put("/settings/notifications", { notifications_opt_in: optedIn });

// ============================================================
// Batch 1.1: تحميل النتائج كـ PDF
// ============================================================
export const exportAnalysisPdf = (analysisId) =>
  apiClient.get(`/history/${analysisId}/export/pdf`, { responseType: "blob" });

// ============================================================
// Batch 1.2: Feedback Loop (Positive/Negative) على التوصيات
// ============================================================
export const submitAnalysisFeedback = (analysisId, data) =>
  apiClient.post(`/history/${analysisId}/feedback`, data);

// ============================================================
// Batch 2.1: مقارنة تحليلين
// ============================================================
export const compareAnalyses = (idA, idB) =>
  apiClient.get("/history/compare", { params: { ids: `${idA},${idB}` } });

// ============================================================
// Batch 2.2: Skill Checklist تفاعلي على الـ Roadmap
// ============================================================
export const updateRoadmapSkillProgress = (analysisId, skill, completed) =>
  apiClient.patch(`/history/${analysisId}/roadmap`, { skill, completed });

// ============================================================
// Batch 4.1: مشاركة رابط عام للنتائج
// ============================================================
export const createShareLink = (analysisId) => apiClient.post(`/history/${analysisId}/share`);
export const revokeShareLink = (analysisId) => apiClient.delete(`/history/${analysisId}/share`);
export const getSharedAnalysis = (shareToken) =>
  apiClient.post("/shared/exchange", { share_token: shareToken });

// ============================================================
// Batch 4.2: مقارنة مجهولة مع الأقران (Benchmark)
// ============================================================
export const getBenchmark = () => apiClient.get("/benchmark");
export const updateBenchmarkOptIn = (optedIn) =>
  apiClient.put("/settings/benchmark-opt-in", { opted_in: optedIn });
export const getRecruiterConsent = () => apiClient.get("/settings/recruiter-consent");
export const updateRecruiterConsent = (optedIn) =>
  apiClient.put("/settings/recruiter-consent", { opted_in: optedIn });
export const getCloudAiConsent = () => apiClient.get("/settings/cloud-ai-consent");
export const updateCloudAiConsent = (optedIn) =>
  apiClient.put("/settings/cloud-ai-consent", { opted_in: optedIn });

// ============================================================
// Batch 4.3: Badges / إنجازات
// ============================================================
export const getProfileBadges = () => apiClient.get("/profile/badges");

// ============================================================
// Phase 1: ATS Score & Cover Letter
// ============================================================
export const getAtsScore = (extractionId) => apiClient.get(`/extract/${extractionId}/ats-score`);
export const generateCoverLetter = (extractionId, jobDescription) =>
  apiClient.post(`/extract/${extractionId}/cover-letter`, { job_description: jobDescription });

// ============================================================
// Phase 3 & Epic 4: AI Mock Interview & Evaluation
// ============================================================
export const startInterview = (analysisId, jobTitle) =>
  apiClient.post("/interview/start", { analysis_id: analysisId, job_title: jobTitle });
export const chatInterview = (sessionId, message) =>
  apiClient.post("/interview/chat", { session_id: sessionId, message });
export const getInterviewSession = (sessionId) =>
  apiClient.get(`/interview/${sessionId}`);
export const evaluateInterview = (sessionId) =>
  apiClient.post(`/interview/${sessionId}/evaluate`);

// ============================================================
// Epic 6 Feature 6.5: Real Job Matching
// ============================================================
export const getMatchedJobs = (analysisId, params = {}) =>
  apiClient.get("/jobs/matched", { params: { analysis_id: analysisId, ...params } });

// ============================================================
// Phase 2 (Section 7.1): Celery Async CV Worker, Voice Interview, & ATS CV Builder
// ============================================================
export const startAsyncCVExtraction = (fileId) =>
  apiClient.post("/extract/async", { file_id: fileId });

export const getCVTaskStatus = (taskId) =>
  apiClient.get(`/cv/status/${taskId}`);

export const optimizeAtsResume = (extractionId, data = {}) =>
  apiClient.post(`/extract/${extractionId}/ats-builder/optimize`, data);

export const exportAtsResumePdf = (extractionId, data = {}) =>
  apiClient.post(`/extract/${extractionId}/export-ats-pdf`, data, {
    responseType: "blob",
  });

export const sendVoiceInterviewAnswer = (
  sessionId,
  audioBlob,
  durationSeconds = 0,
  transcriptHint = ""
) => {
  const formData = new FormData();
  if (audioBlob) {
    formData.append("file", audioBlob, "interview_answer.webm");
  }
  formData.append("duration_seconds", String(durationSeconds || 0));
  formData.append("transcript_hint", transcriptHint || "");
  return apiClient.post(`/interview/${sessionId}/voice`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

// ============================================================
// Phase 3 (Section 7.2): B2B Recruiter Portal, Subscriptions & Extension
// ============================================================
export const getRecruiterJobs = (params) => apiClient.get("/recruiter/jobs", { params });
export const getRecruiterApproval = () => apiClient.get("/recruiter/approval");
export const createRecruiterJob = (data) => apiClient.post("/recruiter/jobs", data);
export const getRecruiterJob = (jobId) => apiClient.get(`/recruiter/jobs/${jobId}`);
export const updateRecruiterJob = (jobId, data) => apiClient.put(`/recruiter/jobs/${jobId}`, data);
export const deleteRecruiterJob = (jobId) => apiClient.delete(`/recruiter/jobs/${jobId}`);
export const getJobCandidates = (jobId, params) =>
  apiClient.get(`/recruiter/jobs/${jobId}/candidates`, { params });
export const updateCandidatePipelineStatus = (jobId, candidateId, data) =>
  apiClient.post(`/recruiter/jobs/${jobId}/candidates/${candidateId}/status`, data);
export const getCandidateProfile = (candidateId, jobId) =>
  apiClient.get(`/recruiter/candidates/${candidateId}/profile`, { params: { job_id: jobId } });
export const triggerCandidateAiReview = (jobId, candidateId, forceRefresh = true) =>
  apiClient.post(`/recruiter/jobs/${jobId}/candidates/${candidateId}/ai-review`, null, {
    params: { force_refresh: forceRefresh },
  });
export const switchToRecruiterRole = (companyName) =>
  apiClient.post("/recruiter/switch-role", null, { params: { company_name: companyName } });

// ============================================================
// System Administrator Portal (Platform Owner)
// ============================================================
export const getAdminOverview = () => apiClient.get("/admin/overview");
export const getAdminUsers = (params) => apiClient.get("/admin/users", { params });
export const updateAdminUserSuspension = (userId, data) =>
  apiClient.patch(`/admin/users/${userId}/suspension`, data);
export const getAdminAiLogs = (params) => apiClient.get("/admin/ai-logs", { params });
export const getAdminPrompts = () => apiClient.get("/admin/prompts");
export const updateAdminPrompt = (promptKey, systemPrompt) =>
  apiClient.put(`/admin/prompts/${promptKey}`, { system_prompt: systemPrompt });
export const resetAdminPrompt = (promptKey) =>
  apiClient.post(`/admin/prompts/${promptKey}/reset`);
export const getAdminSupportGrants = (params) =>
  apiClient.get("/admin/support-grants", { params });
export const revokeAdminSupportGrant = (grantId) =>
  apiClient.post(`/admin/support-grants/${grantId}/revoke`);
export const getCompaniesReview = () => apiClient.get("/companies/review");
export const updateCompanyReviewStatus = (companyId, status, expectedVersion) =>
  apiClient.patch(`/companies/${companyId}/status`, {
    status,
    ...(expectedVersion !== undefined && expectedVersion !== null
      ? { expected_version: expectedVersion }
      : {}),
  });

export const approveSupportGrant = (grantId) =>
  apiClient.post(`/support/grants/${grantId}/approve`);

export const getSubscriptionPlans = () => apiClient.get("/subscriptions/plans");
export const getCurrentSubscription = () => apiClient.get("/subscriptions/current");
export const createCheckoutSession = (data) => apiClient.post("/subscriptions/checkout-session", data);
export const cancelSubscription = () => apiClient.post("/subscriptions/cancel");

export const createExtensionToken = () => apiClient.post("/extension/token");
export const matchExtensionJob = (data) => apiClient.post("/extension/match-job", data);
export const getHealthStatus = () => apiClient.get("/health");
