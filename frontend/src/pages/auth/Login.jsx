import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { getErrorMessage } from "../../api/client";
import CompassLogo from "../../components/layout/CompassLogo";
import Spinner from "../../components/ui/Spinner";
import { useAuth } from "../../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const canSubmit = emailValid && password.length > 0 && !isLoading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setIsLoading(true);
    setErrorMessage("");
    try {
      await login(email, password);
      const redirectTo = location.state?.from?.pathname || "/dashboard";
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, "البريد الإلكتروني أو كلمة المرور غير صحيحة")
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-12">
      {/* Right Side (RTL): Form Panel */}
      <div className="lg:col-span-6 xl:col-span-5 flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-14 relative">
        <div className="w-full max-w-md mx-auto">
          <div className="mb-8 flex items-center justify-between">
            <CompassLogo size={46} />
            <span className="chip !text-[11px]">الجيل الجديد 2.0 ✨</span>
          </div>

          <div className="card !p-8 sm:!p-10">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2">
              أهلاً بعودتك 👋
            </h1>
            <p className="mb-7 text-sm font-medium text-slate-500">
              سجّل دخولك للوصول إلى لوحة الذكاء المهني وتحليلات سيرتك الذاتية
            </p>

            {errorMessage && (
              <div className="alert-banner-error mb-6" role="alert">
                <span aria-hidden="true">⚠️</span>
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <div>
                <label htmlFor="email" className="label-text">
                  البريد الإلكتروني
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  disabled={isLoading}
                  className="input-field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  dir="ltr"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="password"
                    className="text-sm font-bold text-slate-700"
                  >
                    كلمة المرور
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-bold text-primary-600 hover:text-primary-700 hover:underline"
                  >
                    نسيت كلمة المرور؟
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    disabled={isLoading}
                    className="input-field pl-12"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                    aria-label={
                      showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"
                    }
                  >
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary w-full py-3.5 text-base"
                disabled={!canSubmit}
              >
                {isLoading ? <Spinner /> : "تسجيل الدخول ←"}
              </button>
            </form>

            <div className="mt-7 pt-6 border-t border-slate-100 text-center">
              <p className="text-sm font-medium text-slate-500">
                ليس لديك حساب بعد؟{" "}
                <Link
                  to="/register"
                  className="font-black text-primary-600 hover:text-primary-700 hover:underline"
                >
                  إنشاء حساب مجاني
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Left Side (RTL): Luminous Pastel & Indigo Aurora Showcase Panel */}
      <div className="hidden lg:flex lg:col-span-6 xl:col-span-7 relative overflow-hidden bg-gradient-to-br from-indigo-50 via-violet-50/70 to-emerald-50/80 border-r border-indigo-100/80 p-12 xl:p-16 flex-col justify-between">
        {/* Soft Aurora Orbs */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-indigo-400/20 blur-[100px]" />
        <div className="pointer-events-none absolute top-1/3 right-0 h-96 w-96 rounded-full bg-violet-400/15 blur-[110px]" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-80 w-80 rounded-full bg-emerald-400/20 blur-[100px]" />

        <div className="relative z-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200/80 bg-white/80 backdrop-blur-md px-4 py-1.5 text-xs font-extrabold text-indigo-700 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            منصة التوجيه المهني الذكي بالذكاء الاصطناعي
          </span>
          <h2 className="mt-6 text-4xl xl:text-5xl font-black leading-tight text-slate-900 max-w-2xl">
            اكتشف بصمتك المهنية، وطابق مهاراتك مع{" "}
            <span className="text-gradient">أقوى الفرص الوظيفية</span>
          </h2>
          <p className="mt-4 text-base font-medium text-slate-600 max-w-xl leading-relaxed">
            تحليل فوري للسيرة الذاتية وملفات LinkedIn، فحص توافق ATS، خارطة تعلم تفاعلية لمدة 3 أشهر، ومحاكي مقابلات تقنية بالذكاء الاصطناعي.
          </p>
        </div>

        {/* Floating Feature Bento Grid */}
        <div className="relative z-10 grid grid-cols-2 gap-4 my-8">
          <div className="rounded-3xl border border-white/90 bg-white/75 backdrop-blur-xl p-5 shadow-md shadow-indigo-500/5 hover:bg-white transition">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-xl mb-3">
              🧬
            </div>
            <h3 className="font-black text-slate-900 text-base mb-1">
              تحليل Career DNA
            </h3>
            <p className="text-xs font-medium text-slate-500 leading-relaxed">
              تقييم شامل لـ 5 محاور تقنية وسلوكية مع مؤشر Career Score دقيق.
            </p>
          </div>
          <div className="rounded-3xl border border-white/90 bg-white/75 backdrop-blur-xl p-5 shadow-md shadow-indigo-500/5 hover:bg-white transition">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-xl mb-3">
              💼
            </div>
            <h3 className="font-black text-slate-900 text-base mb-1">
              شواغر حقيقية مباشرة
            </h3>
            <p className="text-xs font-medium text-slate-500 leading-relaxed">
              مطابقة فورية لمهاراتك مع أحدث الوظائف المفتوحة ونسب التوافق معها.
            </p>
          </div>
          <div className="rounded-3xl border border-white/90 bg-white/75 backdrop-blur-xl p-5 shadow-md shadow-indigo-500/5 hover:bg-white transition">
            <div className="w-11 h-11 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center text-xl mb-3">
              🎙️
            </div>
            <h3 className="font-black text-slate-900 text-base mb-1">
              محاكي مقابلات ذكي
            </h3>
            <p className="text-xs font-medium text-slate-500 leading-relaxed">
              تدرب على المقابلات التقنية واحصل على تقييم مفصل وإجابات نموذجية.
            </p>
          </div>
          <div className="rounded-3xl border border-white/90 bg-white/75 backdrop-blur-xl p-5 shadow-md shadow-indigo-500/5 hover:bg-white transition">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-xl mb-3">
              📝
            </div>
            <h3 className="font-black text-slate-900 text-base mb-1">
              فحص ATS وخطاب تغطية
            </h3>
            <p className="text-xs font-medium text-slate-500 leading-relaxed">
              تقييم توافق سيرتك مع أنظمة الفرز الآلي وتوليد Cover Letter مخصص بضغطة زر.
            </p>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs font-semibold text-slate-500 border-t border-indigo-200/60 pt-6">
          <span>مدعوم بمحركات الذكاء الاصطناعي وتوصيات المهارات القياسية</span>
          <span className="font-black text-indigo-700">
            117+ مهارة تقنية • 30+ مسار وظيفي
          </span>
        </div>
      </div>
    </div>
  );
}
