import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getHistory, getProfile } from "../api/endpoints";
import CircularProgress from "../components/CircularProgress";
import { useAuth } from "../context/AuthContext";

function SkeletonCard() {
  return (
    <div className="card animate-pulse">
      <div className="mb-4 h-4 w-1/3 rounded bg-slate-200" />
      <div className="h-24 w-full rounded bg-slate-100" />
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [status, setStatus] = useState("loading"); // loading | loaded | error
  const [profile, setProfile] = useState(null);
  const [recentAnalyses, setRecentAnalyses] = useState([]);

  const loadData = useCallback(async () => {
    setStatus("loading");
    try {
      const [profileRes, historyRes] = await Promise.all([
        getProfile(),
        getHistory({ sort: "newest", page: 1, limit: 3 }),
      ]);
      setProfile(profileRes.data);
      setRecentAnalyses(historyRes.data.analyses);
      setStatus("loaded");
    } catch (error) {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (status === "loading") {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
        <div className="grid gap-6 md:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="card text-center">
        <p className="mb-4 font-bold text-slate-700">تعذر تحميل بياناتك</p>
        <button className="btn-primary" onClick={loadData}>
          إعادة المحاولة
        </button>
      </div>
    );
  }

  const hasAnalyses = recentAnalyses.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-800">مرحباً، {profile?.full_name}</h1>
        <p className="text-slate-500">هذه نظرة سريعة على رحلتك المهنية</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="card flex flex-col items-center justify-center gap-4 text-center">
          {hasAnalyses ? (
            <>
              <CircularProgress value={recentAnalyses[0].career_score} label="آخر Career Score محسوب" />
              <p className="text-sm text-slate-500">
                آخر تحليل بتاريخ {new Date(recentAnalyses[0].date).toLocaleDateString("ar-EG")}
              </p>
            </>
          ) : (
            <>
              <span className="text-5xl" aria-hidden="true">
                🧭
              </span>
              <p className="font-bold text-slate-700">لم تقم بأي تحليل بعد</p>
              <p className="text-sm text-slate-500">ابدأ أول تحليل لاكتشاف مسارك المهني الأنسب</p>
            </>
          )}
          <Link to="/analysis/upload" className="btn-secondary w-full max-w-xs">
            بدء تحليل جديد
          </Link>
        </div>

        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-black text-slate-800">آخر 3 تحليلات</h2>
            <Link to="/history" className="text-sm font-bold text-primary hover:underline">
              عرض كل السجل
            </Link>
          </div>

          {hasAnalyses ? (
            <ul className="space-y-3">
              {recentAnalyses.map((item) => (
                <li
                  key={item.analysis_id}
                  className="flex items-center justify-between rounded-xl border border-slate-100 p-3"
                >
                  <div>
                    <p className="font-bold text-slate-800">{item.top_job_title}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(item.date).toLocaleDateString("ar-EG")} — النتيجة {Math.round(item.career_score)}
                    </p>
                  </div>
                  <Link
                    to={`/results/${item.analysis_id}`}
                    className="rounded-lg bg-primary-50 px-3 py-1.5 text-sm font-bold text-primary hover:bg-primary-100"
                  >
                    عرض التفاصيل
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">ستظهر تحليلاتك هنا بمجرد إجراء أول تحليل</p>
          )}
        </div>
      </div>
    </div>
  );
}
