import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";

import { getErrorMessage } from "../../api/client";
import { generateCoverLetter, startInterview } from "../../api/endpoints";
import { exportAnalysisPdf, getBenchmark, getHistoryDetail, updateRoadmapSkillProgress } from "../../api/endpoints";
import CircularProgress from "../../components/ui/CircularProgress";
import FeedbackWidget from "../../components/features/FeedbackWidget";
import ShareModal from "../../components/features/ShareModal";
import { useAnalysisFlow } from "../../context/AnalysisContext";
import { useToast } from "../../context/ToastContext";

function JobCard({ job, isTop }) {
  const [expanded, setExpanded] = useState(isTop);

  return (
    <div className={`rounded-2xl border-2 p-4 ${isTop ? "border-secondary bg-secondary-50" : "border-slate-200"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-black text-slate-800">{job.job_title}</p>
            {isTop && <span className="chip !bg-secondary-100 !text-secondary-600">الأنسب لك</span>}
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full ${isTop ? "bg-secondary" : "bg-primary"}`}
              style={{ width: `${job.match_percentage}%` }}
            />
          </div>
          <p className="mt-1 text-xs font-bold text-slate-500">نسبة التوافق {Math.round(job.match_percentage)}%</p>
          {job.explanation && <p className="mt-2 text-sm font-semibold text-slate-600">{job.explanation}</p>}
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-50"
        >
          {expanded ? "إخفاء" : "عرض التفاصيل"}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-bold text-slate-400">المهارات المتوفرة</p>
            <div className="flex flex-wrap gap-1.5">
              {job.matched_skills.length ? (
                job.matched_skills.map((s) => (
                  <span key={s} className="chip !bg-secondary-100 !text-secondary-600">
                    ✓ {s}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400">لا يوجد</span>
              )}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-bold text-slate-400">المهارات الناقصة</p>
            <div className="flex flex-wrap gap-1.5">
              {job.missing_skills.length ? (
                job.missing_skills.map((s) => (
                  <span key={s} className="chip !bg-slate-100 !text-slate-500">
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

export default function Results() {

  
  const [isStartingInterview, setIsStartingInterview] = useState(false);

  const handleStartInterview = async (jobTitle) => {
    setIsStartingInterview(true);
    try {
      const res = await startInterview(analysisId, jobTitle);
      navigate(/interview/);
    } catch (err) {
      showToast(getErrorMessage(err, "حدث خطأ أثناء بدء المقابلة."), "error");
    } finally {
      setIsStartingInterview(false);
    }
  };
const [coverLetterJob, setCoverLetterJob] = useState(null);
  const [coverLetterText, setCoverLetterText] = useState("");
  const [isGeneratingCL, setIsGeneratingCL] = useState(false);

  const handleGenerateCoverLetter = async (jobTitle) => {
    setCoverLetterJob(jobTitle);
    setCoverLetterText("");
    setIsGeneratingCL(true);
    try {
      const res = await generateCoverLetter(analysisId, jobTitle);
      setCoverLetterText(res.data.cover_letter);
    } catch (err) {
      setCoverLetterText(getErrorMessage(err, "حدث خطأ أثناء توليد خطاب التغطية."));
    } finally {
      setIsGeneratingCL(false);
    }
  };

  const closeCoverLetterModal = () => {
    setCoverLetterJob(null);
    setCoverLetterText("");
  };
  const { analysisId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { resetAnalysisFlow } = useAnalysisFlow();
  const { showToast } = useToast();

  const [analysis, setAnalysis] = useState(location.state?.analysis || null);
  const [status, setStatus] = useState(analysis ? "loaded" : "loading");
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [completedSkills, setCompletedSkills] = useState(() => new Set(analysis?.completed_skills || []));
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareToken, setShareToken] = useState(analysis?.share_token || null);
  const [benchmark, setBenchmark] = useState(null);
  const hasShownSaveToast = useRef(false);

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
      .catch(() => setBenchmark(null)); // فشل تحميل الـ Benchmark ليس حرجاً — نتجاهله بصمت
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
      const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
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
      await updateRoadmapSkillProgress(analysis.analysis_id, skill, !wasCompleted);
    } catch (error) {
      setCompletedSkills(completedSkills); // تراجع عن التحديث المتفائل عند الفشل
      showToast(getErrorMessage(error, "تعذر تحديث حالة المهارة"), "error");
    }
  };

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-4xl animate-pulse space-y-6">
        <div className="card h-48" />
        <div className="card h-64" />
      </div>
    );
  }

  if (status === "error" || !analysis) {
    return (
      <div className="card mx-auto max-w-md text-center">
        <p className="mb-2 font-bold text-danger">تعذر عرض نتائج التحليل</p>
        <p className="mb-4 text-sm text-slate-500">التحليل نفسه محفوظ ولن يُفقد</p>
        <button className="btn-primary" onClick={handleRetry}>
          إعادة المحاولة
        </button>
      </div>
    );
  }

  const dnaData = Object.entries(analysis.career_dna).map(([axis, value]) => ({ axis, value }));
  const allRoadmapSkills = [...new Set(analysis.roadmap.flatMap((m) => m.skills_to_learn))];
  const roadmapProgressPercent = allRoadmapSkills.length
    ? Math.round((completedSkills.size / allRoadmapSkills.length) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* أ) Career Score */}
      <section className="card flex flex-col items-center gap-3 text-center">
        <CircularProgress value={analysis.career_score} size={180} />
        <p className="max-w-md text-sm font-semibold text-slate-600">
          ملفك المهني {analysis.career_score >= 70 ? "قوي" : analysis.career_score >= 40 ? "جيد" : "بحاجة لتطوير"} ومتوافق
          مع {analysis.top_jobs.length} مسارات
        </p>
        {benchmark && benchmark.average_career_score !== null && (
          <p className="text-xs font-bold text-slate-400">
            متوسط الأقران (ممن وافقوا على المشاركة): {Math.round(benchmark.average_career_score)} من أصل{" "}
            {benchmark.sample_size} تحليل
            {analysis.career_score >= benchmark.average_career_score ? (
              <span className="text-secondary"> — أنت أعلى من المتوسط ▲</span>
            ) : (
              <span className="text-warning"> — أنت أقل من المتوسط ▼</span>
            )}
          </p>
        )}
      </section>

      {/* ب) Career DNA */}
      <section className="card">
        <h2 className="mb-3 font-black text-slate-800">Career DNA</h2>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={dnaData} outerRadius="65%">
              <PolarGrid stroke="#E2E8F0" />
              <PolarAngleAxis dataKey="axis" tick={{ fill: "#475569", fontSize: 12, fontWeight: 700 }} />
              <Radar dataKey="value" stroke="#1E40AF" fill="#1E40AF" fillOpacity={0.35} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ج) Top 5 Jobs */}
      <section className="card">
        <h2 className="mb-3 font-black text-slate-800">أفضل 5 وظائف مناسبة</h2>
        <div className="space-y-3">
          {analysis.top_jobs.map((job, index) => (
            <JobCard key={job.job_title} job={job} isTop={index === 0} />
          ))}
        </div>
      </section>

      {/* د) نقاط القوة والضعف */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-secondary-50 p-5">
          <h3 className="mb-2 font-black text-secondary-600">نقاط القوة</h3>
          <ul className="list-inside list-disc space-y-1 text-sm font-semibold text-slate-700">
            {analysis.strengths.length ? analysis.strengths.map((s) => <li key={s}>{s}</li>) : <li>لا يوجد بعد</li>}
          </ul>
        </div>
        <div className="rounded-2xl bg-warning-50 p-5">
          <h3 className="mb-2 font-black text-warning">نقاط الضعف</h3>
          <ul className="list-inside list-disc space-y-1 text-sm font-semibold text-slate-700">
            {analysis.weaknesses.length ? analysis.weaknesses.map((w) => <li key={w}>{w}</li>) : <li>لا يوجد</li>}
          </ul>
        </div>
      </section>

      {/* هـ) Skill Gap */}
      <section className="card">
        <h2 className="mb-3 font-black text-slate-800">فجوة المهارات</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="mb-2 text-xs font-black text-danger">Critical</p>
            <div className="flex flex-wrap gap-1.5">
              {analysis.skill_gap.critical.length ? (
                analysis.skill_gap.critical.map((s) => (
                  <span key={s} className="chip !bg-danger-50 !text-danger">
                    {s}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400">لا يوجد</span>
              )}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-black text-warning">Recommended</p>
            <div className="flex flex-wrap gap-1.5">
              {analysis.skill_gap.recommended.length ? (
                analysis.skill_gap.recommended.map((s) => (
                  <span key={s} className="chip !bg-warning-50 !text-warning">
                    {s}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400">لا يوجد</span>
              )}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-black text-slate-500">Nice to Have</p>
            <div className="flex flex-wrap gap-1.5">
              {analysis.skill_gap.nice_to_have.length ? (
                analysis.skill_gap.nice_to_have.map((s) => (
                  <span key={s} className="chip !bg-slate-100 !text-slate-500">
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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-black text-slate-800">خطة التعلم (3 أشهر)</h2>
          {allRoadmapSkills.length > 0 && (
            <div className="flex items-center gap-3">
              <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-secondary transition-all"
                  style={{ width: `${roadmapProgressPercent}%` }}
                />
              </div>
              <span className="text-xs font-bold text-slate-500">
                {completedSkills.size}/{allRoadmapSkills.length} مهارة مكتملة
              </span>
            </div>
          )}
        </div>
        <ol className="relative border-r-2 border-slate-200 pr-6">
          {analysis.roadmap.map((month) => (
            <li key={month.month} className="mb-8 last:mb-0">
              <span className="absolute -right-[9px] flex h-4 w-4 items-center justify-center rounded-full bg-primary" />
              <p className="mb-1 font-black text-primary">الشهر {month.month}</p>
              <ul className="mb-2 list-inside list-disc space-y-1 text-sm font-semibold text-slate-700">
                {month.goals.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
              {month.skills_to_learn.length > 0 && (
                <ul className="space-y-1.5">
                  {month.skills_to_learn.map((skill) => (
                    <li key={skill}>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded text-secondary focus:ring-secondary-500"
                          checked={completedSkills.has(skill)}
                          onChange={() => handleToggleRoadmapSkill(skill)}
                        />
                        <span
                          className={
                            completedSkills.has(skill) ? "text-slate-400 line-through" : "font-semibold text-slate-600"
                          }
                        >
                          {skill}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* ز) الكورسات المقترحة */}
      {analysis.suggested_courses.length > 0 && (
        <section className="card">
          <h2 className="mb-3 font-black text-slate-800">الكورسات المقترحة</h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {analysis.suggested_courses.map((course) => (
              <a
                key={course.title}
                href={course.url}
                target="_blank"
                rel="noreferrer"
                className="w-64 shrink-0 rounded-xl border border-slate-200 p-4 transition hover:border-primary hover:shadow-sm"
              >
                <p className="mb-1 text-xs font-bold text-primary">{course.platform}</p>
                <p className="mb-2 font-bold text-slate-800">{course.title}</p>
                <p className="text-xs text-slate-500">يغطي: {course.covers_skill}</p>
              </a>
            ))}
          </div>
        </section>
      )}

      {!analysis.suggested_courses.length && (
        <p className="text-center text-sm text-slate-400">لا توجد كورسات مقترحة حالياً لهذا المسار</p>
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
          {isDownloadingPdf ? "جاري التحميل..." : "تحميل كـ PDF"}
        </button>
        <button type="button" onClick={() => setShowShareModal(true)} className="btn-outline w-full sm:w-auto">
          {shareToken ? "إدارة المشاركة" : "مشاركة النتائج"}
        </button>
        <Link to="/history" className="btn-outline w-full sm:w-auto">
          عرض سجل التحليلات
        </Link>
        <button type="button" onClick={startNewAnalysis} className="btn-secondary w-full sm:w-auto">
          بدء تحليل جديد
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
      {coverLetterJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-black text-slate-800">خطاب تغطية: {coverLetterJob}</h2>
              <button onClick={closeCoverLetterModal} className="text-slate-400 hover:text-danger">✕</button>
            </div>
            {isGeneratingCL ? (
              <div className="py-12 text-center text-slate-500">
                <p className="animate-pulse">جاري توليد خطاب التغطية بالذكاء الاصطناعي...</p>
              </div>
            ) : (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 whitespace-pre-wrap text-slate-700 text-sm font-mono" dir="auto">
                {coverLetterText}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button type="button" className="btn-primary" onClick={() => { navigator.clipboard.writeText(coverLetterText); alert('تم النسخ!'); }}>
                📋 نسخ النص
              </button>
            </div>
          </div>
        </div>
      )}
</div>
  );
}
