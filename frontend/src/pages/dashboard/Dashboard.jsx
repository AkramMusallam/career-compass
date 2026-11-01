import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  FolderClock,
  BarChart3,
  Trophy,
  Compass,
  Activity,
  ArrowLeft,
  Target,
  TrendingUp,
  Mic,
} from "lucide-react";
import { getHistory, getProfile } from "../../api/endpoints";
import { useAuth } from "../../context/AuthContext";

function getReadinessLabel(score) {
  if (!score || score <= 0)
    return {
      text: "بانتظار أول تحليل",
      color: "text-slate-600",
      bg: "bg-slate-100 border-slate-200",
    };
  if (score >= 75)
    return {
      text: "جاهزية احترافية عالية",
      color: "text-secondary-700",
      bg: "bg-secondary-50 border-secondary-200",
    };
  if (score >= 50)
    return {
      text: "جاهزية متوسطة واعدة",
      color: "text-primary-700",
      bg: "bg-primary-50 border-primary-200",
    };
  return {
    text: "مرحلة التأسيس والتطوير",
    color: "text-accent-700",
    bg: "bg-accent-50 border-accent-200",
  };
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
    <div className="space-y-6 animate-fade-in">
      {/* Executive Hero Banner */}
      <div className="rounded-2xl bg-slate-900 text-white p-5 sm:p-8 lg:p-10 shadow-card border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/90 px-3 py-1 text-[11px] font-bold text-secondary-300">
              <span className="h-2 w-2 rounded-full bg-secondary-400" />
              <span>محرك الذكاء الاصطناعي المهني نشط الآن</span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white mb-2.5 tracking-tight leading-snug">
              مرحباً بعودتك،{" "}
              <span className="text-secondary-400">{displayName}</span>
            </h1>

            <p className="text-xs sm:text-sm lg:text-base text-slate-300 font-medium leading-relaxed">
              منصتك الذكية لتحليل السيرة الذاتية، قياس توافق ATS، استكشاف بصمتك المهنية{" "}
              <span className="text-white font-bold">Career DNA</span>، ومحاكاة المقابلات التقنية الحية.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Link
                to="/analysis/upload"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-xs sm:text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-500"
              >
                <Sparkles size={16} />
                <span>بدء تحليل سيرة ذاتية جديد</span>
              </Link>
              <Link
                to="/history"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-5 py-3 text-xs sm:text-sm font-bold text-slate-200 transition-colors hover:bg-slate-700"
              >
                <FolderClock size={16} />
                <span>سجل التحليلات والمقارنة</span>
              </Link>
            </div>
          </div>

          {/* Right Highlight Card inside Hero */}
          <div className="lg:w-64 shrink-0 rounded-2xl border border-slate-800 bg-slate-800/70 p-5 text-center">
            <p className="text-xs font-bold text-slate-400 mb-1">أعلى مؤشر جاهزية مسجّل</p>
            <div className="my-2 flex items-baseline justify-center gap-1">
              <span className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                {loadingStats ? "—" : highestScore}
              </span>
              <span className="text-xs font-bold text-slate-400">/ 100</span>
            </div>
            <span className="mt-1 inline-block rounded-lg bg-secondary-500/15 border border-secondary-500/30 px-2.5 py-1 text-[11px] font-bold text-secondary-300">
              {readiness.text}
            </span>
            <p className="mt-3 pt-3 border-t border-slate-700/80 text-[11px] text-slate-400 font-medium">
              إجمالي الجلسات التحليلية:{" "}
              <b className="text-white">{loadingStats ? "..." : totalAnalyses}</b>
            </p>
          </div>
        </div>
      </div>

      {/* KPI Row - Multi-tone Harmonious Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="card !p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 border border-primary-100">
            <BarChart3 size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-500">إجمالي التحليلات</p>
            <p className="text-lg sm:text-xl font-black text-slate-900">
              {loadingStats ? "..." : totalAnalyses}
            </p>
          </div>
        </div>

        <div className="card !p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-secondary-50 text-secondary-600 border border-secondary-100">
            <Trophy size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-500">أعلى Career Score</p>
            <p className="text-lg sm:text-xl font-black text-secondary-700">
              {loadingStats ? "..." : `${highestScore}%`}
            </p>
          </div>
        </div>

        <div className="card !p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
            <Compass size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-500">أحدث مسار موصى به</p>
            <p className="text-xs sm:text-sm font-black text-slate-800 truncate" title={latestTopJob}>
              {loadingStats ? "..." : latestTopJob}
            </p>
          </div>
        </div>

        <div className="card !p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600 border border-accent-100">
            <Activity size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-500">حالة الملف المهني</p>
            <p className="text-xs font-extrabold text-slate-800 truncate mt-0.5">{readiness.text}</p>
          </div>
        </div>
      </div>

      {/* Recent Analyses Section */}
      {recentAnalyses.length > 0 && (
        <section className="card">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900">أحدث تقاريرك المهنية</h2>
              <p className="text-xs font-medium text-slate-500">
                انتقل سريعاً إلى آخر التحليلات أو تابع تقدمك في خطة التعلم
              </p>
            </div>
            <Link
              to="/history"
              className="inline-flex items-center gap-1 text-xs font-extrabold text-primary-600 hover:text-primary-800 shrink-0"
            >
              <span>عرض السجل</span>
              <ArrowLeft size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {recentAnalyses.map((item) => (
              <Link
                key={item.analysis_id}
                to={`/results/${item.analysis_id}`}
                className="group flex flex-col justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 transition-colors hover:border-primary-300 hover:bg-white"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-slate-400 block mb-0.5">
                      المسار الوظيفي الأنسب
                    </span>
                    <h3 className="font-bold text-sm sm:text-base text-slate-900 group-hover:text-primary-600 transition-colors truncate">
                      {item.top_job_title}
                    </h3>
                  </div>
                  <span className="shrink-0 rounded-lg bg-primary-50 border border-primary-200 px-2.5 py-1 text-xs font-black text-primary-700">
                    {Math.round(item.career_score)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-200/60 text-xs text-slate-500 font-medium">
                  <span>{new Date(item.date).toLocaleDateString("ar-EG")}</span>
                  <span className="inline-flex items-center gap-1 text-primary-600 font-bold">
                    <span>فتح التقرير</span>
                    <ArrowLeft size={13} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* AI Capabilities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card hover:border-primary-200">
          <div className="w-11 h-11 rounded-xl bg-primary-50 text-primary-600 border border-primary-100 flex items-center justify-center mb-4">
            <Target size={22} />
          </div>
          <h3 className="text-base font-black text-slate-900 mb-1.5">
            تحليل عميق وبصمة Career DNA
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
            نحلل مهاراتك وخبراتك ومشاريعك لنرسم بصمتك المهنية ونطابقها مع أفضل 5 مسارات وظيفية وشواغر حقيقية في السوق.
          </p>
        </div>

        <div className="card hover:border-secondary-200">
          <div className="w-11 h-11 rounded-xl bg-secondary-50 text-secondary-600 border border-secondary-100 flex items-center justify-center mb-4">
            <TrendingUp size={22} />
          </div>
          <h3 className="text-base font-black text-slate-900 mb-1.5">
            فجوة المهارات وخارطة 90 يوماً
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
            نحدد المهارات الحرجة الناقصة ونبني لك خطة تعلم تفاعلية لمدة 3 أشهر مع إمكانية تتبع إنجازك خطوة بخطوة.
          </p>
        </div>

        <div className="card hover:border-accent-200">
          <div className="w-11 h-11 rounded-xl bg-accent-50 text-accent-600 border border-accent-100 flex items-center justify-center mb-4">
            <Mic size={22} />
          </div>
          <h3 className="text-base font-black text-slate-900 mb-1.5">
            محاكي المقابلات التقنية الذكي
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
            تدرب على مقابلات العمل لأي وظيفة مرشحة لك مع مُحاور ذكي يقيّم إجاباتك التقنية ومهارات التواصل ويقدم إجابات نموذجية.
          </p>
        </div>
      </div>
    </div>
  );
}
