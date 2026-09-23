import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { getErrorMessage } from "../../api/client";
import { compareAnalyses } from "../../api/endpoints";
import CircularProgress from "../../components/ui/CircularProgress";

function AnalysisColumn({ analysis, title }) {
  return (
    <div className="card flex-1 space-y-3 text-center">
      <p className="text-xs font-bold text-slate-400">{title}</p>
      <p className="text-xs text-slate-400">{new Date(analysis.date || Date.now()).toLocaleDateString("ar-EG")}</p>
      <div className="flex justify-center">
        <CircularProgress value={analysis.career_score} size={120} strokeWidth={10} />
      </div>
      <p className="font-bold text-slate-800">{analysis.top_jobs?.[0]?.job_title}</p>
    </div>
  );
}

export default function CompareAnalyses() {
  const [searchParams] = useSearchParams();
  const ids = searchParams.get("ids") || "";
  const [idA, idB] = ids.split(",");

  const [status, setStatus] = useState("loading"); // loading | loaded | error
  const [data, setData] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!idA || !idB) {
      setStatus("error");
      setErrorMessage("يجب تحديد تحليلين للمقارنة");
      return;
    }
    let mounted = true;
    setStatus("loading");
    compareAnalyses(idA, idB)
      .then((res) => {
        if (mounted) {
          setData(res.data);
          setStatus("loaded");
        }
      })
      .catch((error) => {
        if (mounted) {
          setErrorMessage(getErrorMessage(error, "تعذر تحميل المقارنة"));
          setStatus("error");
        }
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idA, idB]);

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="card h-64 animate-pulse" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="card mx-auto max-w-md text-center">
        <p className="mb-2 font-bold text-danger">تعذر عرض المقارنة</p>
        <p className="mb-4 text-sm text-slate-500">{errorMessage}</p>
        <Link to="/history" className="btn-primary inline-flex">
          العودة للسجل
        </Link>
      </div>
    );
  }

  const delta = data.career_score_delta;
  const isImprovement = delta > 0;
  const isDecline = delta < 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-xl font-black text-slate-800">مقارنة تحليلين</h1>

      <div className="flex flex-col gap-4 sm:flex-row">
        <AnalysisColumn analysis={data.analysis_a} title="التحليل الأول" />
        <AnalysisColumn analysis={data.analysis_b} title="التحليل الثاني" />
      </div>

      <div className="card flex flex-col items-center gap-2 text-center">
        <p className="text-sm font-bold text-slate-500">الفرق في Career Score</p>
        <p
          className={`text-3xl font-black ${
            isImprovement ? "text-secondary" : isDecline ? "text-danger" : "text-slate-500"
          }`}
        >
          {isImprovement ? "▲ +" : isDecline ? "▼ " : ""}
          {Math.round(delta)}
        </p>
        <p className="text-sm font-semibold text-slate-600">
          {isImprovement ? "تحسّن ملحوظ في ملفك المهني" : isDecline ? "تراجع منذ آخر تحليل" : "لا تغيير بين التحليلين"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-secondary-50 p-5">
          <h3 className="mb-2 font-black text-secondary-600">مهارات جديدة مكتسبة</h3>
          <div className="flex flex-wrap gap-1.5">
            {data.new_skills_gained.length ? (
              data.new_skills_gained.map((s) => (
                <span key={s} className="chip !bg-secondary-100 !text-secondary-600">
                  ✓ {s}
                </span>
              ))
            ) : (
              <span className="text-sm text-slate-400">لا يوجد</span>
            )}
          </div>
        </div>
        <div className="rounded-2xl bg-danger-50 p-5">
          <h3 className="mb-2 font-black text-danger">مهارات لم تعد متوفرة</h3>
          <div className="flex flex-wrap gap-1.5">
            {data.skills_lost.length ? (
              data.skills_lost.map((s) => (
                <span key={s} className="chip !bg-danger-100 !text-danger">
                  {s}
                </span>
              ))
            ) : (
              <span className="text-sm text-slate-400">لا يوجد</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-center pb-8">
        <Link to="/history" className="btn-outline">
          العودة للسجل
        </Link>
      </div>
    </div>
  );
}
