import { useEffect, useState } from "react";
import {
  Briefcase,
  Building2,
  MapPin,
  Clock,
  DollarSign,
  ExternalLink,
  Check,
  Mic,
  RefreshCw,
} from "lucide-react";
import { getErrorMessage } from "../../../api/client";
import { getMatchedJobs } from "../../../api/endpoints";

export default function LiveJobMatchingSection({ analysisId, onStartInterview }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchJobs = () => {
    if (!analysisId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");

    getMatchedJobs(analysisId)
      .then((res) => {
        setJobs(res.data.jobs || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(getErrorMessage(err, "تعذر جلب شواغر الوظائف المطابقة"));
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisId]);

  if (loading) {
    return (
      <section className="card" id="companies-section">
        <h2 className="mb-3 text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
          <Briefcase size={18} className="text-primary-600" />
          <span>أمثلة وظائف للمقارنة</span>
        </h2>
        <div className="py-8 text-center text-slate-400">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-primary-600 border-r-transparent mb-2" />
          <p className="text-xs font-bold">
            جاري مطابقة مهاراتك مع أمثلة الوظائف...
          </p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="card" id="companies-section">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
            <Briefcase size={18} className="text-primary-600" />
            <span>أمثلة وظائف للمقارنة</span>
          </h2>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50/70 p-4 text-center">
          <p className="text-xs sm:text-sm font-bold text-red-700 mb-3">{error}</p>
          <button
            type="button"
            onClick={fetchJobs}
            className="inline-flex items-center gap-1.5 rounded-xl border border-red-300 bg-white px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-50 transition"
          >
            <RefreshCw size={14} />
            <span>إعادة المحاولة</span>
          </button>
        </div>
      </section>
    );
  }

  if (jobs.length === 0) {
    return (
      <section className="card" id="companies-section">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
            <Briefcase size={18} className="text-primary-600" />
            <span>أمثلة وظائف للمقارنة</span>
          </h2>
        </div>
        <div className="rounded-xl border border-accent-200 bg-accent-50/60 p-4 text-center">
          <p className="text-xs sm:text-sm font-bold text-accent-800">
            لم يتم العثور على شواغر بنسبة تطابق مباشرة لمهاراتك في الوقت الحالي. سيتم تحديث الشواغر تلقائياً عند إضافة مهارات جديدة لسجلك.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="card" id="companies-section">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
            <Briefcase size={18} className="text-primary-600" />
            <span>أمثلة وظائف للمقارنة</span>
          </h2>
          <p className="text-xs font-medium text-slate-500 mt-0.5">
            هذه أمثلة ثابتة وليست إعلانات مباشرة؛ تحقق من توفر الوظيفة وتفاصيلها لدى الشركة.
          </p>
        </div>
        <span className="bg-primary-50 text-primary-700 text-xs font-bold px-3 py-1 rounded-full border border-primary-200">
          {jobs.length} وظيفة متطابقة
        </span>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-1 md:grid-cols-2">
        {jobs.map((item) => {
          const isHighMatch = item.match_percentage >= 70;
          return (
            <div
              key={item.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-4 hover:border-primary-300 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 text-sm truncate">
                      {item.title}
                    </h3>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-primary-600 mt-0.5">
                      <Building2 size={13} /> {item.company}
                    </span>
                  </div>
                  <span
                    className={`shrink-0 rounded-lg px-2.5 py-0.5 text-xs font-black ${
                      isHighMatch
                        ? "bg-secondary-50 text-secondary-700 border border-secondary-200"
                        : "bg-primary-50 text-primary-700 border border-primary-200"
                    }`}
                  >
                    {Math.round(item.match_percentage)}% توافق
                  </span>
                </div>

                <div className="flex flex-wrap gap-2.5 text-[11px] font-semibold text-slate-500 mb-2.5">
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={12} className="text-slate-400" />
                    <span>{item.location}</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock size={12} className="text-slate-400" />
                    <span>{item.type}</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <DollarSign size={12} className="text-slate-400" />
                    <span>{item.salary_range}</span>
                  </span>
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
                            className="inline-flex items-center gap-1 bg-secondary-50 text-secondary-700 text-[10px] font-bold px-2 py-0.5 rounded border border-secondary-200"
                          >
                            <Check size={10} />
                            <span>{s}</span>
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
                            className="bg-accent-50 text-accent-700 text-[10px] font-semibold px-2 py-0.5 rounded border border-accent-200"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 mt-auto">
                <span className="text-[10px] text-slate-400 font-bold">
                  مثال توضيحي
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onStartInterview && onStartInterview(item.title)}
                    className="btn-outline !py-1.5 !px-2.5 !text-xs"
                    title="محاكاة مقابلة لهذا الشاغر"
                  >
                    <Mic size={13} />
                    <span>محاكاة مقابلة</span>
                  </button>

                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
