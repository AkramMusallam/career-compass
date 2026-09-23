import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { getHistory } from "../api/endpoints";

const PAGE_SIZE = 10;

function scoreColor(score) {
  if (score < 40) return "text-danger";
  if (score < 70) return "text-warning";
  return "text-secondary";
}

export default function History() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading"); // loading | loaded | error
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ total: 0, analyses: [] });

  // Batch 2.1 (F2.1) — وضع اختيار متعدد لمقارنة تحليلين بالضبط
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
        return [prev[1], analysisId]; // نحافظ على آخر اختيارين فقط
      }
      return [...prev, analysisId];
    });
  };

  const handleCompare = () => {
    if (selectedIds.length !== 2) return;
    navigate(`/compare?ids=${selectedIds[0]},${selectedIds[1]}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-black text-slate-800">
          سجل التحليلات {data.total > 0 && <span className="text-sm font-bold text-slate-400">({data.total} تحليل)</span>}
        </h1>

        <div className="flex items-center gap-2">
          <select
            className="input-field w-auto"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
          >
            <option value="newest">الأحدث أولاً</option>
            <option value="oldest">الأقدم أولاً</option>
            <option value="highest_score">الأعلى Score</option>
          </select>

          {data.total >= 2 && (
            <button type="button" className={compareMode ? "btn-primary" : "btn-outline"} onClick={toggleCompareMode}>
              {compareMode ? "إلغاء المقارنة" : "قارن تحليلين"}
            </button>
          )}
        </div>
      </div>

      {compareMode && (
        <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-primary-100 bg-primary-50 px-4 py-3">
          <p className="text-sm font-bold text-primary">
            اختر تحليلين بالضبط للمقارنة ({selectedIds.length}/2)
          </p>
          <button type="button" className="btn-primary" disabled={selectedIds.length !== 2} onClick={handleCompare}>
            قارن الآن
          </button>
        </div>
      )}

      {status === "loading" && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card h-16 animate-pulse" />
          ))}
        </div>
      )}

      {status === "error" && (
        <div className="card text-center">
          <p className="mb-4 font-bold text-slate-700">تعذر تحميل السجل</p>
          <button className="btn-primary" onClick={load}>
            إعادة المحاولة
          </button>
        </div>
      )}

      {status === "loaded" && data.analyses.length === 0 && (
        <div className="card flex flex-col items-center gap-3 py-12 text-center">
          <span className="text-4xl" aria-hidden="true">
            📭
          </span>
          <p className="font-bold text-slate-700">لم تقم بأي تحليل بعد</p>
          <Link to="/analysis/upload" className="btn-secondary">
            ابدأ أول تحليل
          </Link>
        </div>
      )}

      {status === "loaded" && data.analyses.length > 0 && (
        <>
          <div className="card divide-y divide-slate-100 p-0">
            {data.analyses.map((item) => {
              const isSelected = selectedIds.includes(item.analysis_id);
              return (
                <div key={item.analysis_id} className="flex items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-4">
                    {compareMode && (
                      <input
                        type="checkbox"
                        className="h-5 w-5 rounded text-primary focus:ring-primary-400"
                        checked={isSelected}
                        onChange={() => toggleSelected(item.analysis_id)}
                        aria-label={`اختيار تحليل ${item.top_job_title} للمقارنة`}
                      />
                    )}
                    <span className={`text-lg font-black ${scoreColor(item.career_score)}`}>
                      {Math.round(item.career_score)}
                    </span>
                    <div>
                      <p className="font-bold text-slate-800">{item.top_job_title}</p>
                      <p className="text-xs text-slate-400">{new Date(item.date).toLocaleString("ar-EG")}</p>
                    </div>
                  </div>
                  {!compareMode && (
                    <Link
                      to={`/results/${item.analysis_id}`}
                      className="rounded-lg bg-primary-50 px-4 py-2 text-sm font-bold text-primary hover:bg-primary-100"
                    >
                      عرض
                    </Link>
                  )}
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                className="btn-outline px-4 py-2"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                السابق
              </button>
              <span className="text-sm font-bold text-slate-500">
                صفحة {page} من {totalPages}
              </span>
              <button
                className="btn-outline px-4 py-2"
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
