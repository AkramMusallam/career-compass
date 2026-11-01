import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FolderArchive,
  Scale,
  X,
  Plus,
  ArrowLeft,
  Calendar,
  Inbox,
  Sparkles,
} from "lucide-react";

import { getHistory } from "../../api/endpoints";

const PAGE_SIZE = 10;

function getScoreBadgeClass(score) {
  if (score < 40) return "bg-red-50 text-red-700 border-red-200";
  if (score < 70) return "bg-accent-50 text-accent-700 border-accent-200";
  return "bg-secondary-50 text-secondary-700 border-secondary-200";
}

export default function History() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ total: 0, analyses: [] });

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
    <div className="space-y-5 animate-fade-in">
      {/* Header Card */}
      <div className="card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="mb-1.5 inline-flex items-center gap-1.5 rounded-lg bg-primary-50 border border-primary-100 px-2.5 py-0.5 text-[11px] font-bold text-primary-700">
            <FolderArchive size={13} />
            <span>الأرشيف المهني</span>
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">
            سجل التحليلات{" "}
            {data.total > 0 && (
              <span className="text-xs sm:text-sm font-bold text-slate-400">
                ({data.total} تحليل محفوظ)
              </span>
            )}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            className="input-field w-auto !py-2 !px-3 !text-xs font-bold"
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
              } !py-2 !px-3.5 !text-xs`}
              onClick={toggleCompareMode}
            >
              {compareMode ? (
                <>
                  <X size={14} />
                  <span>إلغاء المقارنة</span>
                </>
              ) : (
                <>
                  <Scale size={14} />
                  <span>قارن تحليلين</span>
                </>
              )}
            </button>
          )}

          <Link
            to="/analysis/upload"
            className="btn-secondary !py-2 !px-3.5 !text-xs"
          >
            <Plus size={14} />
            <span>تحليل جديد</span>
          </Link>
        </div>
      </div>

      {compareMode && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-primary-200 bg-primary-50/80 px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <Scale size={18} className="text-primary-600 shrink-0" />
            <p className="text-xs sm:text-sm font-bold text-slate-900">
              اختر تحليلين بالضبط للمقارنة المباشرة بين تطور مهاراتك ({selectedIds.length}/2)
            </p>
          </div>
          <button
            type="button"
            className="btn-primary !py-2 !px-4 !text-xs"
            disabled={selectedIds.length !== 2}
            onClick={handleCompare}
          >
            <span>عرض المقارنة الآن</span>
            <ArrowLeft size={14} />
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
        <div className="card flex flex-col items-center gap-3 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <Inbox size={26} />
          </div>
          <div>
            <p className="text-base sm:text-lg font-black text-slate-800">لم تقم بأي تحليل مهني بعد</p>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              ارفع سيرتك الذاتية الآن واحصل على تقرير Career DNA وخطة تعلم مخصصة
            </p>
          </div>
          <Link to="/analysis/upload" className="btn-primary mt-2">
            <Sparkles size={16} />
            <span>ابدأ أول تحليل الآن</span>
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
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 transition-colors ${
                    compareMode ? "cursor-pointer" : ""
                  } ${
                    isSelected
                      ? "bg-primary-50/70"
                      : "hover:bg-slate-50/80"
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {compareMode && (
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded text-primary-600 focus:ring-primary-500"
                        checked={isSelected}
                        onChange={() => toggleSelected(item.analysis_id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`اختيار تحليل ${item.top_job_title} للمقارنة`}
                      />
                    )}
                    <div
                      className={`flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 flex-col items-center justify-center rounded-xl border font-black ${getScoreBadgeClass(
                        item.career_score
                      )}`}
                    >
                      <span className="text-sm sm:text-base leading-none">
                        {Math.round(item.career_score)}
                      </span>
                      <span className="text-[9px] font-bold opacity-75">Score</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm sm:text-base font-bold text-slate-900 truncate">
                        {item.top_job_title}
                      </p>
                      <p className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 mt-0.5">
                        <Calendar size={12} />
                        <span>{new Date(item.date).toLocaleString("ar-EG")}</span>
                      </p>
                    </div>
                  </div>
                  {!compareMode && (
                    <Link
                      to={`/results/${item.analysis_id}`}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
                    >
                      <span>عرض التقرير الكامل</span>
                      <ArrowLeft size={13} />
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
