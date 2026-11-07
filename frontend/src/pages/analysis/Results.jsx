import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import {
  Sparkles,
  Download,
  FileText,
  Share2,
  TrendingUp,
  TrendingDown,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Target,
  Briefcase,
  ArrowDown,
  Flame,
  Star,
  Lightbulb,
  Map,
  GraduationCap,
  FolderClock,
} from "lucide-react";

import { getErrorMessage } from "../../api/client";
import {
  generateCoverLetter,
  startInterview,
  exportAnalysisPdf,
  getBenchmark,
  getHistoryDetail,
  updateRoadmapSkillProgress,
} from "../../api/endpoints";
import CircularProgress from "../../components/ui/CircularProgress";
import AtsCvBuilderModal from "../../components/features/AtsCvBuilderModal";
import FeedbackWidget from "../../components/features/FeedbackWidget";
import ShareModal from "../../components/features/ShareModal";
import JobCard from "../../components/features/results/JobCard";
import LiveJobMatchingSection from "../../components/features/results/LiveJobMatchingSection";
import CoverLetterModal from "../../components/features/results/CoverLetterModal";
import { useAnalysisFlow } from "../../context/AnalysisContext";
import { useToast } from "../../context/ToastContext";

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
      <div className="mx-auto max-w-5xl animate-pulse space-y-5">
        <div className="card h-52" />
        <div className="card h-64" />
      </div>
    );
  }

  if (status === "error" || !analysis) {
    return (
      <div className="card mx-auto max-w-md text-center py-12">
        <p className="mb-2 text-base sm:text-lg font-black text-danger">
          تعذر عرض نتائج التحليل
        </p>
        <p className="mb-5 text-xs sm:text-sm text-slate-500">
          التحليل نفسه محفوظ بأمان في سجلك ولن يُفقد
        </p>
        <button className="btn-primary" onClick={handleRetry}>
          إعادة المحاولة
        </button>
      </div>
    );
  }

  const careerDna = analysis.career_dna || {};
  const topJobs = Array.isArray(analysis.top_jobs) ? analysis.top_jobs : [];
  const strengths = Array.isArray(analysis.strengths) ? analysis.strengths : [];
  const weaknesses = Array.isArray(analysis.weaknesses) ? analysis.weaknesses : [];
  const skillGap = analysis.skill_gap || {};
  const criticalSkills = Array.isArray(skillGap.critical) ? skillGap.critical : [];
  const recommendedSkills = Array.isArray(skillGap.recommended)
    ? skillGap.recommended
    : [];
  const niceToHaveSkills = Array.isArray(skillGap.nice_to_have)
    ? skillGap.nice_to_have
    : [];
  const roadmap = Array.isArray(analysis.roadmap) ? analysis.roadmap : [];
  const suggestedCourses = Array.isArray(analysis.suggested_courses)
    ? analysis.suggested_courses
    : [];

  const dnaData = Object.entries(careerDna).map(([axis, value]) => ({
    axis,
    value,
  }));
  const allRoadmapSkills = [
    ...new Set(roadmap.flatMap((m) => m.skills_to_learn || [])),
  ];
  const roadmapProgressPercent = allRoadmapSkills.length
    ? Math.round((completedSkills.size / allRoadmapSkills.length) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-5 animate-fade-in">
      {/* أ) Executive Career Score Hero */}
      <section className="rounded-2xl bg-slate-900 text-white p-5 sm:p-8 shadow-card border border-slate-800">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex-1 text-center md:text-right">
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-[11px] font-bold text-secondary-300">
              <Sparkles size={13} />
              <span>التقرير التنفيذي للجاهزية المهنية</span>
            </span>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white mb-2.5 leading-snug">
              ملفك المهني{" "}
              <span className="text-secondary-400">
                {analysis.career_score >= 70
                  ? "قوي ومنافس"
                  : analysis.career_score >= 40
                  ? "جيد وواعد"
                  : "بحاجة لتطوير منهجي"}
              </span>{" "}
              ومتوافق مع {topJobs.length} مسارات وظيفية
            </h1>
            {topJobs[0] && (
              <p className="text-xs sm:text-sm text-slate-300 font-medium">
                أعلى مسار موصى به لك حالياً:{" "}
                <b className="text-white">{topJobs[0].job_title}</b>{" "}
                بنسبة توافق{" "}
                <b className="text-secondary-400">
                  {Math.round(topJobs[0].match_percentage)}%
                </b>
              </p>
            )}

            {benchmark && benchmark.average_career_score !== null && (
              <div className="mt-3.5 inline-flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs font-bold text-slate-300">
                <span>
                  متوسط الأقران: {Math.round(benchmark.average_career_score)} (من{" "}
                  {benchmark.sample_size} تحليل)
                </span>
                {analysis.career_score >= benchmark.average_career_score ? (
                  <span className="inline-flex items-center gap-1 text-secondary-400 font-extrabold">
                    <TrendingUp size={13} />
                    <span>أعلى من المتوسط</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-accent-400 font-extrabold">
                    <TrendingDown size={13} />
                    <span>أقل من المتوسط</span>
                  </span>
                )}
              </div>
            )}

            <div className="mt-5 flex flex-wrap justify-center md:justify-start gap-2">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isDownloadingPdf}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-primary-500 transition-colors disabled:opacity-50"
              >
                <Download size={14} />
                <span>{isDownloadingPdf ? "جاري التصدير..." : "تحميل التقرير PDF"}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAtsBuilder(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-secondary-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-secondary-500 transition-colors"
              >
                <FileText size={14} />
                <span>بناء سيرة ATS</span>
              </button>
              <button
                type="button"
                onClick={() => setShowShareModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition-colors"
              >
                <Share2 size={14} />
                <span>{shareToken ? "إدارة المشاركة" : "مشاركة التقرير"}</span>
              </button>
            </div>
          </div>

          <div className="shrink-0 rounded-2xl border border-slate-800 bg-slate-800/70 p-5">
            <CircularProgress
              value={analysis.career_score}
              size={150}
              dark={true}
              label="مؤشر Career Score"
            />
          </div>
        </div>
      </section>

      {/* ب) Career DNA + نقاط القوة والضعف */}
      <div className="grid gap-5 lg:grid-cols-12">
        <section className="card lg:col-span-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Activity size={18} className="text-primary-600" />
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                البصمة المهنية (Career DNA)
              </h2>
            </div>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              توزيع قدراتك عبر المحاور المهنية والتقنية الرئيسية
            </p>
          </div>
          <div className="h-72 sm:h-80 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={dnaData} outerRadius="66%">
                <PolarGrid stroke="#CBD5E1" />
                <PolarAngleAxis
                  dataKey="axis"
                  tick={{ fill: "#334155", fontSize: 11, fontWeight: 700 }}
                />
                <Radar
                  dataKey="value"
                  stroke="#2563EB"
                  strokeWidth={2}
                  fill="#3B82F6"
                  fillOpacity={0.3}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="lg:col-span-5 flex flex-col gap-4">
          <div className="card flex-1 !border-secondary-200 !bg-secondary-50/40">
            <h3 className="mb-3 flex items-center gap-2 text-sm sm:text-base font-black text-secondary-800">
              <CheckCircle2 size={18} className="text-secondary-600" />
              <span>نقاط القوة البارزة</span>
            </h3>
            <ul className="space-y-2 text-xs sm:text-sm font-semibold text-slate-700">
              {strengths.length ? (
                strengths.map((s) => (
                  <li key={s} className="flex items-start gap-2">
                    <span className="text-secondary-600 font-black">•</span>
                    <span>{s}</span>
                  </li>
                ))
              ) : (
                <li className="text-slate-400">لا يوجد بعد</li>
              )}
            </ul>
          </div>

          <div className="card flex-1 !border-accent-200 !bg-accent-50/40">
            <h3 className="mb-3 flex items-center gap-2 text-sm sm:text-base font-black text-accent-800">
              <AlertTriangle size={18} className="text-accent-600" />
              <span>جوانب قابلة للتعزيز</span>
            </h3>
            <ul className="space-y-2 text-xs sm:text-sm font-semibold text-slate-700">
              {weaknesses.length ? (
                weaknesses.map((w) => (
                  <li key={w} className="flex items-start gap-2">
                    <span className="text-accent-600 font-black">•</span>
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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Target size={18} className="text-primary-600" />
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                أفضل 5 مسارات وظيفية مناسبة لك
              </h2>
            </div>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              مرتبة تنازلياً حسب توافق مهاراتك وخبراتك مع متطلبات كل دور وظيفي
            </p>
          </div>
          <a
            href="#companies-section"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary-50 border border-primary-200 px-3 py-1.5 text-xs font-bold text-primary-700 hover:bg-primary-100 transition-colors"
          >
            <Briefcase size={13} />
            <span>الشركات المقترحة للتقديم المباشر</span>
            <ArrowDown size={13} />
          </a>
        </div>
        <div className="space-y-3">
          {topJobs.map((job, index) => (
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

      {/* فرص العمل الحقيقية المطابقة لملفك والشركات المقترحة */}
      <LiveJobMatchingSection
        analysisId={analysis.analysis_id || analysisId}
        onStartInterview={handleStartInterview}
      />

      {/* هـ) Skill Gap */}
      <section className="card">
        <h2 className="mb-4 text-base sm:text-lg font-black text-slate-900">
          تحليل فجوة المهارات (Skill Gap Analysis)
        </h2>
        <div className="grid gap-3.5 sm:grid-cols-3">
          <div className="rounded-xl border border-red-200 bg-red-50/40 p-4">
            <p className="mb-2.5 text-xs font-black text-danger flex items-center gap-1.5">
              <Flame size={15} />
              <span>مهارات حرجة (Critical)</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {criticalSkills.length ? (
                criticalSkills.map((s) => (
                  <span
                    key={s}
                    className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-bold text-red-700"
                  >
                    {s}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400">لا يوجد</span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-accent-200 bg-accent-50/40 p-4">
            <p className="mb-2.5 text-xs font-black text-accent-700 flex items-center gap-1.5">
              <Star size={15} />
              <span>موصى بها (Recommended)</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {recommendedSkills.length ? (
                recommendedSkills.map((s) => (
                  <span
                    key={s}
                    className="rounded-lg border border-accent-200 bg-white px-2.5 py-1 text-xs font-bold text-accent-800"
                  >
                    {s}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400">لا يوجد</span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="mb-2.5 text-xs font-black text-slate-600 flex items-center gap-1.5">
              <Lightbulb size={15} />
              <span>إضافية داعمة (Nice to Have)</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {niceToHaveSkills.length ? (
                niceToHaveSkills.map((s) => (
                  <span
                    key={s}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600"
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
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Map size={18} className="text-secondary-600" />
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                خارطة التعلم والتطوير (3 أشهر)
              </h2>
            </div>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              ضع علامة صح بجانب كل مهارة تنجزها لتتبع تقدمك الفعلي
            </p>
          </div>
          {allRoadmapSkills.length > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-secondary-200 bg-secondary-50/70 px-3.5 py-2">
              <div className="h-2 w-24 sm:w-32 overflow-hidden rounded-full bg-secondary-100">
                <div
                  className="h-full rounded-full bg-secondary-600 transition-all duration-500"
                  style={{ width: `${roadmapProgressPercent}%` }}
                />
              </div>
              <span className="text-xs font-black text-secondary-800">
                {completedSkills.size}/{allRoadmapSkills.length} (
                {roadmapProgressPercent}%)
              </span>
            </div>
          )}
        </div>

        <ol className="relative border-r-2 border-primary-200 pr-5 space-y-4">
          {roadmap.map((month) => (
            <li
              key={month.month}
              className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4"
            >
              <span className="absolute -right-[9px] flex h-4 w-4 items-center justify-center rounded-full bg-primary-600 ring-4 ring-white" />
              <p className="mb-2 text-sm sm:text-base font-black text-primary-700">
                الشهر {month.month}
              </p>
              <ul className="mb-3 list-inside list-disc space-y-1 text-xs sm:text-sm font-semibold text-slate-700">
                {(month.goals || []).map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
              {(month.skills_to_learn || []).length > 0 && (
                <div className="pt-2.5 border-t border-slate-200/60 flex flex-wrap gap-2">
                  {(month.skills_to_learn || []).map((skill) => {
                    const done = completedSkills.has(skill);
                    return (
                      <label
                        key={skill}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors ${
                          done
                            ? "border-secondary-200 bg-secondary-50 text-secondary-700 line-through"
                            : "border-slate-200 bg-white text-slate-700 hover:border-primary-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded text-secondary-600 focus:ring-secondary-500"
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
      {suggestedCourses.length > 0 && (
        <section className="card">
          <div className="mb-4 flex items-center gap-2">
            <GraduationCap size={18} className="text-primary-600" />
            <h2 className="text-base sm:text-lg font-black text-slate-900">
              الكورسات والمصادر التعليمية المقترحة
            </h2>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2 md:grid-cols-3">
            {suggestedCourses.map((course) => (
              <a
                key={course.title}
                href={course.url}
                target="_blank"
                rel="noreferrer"
                className="group flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-4 transition-colors hover:border-primary-300"
              >
                <div>
                  <span className="mb-2 inline-block rounded-md bg-primary-50 px-2.5 py-0.5 text-[11px] font-bold text-primary-700">
                    {course.platform}
                  </span>
                  <p className="mb-2 text-sm font-bold text-slate-900 group-hover:text-primary-600 transition-colors">
                    {course.title}
                  </p>
                </div>
                <p className="pt-2 border-t border-slate-100 text-xs font-bold text-slate-500">
                  يغطي مهارة:{" "}
                  <span className="text-slate-800">{course.covers_skill}</span>
                </p>
              </a>
            ))}
          </div>
        </section>
      )}

      {!suggestedCourses.length && (
        <p className="text-center text-xs sm:text-sm text-slate-400">
          لا توجد كورسات مقترحة حالياً لهذا المسار
        </p>
      )}

      {/* Feedback Loop */}
      <FeedbackWidget analysisId={analysis.analysis_id} />

      {/* ح) أزرار الإجراءات */}
      <div className="flex flex-col items-center gap-2.5 pb-6 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={isDownloadingPdf}
          className="btn-outline w-full sm:w-auto"
        >
          <Download size={15} />
          <span>{isDownloadingPdf ? "جاري التحميل..." : "تحميل كـ PDF"}</span>
        </button>
        <button
          type="button"
          onClick={() => setShowShareModal(true)}
          className="btn-outline w-full sm:w-auto"
        >
          <Share2 size={15} />
          <span>{shareToken ? "إدارة المشاركة" : "مشاركة النتائج"}</span>
        </button>
        <Link to="/history" className="btn-outline w-full sm:w-auto">
          <FolderClock size={15} />
          <span>عرض سجل التحليلات</span>
        </Link>
        <button
          type="button"
          onClick={startNewAnalysis}
          className="btn-secondary w-full sm:w-auto"
        >
          <Sparkles size={15} />
          <span>بدء تحليل جديد</span>
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

      <CoverLetterModal
        coverLetterJob={coverLetterJob}
        coverLetterText={coverLetterText}
        isGeneratingCL={isGeneratingCL}
        onClose={closeCoverLetterModal}
        onCopySuccess={() => showToast("تم نسخ خطاب التغطية بنجاح")}
      />

      {showAtsBuilder && (
        <AtsCvBuilderModal
          extractionId={analysis.analysis_id || analysisId}
          initialSkills={
            analysis.skills?.length ? analysis.skills : analysis.strengths || []
          }
          defaultRole={analysis.top_jobs?.[0]?.job_title || ""}
          onClose={() => setShowAtsBuilder(false)}
        />
      )}
    </div>
  );
}
