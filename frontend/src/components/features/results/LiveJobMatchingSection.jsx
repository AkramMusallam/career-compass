import { useEffect, useState } from "react";
import { getErrorMessage } from "../../../api/client";
import { getMatchedJobs } from "../../../api/endpoints";

export default function LiveJobMatchingSection({ analysisId, onStartInterview }) {
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
