import { useState } from "react";
import {
  Award,
  FileText,
  Mic,
  Check,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export default function JobCard({
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
      className={`rounded-2xl border p-4 sm:p-5 transition-colors ${
        isTop
          ? "border-secondary-300 bg-secondary-50/40"
          : "border-slate-200/80 bg-white hover:border-slate-300"
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black ${
                isTop
                  ? "bg-secondary-600 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              #{rank}
            </span>
            <p className="text-sm sm:text-base font-black text-slate-900">
              {job.job_title}
            </p>
            {isTop && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary-100 border border-secondary-200 px-2.5 py-0.5 text-[11px] font-bold text-secondary-800">
                <Award size={12} />
                <span>المسار الأنسب لك</span>
              </span>
            )}
          </div>
          <div className="mt-2.5 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isTop ? "bg-secondary-600" : "bg-primary-600"
                }`}
                style={{ width: `${job.match_percentage}%` }}
              />
            </div>
            <span
              className={`text-xs font-black shrink-0 ${
                isTop ? "text-secondary-700" : "text-primary-700"
              }`}
            >
              {Math.round(job.match_percentage)}% توافق
            </span>
          </div>
          {job.explanation && (
            <p className="mt-2 text-xs sm:text-sm font-medium text-slate-600 leading-relaxed">
              {job.explanation}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onGenerateCoverLetter && (
            <button
              type="button"
              onClick={() => onGenerateCoverLetter(job.job_title)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-bold text-primary-700 transition-colors hover:bg-primary-600 hover:text-white"
            >
              <FileText size={14} />
              <span>خطاب تغطية</span>
            </button>
          )}
          {onStartInterview && (
            <button
              type="button"
              disabled={isStartingInterview}
              onClick={() => onStartInterview(job.job_title)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-secondary-200 bg-secondary-50 px-3 py-2 text-xs font-bold text-secondary-700 transition-colors hover:bg-secondary-600 hover:text-white disabled:opacity-50"
            >
              <Mic size={14} />
              <span>{isStartingInterview ? "جاري الفتح..." : "محاكاة مقابلة"}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            <span>{expanded ? "إخفاء التفاصيل" : "عرض المهارات"}</span>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-3.5 border-t border-slate-200/70 grid gap-3.5 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-bold text-secondary-700">
              المهارات المتوفرة لديك
            </p>
            <div className="flex flex-wrap gap-1.5">
              {job.matched_skills.length ? (
                job.matched_skills.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1 rounded-lg border border-secondary-200 bg-secondary-50 px-2.5 py-0.5 text-xs font-bold text-secondary-700"
                  >
                    <Check size={12} />
                    <span>{s}</span>
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400">لا يوجد</span>
              )}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold text-slate-500">
              المهارات المطلوبة للتطوير
            </p>
            <div className="flex flex-wrap gap-1.5">
              {job.missing_skills.length ? (
                job.missing_skills.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600"
                  >
                    <X size={12} />
                    <span>{s}</span>
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
