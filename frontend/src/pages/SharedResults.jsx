import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from "recharts";

import { getErrorMessage } from "../api/client";
import { getSharedAnalysis } from "../api/endpoints";
import CircularProgress from "../components/CircularProgress";
import CompassLogo from "../components/CompassLogo";

export default function SharedResults() {
  const { shareToken } = useParams();
  const [status, setStatus] = useState("loading"); // loading | loaded | error
  const [data, setData] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    getSharedAnalysis(shareToken)
      .then((res) => {
        if (mounted) {
          setData(res.data);
          setStatus("loaded");
        }
      })
      .catch((error) => {
        if (mounted) {
          setErrorMessage(getErrorMessage(error, "هذا الرابط غير موجود أو تم إلغاؤه من صاحبه"));
          setStatus("error");
        }
      });
    return () => {
      mounted = false;
    };
  }, [shareToken]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="card h-64 w-full max-w-md animate-pulse" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center">
        <CompassLogo size={48} />
        <p className="font-bold text-danger">{errorMessage}</p>
        <Link to="/login" className="btn-primary">
          الذهاب لـ Career Compass
        </Link>
      </div>
    );
  }

  const dnaData = Object.entries(data.career_dna).map(([axis, value]) => ({ axis, value }));

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <CompassLogo size={40} />
          <p className="text-sm font-bold text-slate-400">نتيجة تحليل مهني مُشارَكة</p>
        </div>

        <section className="card flex flex-col items-center gap-3 text-center">
          <CircularProgress value={data.career_score} size={160} />
          <p className="text-xs text-slate-400">{new Date(data.date).toLocaleDateString("ar-EG")}</p>
        </section>

        <section className="card">
          <h2 className="mb-3 font-black text-slate-800">Career DNA</h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={dnaData} outerRadius="65%">
                <PolarGrid stroke="#E2E8F0" />
                <PolarAngleAxis dataKey="axis" tick={{ fill: "#475569", fontSize: 12, fontWeight: 700 }} />
                <Radar dataKey="value" stroke="#1E40AF" fill="#1E40AF" fillOpacity={0.35} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card">
          <h2 className="mb-3 font-black text-slate-800">أفضل الوظائف المناسبة</h2>
          <div className="space-y-3">
            {data.top_jobs.map((job, index) => (
              <div
                key={job.job_title}
                className={`rounded-2xl border-2 p-4 ${index === 0 ? "border-secondary bg-secondary-50" : "border-slate-200"}`}
              >
                <p className="font-black text-slate-800">{job.job_title}</p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full ${index === 0 ? "bg-secondary" : "bg-primary"}`}
                    style={{ width: `${job.match_percentage}%` }}
                  />
                </div>
                <p className="mt-1 text-xs font-bold text-slate-500">نسبة التوافق {Math.round(job.match_percentage)}%</p>
                {job.explanation && <p className="mt-2 text-sm font-semibold text-slate-600">{job.explanation}</p>}
              </div>
            ))}
          </div>
        </section>

        <div className="flex justify-center pb-8">
          <Link to="/register" className="btn-secondary">
            حلّل سيرتك الذاتية مجاناً على Career Compass
          </Link>
        </div>
      </div>
    </div>
  );
}
