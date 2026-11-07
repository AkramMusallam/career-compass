import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Check,
  ArrowRight,
  Scale,
} from "lucide-react";

import { getErrorMessage } from "../../api/client";
import { compareAnalyses } from "../../api/endpoints";
import CircularProgress from "../../components/ui/CircularProgress";

function AnalysisColumn({ analysis, title }) {
  return (
    <div className="card flex-1 space-y-3 text-center">
      <p className="text-xs font-bold text-slate-400">{title}</p>
      <p className="text-xs text-slate-400">
        {new Date(analysis.date || Date.now()).toLocaleDateString("ar-EG")}
      </p>
      <div className="flex justify-center">
        <CircularProgress value={analysis.career_score} size={116} strokeWidth={10} />
      </div>
      <p className="text-sm sm:text-base font-bold text-slate-900">
        {analysis.top_jobs?.[0]?.job_title}
      </p>
    </div>
  );
}

export default function CompareAnalyses() {
  const [searchParams] = useSearchParams();
  const ids = searchParams.get("ids") || "";
  const [idA, idB] = ids.split(",");

  const [status, setStatus] = useState("loading");
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
    <div className="mx-auto max-w-3xl space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600 border border-primary-100">
            <Scale size={20} />
          </div>
          <h1 className="text-lg sm:text-xl font-black text-slate-900">مقارنة تحليلين</h1>
        </div>
        <Link to="/history" className="btn-outline !py-2 !px-3.5 !text-xs">
          <ArrowRight size={14} />
          <span>العودة للسجل</span>
        </Link>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <AnalysisColumn analysis={data.analysis_a} title="التحليل الأول" />
        <AnalysisColumn analysis={data.analysis_b} title="التحليل الثاني" />
      </div>

      <div className="card flex flex-col items-center gap-1.5 text-center">
        <p className="text-xs font-bold text-slate-500">الفرق في Career Score</p>
        <div
          className={`inline-flex items-center gap-1.5 text-2xl sm:text-3xl font-black ${
            isImprovement
              ? "text-secondary-600"
              : isDecline
              ? "text-danger"
              : "text-slate-500"
          }`}
        >
          {isImprovement ? (
            <TrendingUp size={24} />
          ) : isDecline ? (
            <TrendingDown size={24} />
          ) : (
            <Minus size={24} />
          )}
          <span>
            {isImprovement ? "+" : ""}
            {Math.round(delta)}
          </span>
        </div>
        <p className="text-xs sm:text-sm font-semibold text-slate-600">
          {isImprovement
            ? "تحسّن ملحوظ في ملفك المهني"
            : isDecline
            ? "تراجع منذ آخر تحليل"
            : "لا تغيير بين التحليلين"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card !bg-secondary-50/60 !border-secondary-200">
          <h3 className="mb-3 text-sm font-black text-secondary-800">
            مهارات جديدة مكتسبة
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {data.new_skills_gained.length ? (
              data.new_skills_gained.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 rounded-lg bg-white border border-secondary-200 px-2.5 py-1 text-xs font-bold text-secondary-700"
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

        <div className="card !bg-red-50/60 !border-red-200">
          <h3 className="mb-3 text-sm font-black text-red-800">
            مهارات لم تعد متوفرة
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {data.skills_lost.length ? (
              data.skills_lost.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 rounded-lg bg-white border border-red-200 px-2.5 py-1 text-xs font-bold text-red-700"
                >
                  {s}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-400">لا يوجد</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
