import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";

import { getErrorMessage } from "../../api/client";
import {
  generateCoverLetter,
  startInterview,
  getMatchedJobs,
  exportAnalysisPdf,
  getBenchmark,
  getHistoryDetail,
  updateRoadmapSkillProgress,
} from "../../api/endpoints";
import CircularProgress from "../../components/ui/CircularProgress";
import AtsCvBuilderModal from "../../components/features/AtsCvBuilderModal";
import FeedbackWidget from "../../components/features/FeedbackWidget";
import ShareModal from "../../components/features/ShareModal";
import { useAnalysisFlow } from "../../context/AnalysisContext";
import { useToast } from "../../context/ToastContext";

function JobCard({
  job,
  isTop,
  rank,
  onGenerateCoverLetter,
  onStartInterview,
  isStartingInterview,
}) {
  const [expanded, setExpanded] = useState(isTop);

  return (
    <div
      className={`rounded-3xl border p-5 transition-all ${
        isTop
          ? "border-emerald-300 bg-gradient-to-br from-emerald-50/70 via-white to-indigo-50/40 shadow-md shadow-emerald-500/5"
          : "border-slate-200/80 bg-white/90 hover:border-indigo-200"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex-1 min-w-[220px]">
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black ${
                isTop
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              #{rank}
            </span>
            <p className="text-base font-black text-slate-900">{job.job_title}</p>
            {isTop && (
              <span className="rounded-full bg-emerald-100 border border-emerald-200 px-3 py-0.5 text-xs font-extrabold text-emerald-700">
                ⭐ المسار الأنسب لك
              </span>
            )}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  isTop
                    ? "bg-gradient-to-l from-emerald-500 to-teal-500"
                    : "bg-gradient-to-l from-indigo-500 to-violet-500"
                }`}
                style={{ width: `${job.match_percentage}%` }}
              />
            </div>
            <span
              className={`text-xs font-black ${
                isTop ? "text-emerald-700" : "text-indigo-700"
              }`}
            >
              {Math.round(job.match_percentage)}% توافق
            </span>
          </div>
          {job.explanation && (
            <p className="mt-2.5 text-sm font-medium text-slate-600 leading-relaxed">
              {job.explanation}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onGenerateCoverLetter && (
            <button
              type="button"
              onClick={() => onGenerateCoverLetter(job.job_title)}
              className="rounded-xl border border-indigo-200 bg-indigo-50/80 px-3.5 py-2 text-xs font-extrabold text-indigo-700 transition hover:bg-indigo-600 hover:text-white"
            >
              📝 خطاب تغطية
            </button>
          )}
          {onStartInterview && (
            <button
              type="button"
              disabled={isStartingInterview}
              onClick={() => onStartInterview(job.job_title)}
              className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3.5 py-2 text-xs font-extrabold text-emerald-700 transition hover:bg-emerald-600 hover:text-white disabled:opacity-50"
            >
              {isStartingInterview ? "⏳ جاري الفتح..." : "🎙️ محاكاة مقابلة"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            {expanded ? "إخفاء التفاصيل" : "عرض المهارات"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-200/70 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-extrabold text-emerald-700">
              ✓ المهارات المتوفرة لديك
            </p>
            <div className="flex flex-wrap gap-1.5">
              {job.matched_skills.length ? (
                job.matched_skills.map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"
                  >
                    ✓ {s}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400">لا يوجد</span>
              )}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-extrabold text-slate-500">
              • المهارات المطلوبة للتطوير
            </p>
            <div className="flex flex-wrap gap-1.5">
              {job.missing_skills.length ? (
                job.missing_skills.map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600"
                  >
                    ✗ {s}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400">لا يوجد</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LiveJobMatchingSection({ analysisId, onStartInterview }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    if (!analysisId) return;

    getMatchedJobs(analysisId)
      .then((res) => {
        if (isMounted) {
          setJobs(res.data.jobs || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(getErrorMessage(err, "تعذر جلب شواغر الوظائف المطابقة"));
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [analysisId]);

  if (loading) {
    return (
      <section className="card">
        <h2 className="mb-3 font-black text-slate-800">
          فرص العمل الحقيقية المطابقة لملفك (Live Job Matches)
        </h2>
        <div className="py-8 text-center text-slate-400">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-primary border-r-transparent mb-2" />
          <p className="text-xs font-bold">
            جاري البحث في قاعدة الشواغر النشطة ومطابقة المهارات...
          </p>
        </div>
      </section>
    );
  }

  if (error || jobs.length === 0) {
    return null;
  }

  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <span>💼</span>
            <span>فرص عمل حقيقية مطابقة لملفك (Live Job Matches)</span>
          </h2>
          <p className="text-xs font-medium text-slate-500 mt-0.5">
            تمت مطابقة مهاراتك مع أحدث الشواغر المفتوحة في السوق
          </p>
        </div>
        <span className="bg-indigo-50 text-indigo-700 text-xs font-extrabold px-3.5 py-1.5 rounded-full border border-indigo-200">
          {jobs.length} وظيفة متطابقة
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
        {jobs.map((item) => {
          const isHighMatch = item.match_percentage >= 70;
          return (
            <div
              key={item.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="font-black text-slate-900 text-sm">
                      {item.title}
                    </h3>
                    <a
                      href={
                        item.company_url ||
                        item.apply_url ||
                        `https://www.google.com/search?q=${encodeURIComponent(item.company)}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-primary-600 hover:text-primary-800 hover:underline transition-colors mt-0.5"
                      title={`زيارة الموقع التعريفي لشركة ${item.company}`}
                    >
                      <span>🏢 {item.company}</span>
                      <span className="text-[10px] text-slate-400">↗</span>
                    </a>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-black ${
                      isHighMatch
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        : "bg-indigo-100 text-indigo-800 border border-indigo-200"
                    }`}
                  >
                    {Math.round(item.match_percentage)}% توافق
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-slate-500 mb-3">
                  <span className="flex items-center gap-1">📍 {item.location}</span>
                  <span className="flex items-center gap-1">⏱️ {item.type}</span>
                  <span className="flex items-center gap-1">💰 {item.salary_range}</span>
                </div>

                <p className="text-xs text-slate-600 line-clamp-2 mb-3 leading-relaxed">
                  {item.description}
                </p>

                <div className="space-y-1.5 mb-3">
                  {item.matched_skills && item.matched_skills.length > 0 && (
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block mb-0.5">
                        مهارات متوفرة لديك:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {item.matched_skills.map((s) => (
                          <span
                            key={s}
                            className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-200"
                          >
                            ✓ {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {item.missing_skills && item.missing_skills.length > 0 && (
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block mb-0.5">
                        مهارات يوصى باكتسابها:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {item.missing_skills.map((s) => (
                          <span
                            key={s}
                            className="bg-amber-50 text-amber-700 text-[10px] font-semibold px-2 py-0.5 rounded-md border border-amber-200"
                          >
                            • {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 mt-auto">
                <span className="text-[10px] text-slate-400 font-bold">
                  {item.posted_date}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onStartInterview && onStartInterview(item.title)}
                    className="btn-outline !py-1.5 !px-3 !text-xs"
                    title="محاكاة مقابلة لهذا الشاغر"
                  >
                    🎙️ محاكاة مقابلة
                  </button>
                  <a
                    href={
                      item.apply_url && item.apply_url.startsWith("http")
                        ? item.apply_url
                        : `https://www.google.com/search?q=${encodeURIComponent(`${item.company} careers ${item.title}`)}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary !py-1.5 !px-3.5 !text-xs inline-flex items-center gap-1"
                    title={`التقديم المباشر لشاغر ${item.title} في ${item.company}`}
                  >
                    <span>التقديم</span>
                    <span>↗</span>
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function Results() {
  const { analysisId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { resetAnalysisFlow } = useAnalysisFlow();
  const { showToast } = useToast();

  const [analysis, setAnalysis] = useState(location.state?.analysis || null);
  const [status, setStatus] = useState(analysis ? "loaded" : "loading");
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [showAtsBuilder, setShowAtsBuilder] = useState(false);
  const [completedSkills, setCompletedSkills] = useState(
    () => new Set(analysis?.completed_skills || [])
  );
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareToken, setShareToken] = useState(analysis?.share_token || null);
  const [benchmark, setBenchmark] = useState(null);
  const [isStartingInterview, setIsStartingInterview] = useState(false);
  const [coverLetterJob, setCoverLetterJob] = useState(null);
  const [coverLetterText, setCoverLetterText] = useState("");
  const [isGeneratingCL, setIsGeneratingCL] = useState(false);
  const hasShownSaveToast = useRef(false);

  const handleStartInterview = async (jobTitle) => {
    setIsStartingInterview(true);
    try {
      const res = await startInterview(analysisId, jobTitle);
      navigate(`/interview/${res.data.session_id}`);
    } catch (err) {
      showToast(getErrorMessage(err, "حدث خطأ أثناء بدء المقابلة."), "error");
    } finally {
      setIsStartingInterview(false);
    }
  };

  const handleGenerateCoverLetter = async (jobTitle) => {
    setCoverLetterJob(jobTitle);
    setCoverLetterText("");
    setIsGeneratingCL(true);
    try {
      const res = await generateCoverLetter(analysisId, jobTitle);
      setCoverLetterText(res.data.cover_letter);
    } catch (err) {
      setCoverLetterText(
        getErrorMessage(err, "حدث خطأ أثناء توليد خطاب التغطية.")
      );
    } finally {
      setIsGeneratingCL(false);
    }
  };

  const closeCoverLetterModal = () => {
    setCoverLetterJob(null);
    setCoverLetterText("");
  };

  useEffect(() => {
    if (analysis) {
      setCompletedSkills(new Set(analysis.completed_skills || []));
      setShareToken(analysis.share_token || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis?.analysis_id]);

  useEffect(() => {
    getBenchmark()
      .then((res) => setBenchmark(res.data))
      .catch(() => setBenchmark(null));
  }, []);

  useEffect(() => {
    if (analysis) {
      if (!hasShownSaveToast.current) {
        hasShownSaveToast.current = true;
        showToast("تم حفظ التحليل تلقائياً في سجلك");
      }
      return;
    }
    let mounted = true;
    getHistoryDetail(analysisId)
      .then((res) => {
        if (mounted) {
          setAnalysis(res.data);
          setStatus("loaded");
        }
      })
      .catch(() => mounted && setStatus("error"));
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisId]);

  const handleRetry = () => {
    setStatus("loading");
    getHistoryDetail(analysisId)
      .then((res) => {
        setAnalysis(res.data);
        setStatus("loaded");
      })
      .catch((error) => {
        setStatus("error");
        // eslint-disable-next-line no-console
        console.error(getErrorMessage(error));
      });
  };

  const startNewAnalysis = () => {
    resetAnalysisFlow();
    navigate("/analysis/upload");
  };

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      const res = await exportAnalysisPdf(analysis.analysis_id);
      const blobUrl = window.URL.createObjectURL(
        new Blob([res.data], { type: "application/pdf" })
      );
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `career-compass-${analysis.analysis_id.slice(0, 8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      showToast(getErrorMessage(error, "تعذر تحميل الملف"), "error");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleToggleRoadmapSkill = async (skill) => {
    const wasCompleted = completedSkills.has(skill);
    const optimistic = new Set(completedSkills);
    if (wasCompleted) {
      optimistic.delete(skill);
    } else {
      optimistic.add(skill);
    }
    setCompletedSkills(optimistic);
    try {
      await updateRoadmapSkillProgress(
        analysis.analysis_id,
        skill,
        !wasCompleted
      );
    } catch (error) {
      setCompletedSkills(completedSkills);
      showToast(getErrorMessage(error, "تعذر تحديث حالة المهارة"), "error");
    }
  };

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-5xl animate-pulse space-y-6">
        <div className="card h-56" />
        <div className="card h-72" />
      </div>
    );
  }

  if (status === "error" || !analysis) {
    return (
      <div className="card mx-auto max-w-md text-center py-12">
        <p className="mb-2 text-lg font-black text-danger">
          تعذر عرض نتائج التحليل
        </p>
        <p className="mb-5 text-sm text-slate-500">
          التحليل نفسه محفوظ بأمان في سجلك ولن يُفقد
        </p>
        <button className="btn-primary" onClick={handleRetry}>
          إعادة المحاولة
        </button>
      </div>
    );
  }

  const dnaData = Object.entries(analysis.career_dna).map(([axis, value]) => ({
    axis,
    value,
  }));
  const allRoadmapSkills = [
    ...new Set(analysis.roadmap.flatMap((m) => m.skills_to_learn)),
  ];
  const roadmapProgressPercent = allRoadmapSkills.length
    ? Math.round((completedSkills.size / allRoadmapSkills.length) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-fade-in-up">
      {/* أ) Executive Career Score Hero */}
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-50/95 via-white/95 to-emerald-50/85 p-8 sm:p-10 shadow-[0_20px_50px_-15px_rgba(79,70,229,0.12)] border border-indigo-100/90 backdrop-blur-xl">
        <div className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-indigo-400/20 blur-[100px]" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-emerald-400/15 blur-[100px]" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex-1 text-center md:text-right">
            <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-200/80 bg-white/85 px-3.5 py-1 text-xs font-extrabold text-indigo-700 shadow-sm">
              <span>✨</span>
              <span>التقرير التنفيذي للجاهزية المهنية</span>
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 mb-3">
              ملفك المهني{" "}
              <span className="text-gradient">
                {analysis.career_score >= 70
                  ? "قوي ومنافس"
                  : analysis.career_score >= 40
                  ? "جيد وواعد"
                  : "بحاجة لتطوير منهجي"}
              </span>{" "}
              ومتوافق مع {analysis.top_jobs.length} مسارات وظيفية
            </h1>
            {analysis.top_jobs[0] && (
              <p className="text-sm sm:text-base text-slate-600 font-medium">
                أعلى مسار موصى به لك حالياً:{" "}
                <b className="text-slate-900">{analysis.top_jobs[0].job_title}</b>{" "}
                بنسبة توافق{" "}
                <b className="text-emerald-600">
                  {Math.round(analysis.top_jobs[0].match_percentage)}%
                </b>
              </p>
            )}

            {benchmark && benchmark.average_career_score !== null && (
              <div className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-2xl border border-indigo-100 bg-white/80 px-4 py-2 text-xs font-bold text-slate-600 shadow-sm">
                <span>
                  متوسط الأقران: {Math.round(benchmark.average_career_score)} (من{" "}
                  {benchmark.sample_size} تحليل)
                </span>
                {analysis.career_score >= benchmark.average_career_score ? (
                  <span className="text-emerald-600 font-extrabold">— أنت أعلى من المتوسط ▲</span>
                ) : (
                  <span className="text-amber-600 font-extrabold">— أنت أقل من المتوسط ▼</span>
                )}
              </div>
            )}

            <div className="mt-6 flex flex-wrap justify-center md:justify-start gap-2.5">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isDownloadingPdf}
                className="btn-primary !py-2.5 !px-5 !text-xs"
              >
                {isDownloadingPdf ? "جاري التصدير..." : "📥 تحميل التقرير PDF"}
              </button>
              <button
                type="button"
                onClick={() => setShowAtsBuilder(true)}
                className="btn-secondary !py-2.5 !px-5 !text-xs"
              >
                📄 بناء وتصدير سيرة ذاتية ATS
              </button>
              <button
                type="button"
                onClick={() => setShowShareModal(true)}
                className="btn-outline !py-2.5 !px-5 !text-xs"
              >
                🔗 {shareToken ? "إدارة رابط المشاركة" : "مشاركة التقرير"}
              </button>
            </div>
          </div>

          <div className="shrink-0 rounded-3xl border border-indigo-100/90 bg-white/90 p-6 shadow-lg shadow-indigo-500/5 backdrop-blur-xl">
            <CircularProgress
              value={analysis.career_score}
              size={170}
              dark={false}
              label="مؤشر Career Score"
            />
          </div>
        </div>
      </section>

      {/* ب) Career DNA + نقاط القوة والضعف */}
      <div className="grid gap-6 lg:grid-cols-12">
        <section className="card lg:col-span-7 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900">
              🧬 البصمة المهنية (Career DNA)
            </h2>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              توزيع قدراتك عبر المحاور المهنية والتقنية الرئيسية
            </p>
          </div>
          <div className="h-80 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={dnaData} outerRadius="68%">
                <PolarGrid stroke="#CBD5E1" />
                <PolarAngleAxis
                  dataKey="axis"
                  tick={{ fill: "#334155", fontSize: 12, fontWeight: 800 }}
                />
                <Radar
                  dataKey="value"
                  stroke="#4F46E5"
                  strokeWidth={2.5}
                  fill="#6366F1"
                  fillOpacity={0.35}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="lg:col-span-5 flex flex-col gap-4">
          <div className="card flex-1 border-emerald-200/80 bg-gradient-to-br from-emerald-50/70 to-white">
            <h3 className="mb-3 flex items-center gap-2 text-base font-black text-emerald-800">
              <span>💪</span>
              <span>نقاط القوة البارزة</span>
            </h3>
            <ul className="space-y-2 text-sm font-semibold text-slate-700">
              {analysis.strengths.length ? (
                analysis.strengths.map((s) => (
                  <li key={s} className="flex items-start gap-2">
                    <span className="text-emerald-600 font-black">✓</span>
                    <span>{s}</span>
                  </li>
                ))
              ) : (
                <li className="text-slate-400">لا يوجد بعد</li>
              )}
            </ul>
          </div>

          <div className="card flex-1 border-amber-200/80 bg-gradient-to-br from-amber-50/70 to-white">
            <h3 className="mb-3 flex items-center gap-2 text-base font-black text-amber-800">
              <span>⚡</span>
              <span>جوانب قابلة للتعزيز</span>
            </h3>
            <ul className="space-y-2 text-sm font-semibold text-slate-700">
              {analysis.weaknesses.length ? (
                analysis.weaknesses.map((w) => (
                  <li key={w} className="flex items-start gap-2">
                    <span className="text-amber-600 font-black">•</span>
                    <span>{w}</span>
                  </li>
                ))
              ) : (
                <li className="text-slate-400">لا يوجد</li>
              )}
            </ul>
          </div>
        </section>
      </div>

      {/* ج) Top 5 Jobs */}
      <section className="card">
        <div className="mb-5">
          <h2 className="text-lg font-black text-slate-900">
            🎯 أفضل 5 مسارات وظيفية مناسبة لك
          </h2>
          <p className="text-xs font-medium text-slate-500 mt-0.5">
            مرتبة تنازلياً حسب توافق مهاراتك وخبراتك مع متطلبات كل دور وظيفي
          </p>
        </div>
        <div className="space-y-3.5">
          {analysis.top_jobs.map((job, index) => (
            <JobCard
              key={job.job_title}
              job={job}
              rank={index + 1}
              isTop={index === 0}
              onGenerateCoverLetter={handleGenerateCoverLetter}
              onStartInterview={handleStartInterview}
              isStartingInterview={isStartingInterview}
            />
          ))}
        </div>
      </section>

      {/* فرص العمل الحقيقية المطابقة لملفك (Feature 6.5) */}
      <LiveJobMatchingSection
        analysisId={analysis.analysis_id}
        onStartInterview={handleStartInterview}
      />

      {/* هـ) Skill Gap */}
      <section className="card">
        <h2 className="mb-4 text-lg font-black text-slate-900">
          🧩 تحليل فجوة المهارات (Skill Gap Analysis)
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-red-100 bg-red-50/40 p-4">
            <p className="mb-2.5 text-xs font-black text-danger flex items-center gap-1.5">
              <span>🔥</span>
              <span>مهارات حرجة (Critical)</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {analysis.skill_gap.critical.length ? (
                analysis.skill_gap.critical.map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-bold text-red-700 shadow-sm"
                  >
                    {s}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400">لا يوجد</span>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4">
            <p className="mb-2.5 text-xs font-black text-amber-700 flex items-center gap-1.5">
              <span>⭐</span>
              <span>موصى بها (Recommended)</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {analysis.skill_gap.recommended.length ? (
                analysis.skill_gap.recommended.map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-bold text-amber-800 shadow-sm"
                  >
                    {s}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400">لا يوجد</span>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4">
            <p className="mb-2.5 text-xs font-black text-slate-600 flex items-center gap-1.5">
              <span>💡</span>
              <span>إضافية داعمة (Nice to Have)</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {analysis.skill_gap.nice_to_have.length ? (
                analysis.skill_gap.nice_to_have.map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600 shadow-sm"
                  >
                    {s}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400">لا يوجد</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* و) Roadmap */}
      <section className="card">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-slate-900">
              🗺️ خارطة التعلم والتطوير (3 أشهر)
            </h2>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              ضع علامة صح بجانب كل مهارة تنجزها لتتبع تقدمك الفعلي
            </p>
          </div>
          {allRoadmapSkills.length > 0 && (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-2">
              <div className="h-2.5 w-32 overflow-hidden rounded-full bg-emerald-100">
                <div
                  className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                  style={{ width: `${roadmapProgressPercent}%` }}
                />
              </div>
              <span className="text-xs font-black text-emerald-800">
                {completedSkills.size}/{allRoadmapSkills.length} مكتملة (
                {roadmapProgressPercent}%)
              </span>
            </div>
          )}
        </div>

        <ol className="relative border-r-2 border-indigo-200 pr-6 space-y-6">
          {analysis.roadmap.map((month) => (
            <li
              key={month.month}
              className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5"
            >
              <span className="absolute -right-[11px] flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 ring-4 ring-white" />
              <p className="mb-2 text-base font-black text-indigo-700">
                الشهر {month.month}
              </p>
              <ul className="mb-3 list-inside list-disc space-y-1 text-sm font-semibold text-slate-700">
                {month.goals.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
              {month.skills_to_learn.length > 0 && (
                <div className="pt-2 border-t border-slate-200/60 flex flex-wrap gap-2">
                  {month.skills_to_learn.map((skill) => {
                    const done = completedSkills.has(skill);
                    return (
                      <label
                        key={skill}
                        className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                          done
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 line-through"
                            : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
                          checked={done}
                          onChange={() => handleToggleRoadmapSkill(skill)}
                        />
                        <span>{skill}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* ز) الكورسات المقترحة */}
      {analysis.suggested_courses.length > 0 && (
        <section className="card">
          <h2 className="mb-4 text-lg font-black text-slate-900">
            🎓 الكورسات والمصادر التعليمية المقترحة
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {analysis.suggested_courses.map((course) => (
              <a
                key={course.title}
                href={course.url}
                target="_blank"
                rel="noreferrer"
                className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
              >
                <div>
                  <span className="mb-2 inline-block rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-extrabold text-indigo-700">
                    {course.platform}
                  </span>
                  <p className="mb-2 font-black text-slate-900 group-hover:text-indigo-700 transition-colors">
                    {course.title}
                  </p>
                </div>
                <p className="pt-2 border-t border-slate-100 text-xs font-bold text-slate-500">
                  يغطي مهارة: <span className="text-slate-800">{course.covers_skill}</span>
                </p>
              </a>
            ))}
          </div>
        </section>
      )}

      {!analysis.suggested_courses.length && (
        <p className="text-center text-sm text-slate-400">
          لا توجد كورسات مقترحة حالياً لهذا المسار
        </p>
      )}

      {/* Batch 1.2: Feedback Loop */}
      <FeedbackWidget analysisId={analysis.analysis_id} />

      {/* ح) أزرار الإجراءات */}
      <div className="flex flex-col items-center gap-3 pb-8 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={isDownloadingPdf}
          className="btn-outline w-full sm:w-auto"
        >
          {isDownloadingPdf ? "جاري التحميل..." : "📥 تحميل كـ PDF"}
        </button>
        <button
          type="button"
          onClick={() => setShowShareModal(true)}
          className="btn-outline w-full sm:w-auto"
        >
          🔗 {shareToken ? "إدارة المشاركة" : "مشاركة النتائج"}
        </button>
        <Link to="/history" className="btn-outline w-full sm:w-auto">
          📂 عرض سجل التحليلات
        </Link>
        <button
          type="button"
          onClick={startNewAnalysis}
          className="btn-secondary w-full sm:w-auto"
        >
          ✨ بدء تحليل جديد
        </button>
      </div>

      {showShareModal && (
        <ShareModal
          analysisId={analysis.analysis_id}
          shareToken={shareToken}
          onShareTokenChange={setShareToken}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {/* Cover Letter Modal */}
      {coverLetterJob &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-md"
            onClick={closeCoverLetterModal}
          >
            <div
              className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-black text-slate-900">
                  📝 خطاب تغطية: {coverLetterJob}
                </h2>
                <button
                  onClick={closeCoverLetterModal}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-danger"
                >
                  ✕
                </button>
              </div>
              {isGeneratingCL ? (
                <div className="py-12 text-center text-slate-500">
                  <div className="inline-block h-7 w-7 animate-spin rounded-full border-2 border-solid border-primary border-r-transparent mb-3" />
                  <p className="animate-pulse font-bold">
                    جاري صياغة خطاب التغطية بالذكاء الاصطناعي...
                  </p>
                </div>
              ) : (
                <div
                  className="bg-slate-50 p-5 rounded-2xl border border-slate-200 whitespace-pre-wrap text-slate-700 text-sm leading-relaxed"
                  dir="auto"
                >
                  {coverLetterText}
                </div>
              )}
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  className="btn-outline"
                  onClick={closeCoverLetterModal}
                >
                  إغلاق
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={isGeneratingCL || !coverLetterText}
                  onClick={() => {
                    navigator.clipboard.writeText(coverLetterText);
                    showToast("تم نسخ خطاب التغطية بنجاح");
                  }}
                >
                  📋 نسخ النص
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {showAtsBuilder && (
        <AtsCvBuilderModal
          extractionId={analysis.analysis_id || analysisId}
          initialSkills={analysis.skills?.length ? analysis.skills : (analysis.strengths || [])}
          defaultRole={analysis.top_jobs?.[0]?.job_title || ""}
          onClose={() => setShowAtsBuilder(false)}
        />
      )}
    </div>
  );
}
