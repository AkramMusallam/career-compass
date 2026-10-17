import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { getHistory } from "../../api/endpoints";

const PAGE_SIZE = 10;

function getScoreBadgeClass(score) {
  if (score < 40) return "bg-red-50 text-red-700 border-red-200";
  if (score < 70) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-emerald-50 text-emerald-700 border-emerald-200";
}

export default function History() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading"); // loading | loaded | error
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ total: 0, analyses: [] });

  // وضع اختيار متعدد لمقارنة تحليلين بالضبط
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const load = useCallback(() => {
    setStatus("loading");
    getHistory({ sort, page, limit: PAGE_SIZE })
      .then((res) => {
        setData(res.data);
        setStatus("loaded");
      })
      .catch(() => setStatus("error"));
  }, [sort, page]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  const toggleCompareMode = () => {
    setCompareMode((v) => !v);
    setSelectedIds([]);
  };

  const toggleSelected = (analysisId) => {
    setSelectedIds((prev) => {
      if (prev.includes(analysisId)) {
        return prev.filter((id) => id !== analysisId);
      }
      if (prev.length >= 2) {
        return [prev[1], analysisId];
      }
      return [...prev, analysisId];
    });
  };

  const handleCompare = () => {
    if (selectedIds.length !== 2) return;
    navigate(`/compare?ids=${selectedIds[0]},${selectedIds[1]}`);
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header Card */}
      <div className="card flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200 px-3 py-0.5 text-[11px] font-extrabold text-indigo-700">
            📂 الأرشيف المهني
          </span>
          <h1 className="text-2xl font-black text-slate-900">
            سجل التحليلات{" "}
            {data.total > 0 && (
              <span className="text-sm font-bold text-slate-400">
                ({data.total} تحليل محفوظ)
              </span>
            )}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            className="input-field w-auto !py-2.5 !text-xs font-bold"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
          >
            <option value="newest">الأحدث أولاً</option>
            <option value="oldest">الأقدم أولاً</option>
            <option value="highest_score">الأعلى Career Score</option>
          </select>

          {data.total >= 2 && (
            <button
              type="button"
              className={`${
                compareMode ? "btn-primary" : "btn-outline"
              } !py-2.5 !px-4 !text-xs`}
              onClick={toggleCompareMode}
            >
              {compareMode ? "✕ إلغاء المقارنة" : "⚖️ قارن تحليلين"}
            </button>
          )}

          <Link
            to="/analysis/upload"
            className="btn-secondary !py-2.5 !px-4 !text-xs"
          >
            + تحليل جديد
          </Link>
        </div>
      </div>

      {compareMode && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/90 px-5 py-4 shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">⚖️</span>
            <p className="text-sm font-extrabold text-indigo-900">
              اختر تحليلين بالضبط للمقارنة المباشرة بين تطور مهاراتك ({selectedIds.length}/2)
            </p>
          </div>
          <button
            type="button"
            className="btn-primary !py-2 !px-5 !text-xs"
            disabled={selectedIds.length !== 2}
            onClick={handleCompare}
          >
            عرض المقارنة الآن ←
          </button>
        </div>
      )}

      {status === "loading" && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card h-20 animate-pulse" />
          ))}
        </div>
      )}

      {status === "error" && (
        <div className="card text-center py-12">
          <p className="mb-4 font-bold text-slate-700">تعذر تحميل سجل التحليلات</p>
          <button className="btn-primary" onClick={load}>
            إعادة المحاولة
          </button>
        </div>
      )}

      {status === "loaded" && data.analyses.length === 0 && (
        <div className="card flex flex-col items-center gap-4 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-3xl">
            📭
          </div>
          <div>
            <p className="text-lg font-black text-slate-800">لم تقم بأي تحليل مهني بعد</p>
            <p className="mt-1 text-sm text-slate-500">
              ارفع سيرتك الذاتية الآن واحصل على تقرير Career DNA وخطة تعلم مخصصة
            </p>
          </div>
          <Link to="/analysis/upload" className="btn-primary mt-2">
            🚀 ابدأ أول تحليل الآن
          </Link>
        </div>
      )}

      {status === "loaded" && data.analyses.length > 0 && (
        <>
          <div className="card divide-y divide-slate-100 !p-0 overflow-hidden">
            {data.analyses.map((item) => {
              const isSelected = selectedIds.includes(item.analysis_id);
              return (
                <div
                  key={item.analysis_id}
                  onClick={() => compareMode && toggleSelected(item.analysis_id)}
                  className={`flex flex-wrap items-center justify-between gap-4 p-5 transition-colors ${
                    compareMode ? "cursor-pointer" : ""
                  } ${
                    isSelected
                      ? "bg-indigo-50/70"
                      : "hover:bg-slate-50/80"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {compareMode && (
                      <input
                        type="checkbox"
                        className="h-5 w-5 rounded text-primary-600 focus:ring-primary-400"
                        checked={isSelected}
                        onChange={() => toggleSelected(item.analysis_id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`اختيار تحليل ${item.top_job_title} للمقارنة`}
                      />
                    )}
                    <div
                      className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl border font-black ${getScoreBadgeClass(
                        item.career_score
                      )}`}
                    >
                      <span className="text-base leading-none">
                        {Math.round(item.career_score)}
                      </span>
                      <span className="text-[9px] font-bold opacity-75">Score</span>
                    </div>
                    <div>
                      <p className="text-base font-black text-slate-900">
                        {item.top_job_title}
                      </p>
                      <p className="text-xs font-medium text-slate-400 mt-0.5">
                        📅 {new Date(item.date).toLocaleString("ar-EG")}
                      </p>
                    </div>
                  </div>
                  {!compareMode && (
                    <Link
                      to={`/results/${item.analysis_id}`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200/80 bg-indigo-50/70 px-4 py-2 text-xs font-extrabold text-indigo-700 transition-all hover:bg-indigo-600 hover:text-white hover:shadow-sm"
                    >
                      <span>عرض التقرير الكامل</span>
                      <span>←</span>
                    </Link>
                  )}
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                className="btn-outline !px-4 !py-2 !text-xs"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                السابق
              </button>
              <span className="text-xs font-extrabold text-slate-600">
                صفحة {page} من {totalPages}
              </span>
              <button
                className="btn-outline !px-4 !py-2 !text-xs"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                التالي
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
