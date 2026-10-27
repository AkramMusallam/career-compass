import { useState } from "react";

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
