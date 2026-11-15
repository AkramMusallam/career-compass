import { useEffect, useState } from "react";
import {
  Briefcase,
  Building2,
  MapPin,
  Clock,
  DollarSign,
  Check,
  Mic,
  RefreshCw,
  ExternalLink,
  Globe,
  Calendar,
} from "lucide-react";
import { getErrorMessage } from "../../../api/client";
import { getMatchedJobs } from "../../../api/endpoints";

const SOURCE_TABS = [
  { id: "all", label: "الكل" },
  { id: "internal", label: "فرص الشركات المسجلة" },
  { id: "external", label: "سوق العمل المباشر" },
];

export default function LiveJobMatchingSection({ analysisId, onStartInterview }) {
  const [jobs, setJobs] = useState([]);
  const [sourceFilter, setSourceFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchJobs = (selectedSource = sourceFilter) => {
    if (!analysisId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");

    getMatchedJobs(analysisId, { source: selectedSource })
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
    fetchJobs(sourceFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisId, sourceFilter]);

  if (loading) {
    return (
      <section className="card" id="companies-section">
        <h2 className="mb-3 text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
          <Briefcase size={18} className="text-primary-600" />
          <span>شواغر التوظيف المطابقة</span>
        </h2>
        <div className="py-8 text-center text-slate-400">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-primary-600 border-r-transparent mb-2" />
          <p className="text-xs font-bold">
            جاري مطابقة مهاراتك مع شواغر الشركات النشطة...
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
            <span>شواغر التوظيف المطابقة</span>
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
            <span>شواغر التوظيف المطابقة</span>
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {SOURCE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSourceFilter(tab.id)}
                className={`rounded-xl px-3 py-1 text-xs font-bold border transition ${
                  sourceFilter === tab.id
                    ? "bg-primary-600 text-white border-primary-600"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-accent-200 bg-accent-50/60 p-4 text-center">
          <p className="text-xs sm:text-sm font-bold text-accent-800">
            لم يتم العثور على شواغر بنسبة تطابق مباشرة لمهاراتك في هذا الفلتر حالياً. جرّب التبديل بين مصادر الوظائف أو تحديث مهاراتك.
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
            <span>شواغر التوظيف المطابقة</span>
          </h2>
          <p className="text-xs font-medium text-slate-500 mt-0.5">
            فرص الشركات المعتمدة على المنصة إلى جانب الشواغر الحية من سوق العمل المباشر المطابَقة لمهاراتك.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            {SOURCE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSourceFilter(tab.id)}
                className={`rounded-xl px-3 py-1 text-xs font-bold border transition ${
                  sourceFilter === tab.id
                    ? "bg-primary-600 text-white border-primary-600"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <span className="bg-primary-50 text-primary-700 text-xs font-bold px-3 py-1 rounded-full border border-primary-200">
            {jobs.length} وظيفة متطابقة
          </span>
        </div>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-1 md:grid-cols-2">
        {jobs.map((item) => {
          const isHighMatch = item.match_percentage >= 70;
          const isExternal = item.source === "external";
          return (
            <div
              key={item.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-4 hover:border-primary-300 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold border ${
                          isExternal
                            ? "bg-teal-50 text-teal-700 border-teal-200"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        {isExternal ? <Globe size={10} /> : <Building2 size={10} />}
                        <span>{isExternal ? `سوق مباشر • ${item.source_name || "External"}` : "شركات المنصة"}</span>
                      </span>
                    </div>
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
                  {item.posted_date && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={12} className="text-slate-400" />
                      <span>{String(item.posted_date).slice(0, 10)}</span>
                    </span>
                  )}
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

              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2 mt-auto">
                {item.apply_url && (
                  <a
                    href={item.apply_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary !py-1.5 !px-2.5 !text-xs inline-flex items-center gap-1"
                  >
                    <ExternalLink size={13} />
                    <span>التقديم المباشر</span>
                  </a>
                )}
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
          );
        })}
      </div>
    </section>
  );
}
