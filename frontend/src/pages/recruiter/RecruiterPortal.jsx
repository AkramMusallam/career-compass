import { useEffect, useState, useMemo } from "react";
import {
  Briefcase,
  Building2,
  Sparkles,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Users,
  CheckCircle2,
  Star,
  Mail,
  Video,
  Handshake,
  XCircle,
  X,
  ExternalLink,
  FileText,
  Target,
  Filter,
  MapPin,
  DollarSign,
  Check,
  AlertCircle,
  Clock,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import {
  getRecruiterJobs,
  createRecruiterJob,
  deleteRecruiterJob,
  getJobCandidates,
  updateCandidatePipelineStatus,
  getCandidateProfile,
  switchToRecruiterRole,
} from "../../api/endpoints";

export default function RecruiterPortal() {
  const { user, updateStoredUser } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState("jobs"); // "jobs" | "pipeline"
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [candidatesData, setCandidatesData] = useState({ candidates: [], total_matches: 0 });
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);

  // Filters
  const [minMatchFilter, setMinMatchFilter] = useState(0);
  const [skillFilter, setSkillFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCandidateProfile, setSelectedCandidateProfile] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  // New Job Form State
  const [jobForm, setJobForm] = useState({
    title: "",
    company_name: user?.company_name || "",
    field: "Engineering",
    experience_level: "Junior - Mid",
    location: "Ramallah / Hybrid",
    work_type: "Full-time",
    salary_range: "$1,500 - $2,500",
    required_skills: "Python, FastAPI, SQL, Git",
    bonus_skills: "Docker, React, Redis",
    description: "نبحث عن مهندس برمجيات موهوب للانضمام لفريقنا والمساهمة في بناء حلول رقمية عالية الاعتمادية.",
  });

  // Load jobs on mount
  useEffect(() => {
    fetchJobs();
  }, []);

  // When selected job or filters change, load ranked candidates
  useEffect(() => {
    if (selectedJobId && activeTab === "pipeline") {
      fetchCandidates(selectedJobId);
    }
  }, [selectedJobId, minMatchFilter, skillFilter, activeTab]);

  const fetchJobs = async () => {
    try {
      setIsLoadingJobs(true);
      const res = await getRecruiterJobs();
      setJobs(res.data || []);
      if (res.data && res.data.length > 0 && !selectedJobId) {
        setSelectedJobId(res.data[0].job_id);
      }
    } catch (err) {
      console.error("Error fetching jobs:", err);
    } finally {
      setIsLoadingJobs(false);
    }
  };

  const fetchCandidates = async (jobId) => {
    try {
      setIsLoadingCandidates(true);
      const params = { min_match: minMatchFilter };
      if (skillFilter.trim()) {
        params.skill_filter = skillFilter.trim();
      }
      const res = await getJobCandidates(jobId, params);
      setCandidatesData(res.data || { candidates: [], total_matches: 0 });
    } catch (err) {
      console.error("Error fetching candidates:", err);
      showToast("تعذر جلب قائمة المرشحين", "error");
    } finally {
      setIsLoadingCandidates(false);
    }
  };

  const handleCreateJob = async (e) => {
    e.preventDefault();
    try {
      const parsedRequired = (jobForm.required_skills || "")
        .split(/[,،\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const parsedBonus = (jobForm.bonus_skills || "")
        .split(/[,،\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        ...jobForm,
        title: (jobForm.title || "").trim(),
        description: (jobForm.description || "").trim() || "نبحث عن مهندس برمجيات موهوب للانضمام لفريقنا.",
        required_skills: parsedRequired.length > 0 ? parsedRequired : ["Software Engineering"],
        bonus_skills: parsedBonus,
      };
      const res = await createRecruiterJob(payload);
      if (user?.role !== "recruiter" && user?.role !== "admin") {
        updateStoredUser({
          role: "recruiter",
          company_name: jobForm.company_name || user?.company_name || "شركة تقنية رائدة",
        });
      }
      showToast("تم نشر الشاغر الوظيفي بنجاح", "success");
      setShowCreateModal(false);
      setJobForm((prev) => ({ ...prev, title: "" }));
      await fetchJobs();
      setSelectedJobId(res.data.job_id);
      setActiveTab("pipeline");
    } catch (err) {
      const msg = err?.response?.data?.detail;
      showToast(typeof msg === "string" ? msg : "حدث خطأ أثناء نشر الوظيفة", "error");
    }
  };

  const handleDeleteJob = async (jobId) => {
    if (!window.confirm("هل أنت متأكد من رغبتك في حذف هذا الشاغر الوظيفي؟")) return;
    try {
      await deleteRecruiterJob(jobId);
      showToast("تم حذف الشاغر بنجاح", "success");
      fetchJobs();
      if (selectedJobId === jobId) setSelectedJobId(null);
    } catch (err) {
      showToast("تعذر حذف الشاغر", "error");
    }
  };

  const handleUpdatePipeline = async (candidateId, newStatus) => {
    try {
      await updateCandidatePipelineStatus(selectedJobId, candidateId, {
        pipeline_status: newStatus,
      });
      showToast(`تم نقل المرشح إلى مرحلة: ${getStatusLabel(newStatus)}`, "success");
      setCandidatesData((prev) => ({
        ...prev,
        candidates: prev.candidates.map((c) =>
          c.candidate_id === candidateId ? { ...c, pipeline_status: newStatus } : c
        ),
      }));
    } catch (err) {
      showToast("تعذر تحديث حالة المرشح", "error");
    }
  };

  const handleViewProfile = async (candidateId) => {
    try {
      setIsLoadingProfile(true);
      const res = await getCandidateProfile(candidateId);
      setSelectedCandidateProfile(res.data);
    } catch (err) {
      showToast("تعذر جلب تفاصيل ملف المرشح", "error");
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handleSwitchToRecruiter = async () => {
    try {
      await switchToRecruiterRole("شركة تقنية رائدة");
      updateStoredUser({ role: "recruiter", company_name: "شركة تقنية رائدة" });
      showToast("تم تفعيل حساب مسؤول التوظيف بنجاح", "success");
      fetchJobs();
    } catch (err) {
      showToast("تعذر تحديث الصلاحية", "error");
    }
  };

  const getStatusLabel = (st) => {
    switch (st) {
      case "shortlisted":
        return "القائمة المختصرة";
      case "contacted":
        return "تم التواصل";
      case "interviewed":
        return "المقابلة الفنية";
      case "offered":
        return "عرض عمل";
      case "rejected":
        return "مستبعد";
      default:
        return "مكتشف حديثاً";
    }
  };

  const filteredCandidates = useMemo(() => {
    if (statusFilter === "all") return candidatesData.candidates || [];
    return (candidatesData.candidates || []).filter((c) => c.pipeline_status === statusFilter);
  }, [candidatesData.candidates, statusFilter]);

  const averageTechnicalMatch = useMemo(() => {
    const list = candidatesData.candidates || [];
    if (!list.length) return 0;
    const total = list.reduce((acc, c) => acc + (Number(c.match_percentage ?? c.match_score) || 0), 0);
    return Math.round(total / list.length);
  }, [candidatesData.candidates]);

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in pb-16 sm:pb-8">
      {/* Executive Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 p-6 sm:p-8 text-white shadow-lg border border-slate-800">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-300 text-xs font-bold">
              <Building2 className="w-3.5 h-3.5" />
              <span>بوابة الشركات ومسؤولي التوظيف (B2B Portal)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              اكتشاف وفرز الكفاءات التقنية بالذكاء الاصطناعي
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              انشر متطلباتك الوظيفية، ودع محرك Career Compass يفرز ويطابق الكفاءات بناءً على المهارات العملية وتوافق السير الذاتية (ATS).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-500 px-5 py-3 text-xs sm:text-sm font-bold text-white shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>نشر شاغر جديد</span>
            </button>
            {user?.role !== "recruiter" && (
              <button
                onClick={handleSwitchToRecruiter}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-3 text-xs font-bold text-white transition"
              >
                <Building2 className="w-4 h-4" />
                <span>ترقية لحساب شركة</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Highlights Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-slate-800">
          <div className="bg-slate-800/40 p-3 rounded-2xl border border-slate-800">
            <p className="text-[11px] font-semibold text-slate-400">الوظائف المعلنة</p>
            <p className="text-xl sm:text-2xl font-black text-white mt-1">{jobs.length}</p>
          </div>
          <div className="bg-slate-800/40 p-3 rounded-2xl border border-slate-800">
            <p className="text-[11px] font-semibold text-slate-400">الكفاءات المطابقة</p>
            <p className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">{candidatesData.total_matches || candidatesData.candidates?.length || 0}</p>
          </div>
          <div className="bg-slate-800/40 p-3 rounded-2xl border border-slate-800">
            <p className="text-[11px] font-semibold text-slate-400">في القائمة المختصرة</p>
            <p className="text-xl sm:text-2xl font-black text-primary-400 mt-1">
              {(candidatesData.candidates || []).filter((c) => c.pipeline_status === "shortlisted").length}
            </p>
          </div>
          <div className="bg-slate-800/40 p-3 rounded-2xl border border-slate-800">
            <p className="text-[11px] font-semibold text-slate-400">متوسط التوافق التقني</p>
            <p className="text-xl sm:text-2xl font-black text-amber-400 mt-1">
              {averageTechnicalMatch > 0 ? `${averageTechnicalMatch}%` : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab("jobs")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
            activeTab === "jobs"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Briefcase className="w-4 h-4" />
          <span>الشواغر الوظيفية ({jobs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("pipeline")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
            activeTab === "pipeline"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Target className="w-4 h-4" />
          <span>فرز الكفاءات (AI Pipeline)</span>
        </button>
      </div>

      {/* TAB 1: JOBS LIST */}
      {activeTab === "jobs" && (
        <div className="space-y-4">
          {isLoadingJobs ? (
            <div className="py-20 text-center text-slate-500 font-bold">جاري تحميل الشواغر...</div>
          ) : jobs.length === 0 ? (
            <div className="card p-10 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
                <Briefcase className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">لا توجد وظائف معلنة بعد</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                ابدأ بنشر أول شاغر وظيفي لتقوم خوارزميات المطابقة باكتشاف المرشحين المناسبين تلقائياً.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary py-2 px-5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>نشر أول شاغر</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {jobs.map((job) => (
                <div
                  key={job.job_id}
                  className="card p-5 sm:p-6 flex flex-col justify-between hover:border-slate-300 transition-all border border-slate-200 group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full bg-primary-50 text-primary-700 text-xs font-bold border border-primary-100">
                        {job.work_type}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">{job.created_at?.slice(0, 10)}</span>
                    </div>

                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-primary-600 transition">
                        {job.title}
                      </h3>
                      <p className="text-xs font-medium text-slate-500 mt-0.5">{job.company_name} • {job.location}</p>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {job.description}
                    </p>

                    {/* Required Skills Badges */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {job.required_skills?.slice(0, 4).map((s) => (
                        <span key={s} className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-semibold">
                          {s}
                        </span>
                      ))}
                      {job.required_skills?.length > 4 && (
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500 text-[10px]">
                          +{job.required_skills.length - 4}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-slate-400">المرشحون المفرزون</p>
                      <p className="text-xs sm:text-sm font-bold text-slate-800">{job.total_candidates_count || 0} مرشح</p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setSelectedJobId(job.job_id);
                          setActiveTab("pipeline");
                        }}
                        className="btn-primary !py-1.5 !px-3 !text-xs rounded-xl inline-flex items-center gap-1"
                      >
                        <Target className="w-3 h-3" />
                        <span>مطابقة الكفاءات</span>
                      </button>
                      <button
                        onClick={() => handleDeleteJob(job.job_id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="حذف الشاغر"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: AI CANDIDATE MATCHING PIPELINE */}
      {activeTab === "pipeline" && (
        <div className="space-y-4">
          {/* Controls & Filter Bar */}
          <div className="card p-4 sm:p-5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 flex-1">
              {/* Job Selector */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">اختر الشاغر الوظيفي:</label>
                <select
                  value={selectedJobId || ""}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                  className="input-field !py-1.5 text-xs font-semibold bg-white"
                >
                  {jobs.map((j) => (
                    <option key={j.job_id} value={j.job_id}>
                      {j.title} ({j.company_name})
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">مرحلة الفرز:</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="input-field !py-1.5 text-xs font-semibold bg-white"
                >
                  <option value="all">كافة المراحل</option>
                  <option value="discovered">المكتشفون حديثاً</option>
                  <option value="shortlisted">القائمة المختصرة</option>
                  <option value="contacted">تم التواصل</option>
                  <option value="interviewed">المقابلة الفنية</option>
                  <option value="offered">عروض العمل</option>
                  <option value="rejected">مستبعد</option>
                </select>
              </div>

              {/* Skill Keyword Filter */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">تصفية حسب مهارة:</label>
                <input
                  type="text"
                  placeholder="مثال: Python أو React..."
                  value={skillFilter}
                  onChange={(e) => setSkillFilter(e.target.value)}
                  className="input-field !py-1.5 text-xs bg-white"
                />
              </div>

              {/* Minimum Match Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-slate-600">
                  <span>الحد الأدنى للتطابق:</span>
                  <span className="text-primary-600">{minMatchFilter}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="90"
                  step="5"
                  value={minMatchFilter}
                  onChange={(e) => setMinMatchFilter(Number(e.target.value))}
                  className="w-full accent-primary-600 mt-2"
                />
              </div>
            </div>

            <div className="text-left md:border-r md:pr-4 md:border-slate-200">
              <span className="text-[11px] font-medium text-slate-500 block">المرشحون المؤهلون</span>
              <span className="text-lg font-black text-slate-900">{filteredCandidates.length}</span>
            </div>
          </div>

          {/* Candidates Cards Grid */}
          {isLoadingCandidates ? (
            <div className="py-20 text-center text-slate-500 font-bold">جاري فرز الكفاءات وترتيبها بالذكاء الاصطناعي...</div>
          ) : filteredCandidates.length === 0 ? (
            <div className="card p-10 text-center space-y-2">
              <div className="w-10 h-10 mx-auto rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
                <Search className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">لا يوجد مرشحون يطابقون معايير التصفية</h3>
              <p className="text-xs text-slate-500">جرب خفض نسبة التطابق الأدنى أو تعديل فلتر المهارات.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {filteredCandidates.map((cand) => (
                <div
                  key={cand.candidate_id}
                  className="card p-5 border border-slate-200 hover:border-slate-300 transition-all space-y-3.5 relative"
                >
                  {/* Match Score Badge Bar */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-teal-600 text-white flex flex-col items-center justify-center shrink-0 shadow-xs">
                        <span className="text-sm font-black leading-none">{cand.match_score || cand.match_percentage}%</span>
                        <span className="text-[8px] font-bold text-teal-100 mt-0.5">تطابق</span>
                      </div>
                      <div>
                        <h4 className="text-sm sm:text-base font-bold text-slate-900">{cand.full_name}</h4>
                        <p className="text-[11px] text-slate-500 font-medium">{cand.email} • {cand.experience_years_summary}</p>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
                      ATS: {cand.ats_score || 85}%
                    </span>
                  </div>

                  {/* AI Fit Reasoning */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700 leading-relaxed">
                    <span className="font-bold text-primary-700">تقييم الذكاء الاصطناعي: </span>
                    {cand.fit_reasoning}
                  </div>

                  {/* Skills Cloud */}
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap gap-1 items-center">
                      <span className="text-[10px] font-bold text-slate-500 ml-1">المهارات المتوفرة:</span>
                      {cand.matched_skills?.slice(0, 5).map((s) => (
                        <span key={s} className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                          <Check className="w-2.5 h-2.5" />
                          {s}
                        </span>
                      ))}
                    </div>

                    {cand.missing_skills?.length > 0 && (
                      <div className="flex flex-wrap gap-1 items-center">
                        <span className="text-[10px] font-bold text-slate-500 ml-1">مهارات إضافية مطلوبة:</span>
                        {cand.missing_skills?.slice(0, 3).map((s) => (
                          <span key={s} className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-medium">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions & Pipeline Selector */}
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] font-bold text-slate-500">المرحلة:</label>
                      <select
                        value={cand.pipeline_status}
                        onChange={(e) => handleUpdatePipeline(cand.candidate_id, e.target.value)}
                        className="text-xs font-bold px-2.5 py-1 rounded-lg border border-slate-200 bg-white"
                      >
                        <option value="discovered">مكتشف حديثاً</option>
                        <option value="shortlisted">القائمة المختصرة</option>
                        <option value="contacted">تم التواصل</option>
                        <option value="interviewed">المقابلة الفنية</option>
                        <option value="offered">عرض عمل</option>
                        <option value="rejected">مستبعد</option>
                      </select>
                    </div>

                    <button
                      onClick={() => handleViewProfile(cand.candidate_id)}
                      className="text-xs font-bold text-primary-600 hover:text-primary-800 transition inline-flex items-center gap-1"
                    >
                      <span>معاينة الملف الكامل</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: CREATE NEW JOB */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-7 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">نشر شاغر وظيفي جديد</h3>
                <p className="text-xs text-slate-500">أدخل متطلبات الشاغر للبدء في مطابقة الكفاءات بالذكاء الاصطناعي</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateJob} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المسمى الوظيفي *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: Senior Backend Developer (Python / FastAPI)"
                  value={jobForm.title}
                  onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })}
                  className="input-field w-full text-xs sm:text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم الشركة</label>
                  <input
                    type="text"
                    value={jobForm.company_name}
                    onChange={(e) => setJobForm({ ...jobForm, company_name: e.target.value })}
                    className="input-field w-full text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الموقع / المدينة</label>
                  <input
                    type="text"
                    value={jobForm.location}
                    onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })}
                    className="input-field w-full text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">طبيعة العمل</label>
                  <select
                    value={jobForm.work_type}
                    onChange={(e) => setJobForm({ ...jobForm, work_type: e.target.value })}
                    className="input-field w-full text-xs"
                  >
                    <option value="Full-time">دوام كامل (Full-time)</option>
                    <option value="Part-time">دوام جزئي (Part-time)</option>
                    <option value="Remote">عن بُعد (Remote)</option>
                    <option value="Hybrid">هجين (Hybrid)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">مستوى الخبرة</label>
                  <select
                    value={jobForm.experience_level}
                    onChange={(e) => setJobForm({ ...jobForm, experience_level: e.target.value })}
                    className="input-field w-full text-xs"
                  >
                    <option value="Junior">مبتدئ (0-2 سنة)</option>
                    <option value="Junior - Mid">متوسط (2-4 سنوات)</option>
                    <option value="Senior">متقدم / خبير (5+ سنوات)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الراتب المتوقع</label>
                  <input
                    type="text"
                    value={jobForm.salary_range}
                    onChange={(e) => setJobForm({ ...jobForm, salary_range: e.target.value })}
                    className="input-field w-full text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المهارات الإلزامية (مفصولة بفاصلة) *</label>
                <input
                  type="text"
                  required
                  placeholder="Python, FastAPI, SQL, Docker, Git"
                  value={jobForm.required_skills}
                  onChange={(e) => setJobForm({ ...jobForm, required_skills: e.target.value })}
                  className="input-field w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المهارات الإضافية المفضلة</label>
                <input
                  type="text"
                  placeholder="Redis, Kubernetes, React, AWS"
                  value={jobForm.bonus_skills}
                  onChange={(e) => setJobForm({ ...jobForm, bonus_skills: e.target.value })}
                  className="input-field w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الوصف الوظيفي والمسؤوليات</label>
                <textarea
                  rows={3}
                  required
                  value={jobForm.description}
                  onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })}
                  className="input-field w-full text-xs"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-outline !py-2 !px-4 !text-xs"
                >
                  إلغاء
                </button>
                <button type="submit" className="btn-primary !py-2 !px-5 !text-xs inline-flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  <span>نشر الشاغر وبدء الفرز</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CANDIDATE PROFILE DEEP-DIVE */}
      {selectedCandidateProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-7 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">{selectedCandidateProfile.full_name}</h3>
                <p className="text-xs text-slate-500">{selectedCandidateProfile.email} • {selectedCandidateProfile.target_role}</p>
              </div>
              <button
                onClick={() => setSelectedCandidateProfile(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile verified skills */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 mb-1.5">المهارات التقنية المؤكدة:</h4>
              <div className="flex flex-wrap gap-1.5">
                {selectedCandidateProfile.skills?.map((s) => (
                  <span key={s} className="px-2.5 py-0.5 rounded-md bg-primary-50 text-primary-700 text-xs font-semibold border border-primary-100">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Experience */}
            {selectedCandidateProfile.experience?.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-slate-700 mb-1.5">الخبرات الوظيفية السابقة:</h4>
                <div className="space-y-2">
                  {selectedCandidateProfile.experience.map((exp, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-xs font-bold text-slate-900">{exp.title || exp.role} - {exp.company}</p>
                      <p className="text-[11px] text-slate-400">{exp.duration || exp.dates}</p>
                      <p className="text-xs text-slate-600 mt-1">{exp.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Projects */}
            {selectedCandidateProfile.projects?.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-slate-700 mb-1.5">المشاريع التقنية المنجزة:</h4>
                <div className="space-y-2">
                  {selectedCandidateProfile.projects.map((proj, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-xs font-bold text-slate-900">{proj.title}</p>
                      <p className="text-xs text-slate-600 mt-1">{proj.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-3 border-t border-slate-100">
              <a
                href={`mailto:${selectedCandidateProfile.email}?subject=دعوة مقابلة تقنية عبر Career Compass`}
                className="btn-primary !py-2 !px-5 !text-xs inline-flex items-center justify-center gap-1.5 w-full sm:w-auto"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>إرسال بريد دعوة للمقابلة الفنية</span>
              </a>
              <button
                onClick={() => setSelectedCandidateProfile(null)}
                className="btn-outline !py-2 !px-4 !text-xs w-full sm:w-auto"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
