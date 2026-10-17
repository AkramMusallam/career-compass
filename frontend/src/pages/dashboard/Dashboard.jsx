import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getHistory, getProfile } from "../../api/endpoints";
import { useAuth } from "../../context/AuthContext";

function getReadinessLabel(score) {
  if (!score || score <= 0) return { text: "بانتظار أول تحليل", color: "text-slate-500", bg: "bg-slate-100" };
  if (score >= 75) return { text: "جاهزية احترافية عالية", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" };
  if (score >= 50) return { text: "جاهزية متوسطة واعدة", color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200" };
  return { text: "مرحلة التأسيس والتطوير", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" };
}

export default function Dashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [recentAnalyses, setRecentAnalyses] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.allSettled([
      getProfile(),
      getHistory({ sort: "newest", page: 1, limit: 3 }),
    ]).then(([profRes, histRes]) => {
      if (!mounted) return;
      if (profRes.status === "fulfilled") {
        setProfile(profRes.value.data);
      }
      if (histRes.status === "fulfilled") {
        setRecentAnalyses(histRes.value.data?.analyses || []);
      }
      setLoadingStats(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const displayName =
    profile?.full_name || user?.full_name || user?.email?.split("@")[0] || "بك";
  const totalAnalyses = profile?.total_analyses ?? recentAnalyses.length ?? 0;
  const highestScore = Math.round(profile?.highest_career_score ?? 0);
  const latestTopJob = recentAnalyses[0]?.top_job_title || "ابدأ تحليلك الأول";
  const readiness = getReadinessLabel(highestScore);

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Executive Hero Banner */}
      <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-8 sm:p-12 shadow-2xl border border-slate-800/80">
        <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-indigo-600/30 blur-[100px]" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-emerald-500/20 blur-[100px]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.9) 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3.5 py-1.5 text-xs font-bold text-indigo-300 backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>مُحرك الذكاء الاصطناعي المهني نشط الآن</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4 tracking-tight leading-tight">
              أهلاً بعودتك،{" "}
              <span className="bg-gradient-to-l from-indigo-300 via-violet-200 to-emerald-300 bg-clip-text text-transparent">
                {displayName}
              </span>{" "}
              👋
            </h1>

            <p className="text-base sm:text-lg text-slate-300 font-medium leading-relaxed">
              منصتك الذكية لتحليل السيرة الذاتية، قياس توافق ATS، استكشاف بصمتك المهنية{" "}
              <span className="text-white font-bold">Career DNA</span>، ومحاكاة المقابلات التقنية الحية.
            </p>

            <div className="mt-8 flex flex-wrap gap-3.5">
              <Link
                to="/analysis/upload"
                className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-l from-indigo-500 via-indigo-600 to-violet-600 px-7 py-4 text-sm sm:text-base font-black text-white shadow-xl shadow-indigo-500/25 transition-all hover:-translate-y-0.5 hover:shadow-indigo-500/40"
              >
                <span>✨</span>
                <span>بدء تحليل سيرة ذاتية جديد</span>
              </Link>
              <Link
                to="/history"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/10 backdrop-blur-md px-6 py-4 text-sm sm:text-base font-bold text-white border border-white/15 transition-all hover:bg-white/15"
              >
                <span>📂</span>
                <span>سجل التحليلات والمقارنة</span>
              </Link>
            </div>
          </div>

          {/* Right Highlight Card inside Hero */}
          <div className="lg:w-72 shrink-0 rounded-3xl border border-white/15 bg-white/5 p-6 backdrop-blur-xl text-center">
            <p className="text-xs font-bold text-slate-400 mb-2">أعلى مؤشر جاهزية مسجّل</p>
            <div className="my-2 flex items-baseline justify-center gap-1">
              <span className="text-5xl font-black text-white tracking-tight">
                {loadingStats ? "—" : highestScore}
              </span>
              <span className="text-sm font-bold text-slate-400">/ 100</span>
            </div>
            <span className="mt-2 inline-block rounded-full bg-emerald-500/15 border border-emerald-400/30 px-3 py-1 text-xs font-bold text-emerald-300">
              {readiness.text}
            </span>
            <p className="mt-4 pt-4 border-t border-white/10 text-[11px] text-slate-400 font-medium">
              إجمالي الجلسات التحليلية:{" "}
              <b className="text-white">{loadingStats ? "..." : totalAnalyses}</b>
            </p>
          </div>
        </div>
      </div>

      {/* Live Bento KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card !p-5 flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 text-2xl border border-indigo-100">
            📊
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400">إجمالي التحليلات</p>
            <p className="text-2xl font-black text-slate-900">
              {loadingStats ? "..." : totalAnalyses}
            </p>
          </div>
        </div>

        <div className="card !p-5 flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 text-2xl border border-emerald-100">
            🏆
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400">أعلى Career Score</p>
            <p className="text-2xl font-black text-emerald-600">
              {loadingStats ? "..." : `${highestScore}%`}
            </p>
          </div>
        </div>

        <div className="card !p-5 flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 text-2xl border border-violet-100">
            🧭
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-400">أحدث مسار موصى به</p>
            <p className="text-sm font-black text-slate-800 truncate" title={latestTopJob}>
              {loadingStats ? "..." : latestTopJob}
            </p>
          </div>
        </div>

        <div className="card !p-5 flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 text-2xl border border-amber-100">
            ⚡
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400">حالة الملف المهني</p>
            <p className="text-xs font-black text-slate-800 mt-0.5">{readiness.text}</p>
          </div>
        </div>
      </div>

      {/* Recent Analyses Section (if available) */}
      {recentAnalyses.length > 0 && (
        <section className="card">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-900">أحدث تقاريرك المهنية</h2>
              <p className="text-xs font-medium text-slate-500">
                انتقل سريعاً إلى آخر التحليلات أو تابع تقدمك في خطة التعلم
              </p>
            </div>
            <Link
              to="/history"
              className="text-xs font-extrabold text-primary-600 hover:text-primary-800 flex items-center gap-1"
            >
              <span>عرض السجل الكامل</span>
              <span>←</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recentAnalyses.map((item) => (
              <Link
                key={item.analysis_id}
                to={`/results/${item.analysis_id}`}
                className="group flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 transition-all hover:-translate-y-0.5 hover:border-primary-300 hover:bg-white hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 block mb-0.5">
                      المسار الوظيفي الأنسب
                    </span>
                    <h3 className="font-black text-slate-800 group-hover:text-primary-600 transition-colors">
                      {item.top_job_title}
                    </h3>
                  </div>
                  <span className="rounded-xl bg-primary-50 border border-primary-200 px-2.5 py-1 text-sm font-black text-primary-700">
                    {Math.round(item.career_score)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-200/60 text-xs text-slate-400 font-semibold">
                  <span>{new Date(item.date).toLocaleDateString("ar-EG")}</span>
                  <span className="text-primary-600 font-bold group-hover:translate-x-[-2px] transition-transform">
                    فتح التقرير ←
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* AI Capabilities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card group hover:border-indigo-200 transition-all hover:-translate-y-1">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25 flex items-center justify-center text-2xl mb-5 group-hover:scale-110 transition-transform">
            🎯
          </div>
          <h3 className="text-lg font-black text-slate-900 mb-2">
            تحليل عميق وبصمة Career DNA
          </h3>
          <p className="text-sm text-slate-600 font-medium leading-relaxed">
            نحلل مهاراتك وخبراتك ومشاريعك لنرسم بصمتك المهنية ونطابقها مع أفضل 5 مسارات وظيفية وشواغر حقيقية في السوق.
          </p>
        </div>

        <div className="card group hover:border-emerald-200 transition-all hover:-translate-y-1">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 flex items-center justify-center text-2xl mb-5 group-hover:scale-110 transition-transform">
            📈
          </div>
          <h3 className="text-lg font-black text-slate-900 mb-2">
            فجوة المهارات وخارطة 90 يوماً
          </h3>
          <p className="text-sm text-slate-600 font-medium leading-relaxed">
            نحدد المهارات الحرجة الناقصة ونبني لك خطة تعلم تفاعلية لمدة 3 أشهر مع إمكانية تتبع إنجازك خطوة بخطوة.
          </p>
        </div>

        <div className="card group hover:border-amber-200 transition-all hover:-translate-y-1">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/25 flex items-center justify-center text-2xl mb-5 group-hover:scale-110 transition-transform">
            🎙️
          </div>
          <h3 className="text-lg font-black text-slate-900 mb-2">
            محاكي المقابلات التقنية الذكي
          </h3>
          <p className="text-sm text-slate-600 font-medium leading-relaxed">
            تدرب على مقابلات العمل لأي وظيفة مرشحة لك مع مُحاور ذكي يقيّم إجاباتك التقنية ومهارات التواصل ويقدم إجابات نموذجية.
          </p>
        </div>
      </div>
    </div>
  );
}