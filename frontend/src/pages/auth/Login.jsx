import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  AlertCircle,
  ArrowLeft,
  Target,
  Briefcase,
  Mic,
  FileCheck2,
  ShieldCheck,
} from "lucide-react";

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
      const from = location.state?.from;
      const redirectTo = from?.pathname
        ? `${from.pathname}${from.search || ""}${from.hash || ""}`
        : "/dashboard";
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
    <div className="min-h-screen grid lg:grid-cols-12 bg-[#F7F8FA]">
      {/* Right Side (RTL): Form Panel */}
      <div className="lg:col-span-6 xl:col-span-5 flex flex-col justify-center px-4 py-8 sm:px-10 lg:px-14">
        <div className="w-full max-w-md mx-auto">
          <div className="mb-6 flex items-center justify-between">
            <CompassLogo size={40} />
            <span className="chip text-[11px] text-secondary-700 bg-secondary-50 border-secondary-200">
              الجيل الثاني 2.0
            </span>
          </div>

          <div className="card !p-6 sm:!p-8">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 mb-1.5">
              تسجيل الدخول
            </h1>
            <p className="mb-6 text-xs sm:text-sm font-medium text-slate-500">
              أدخل بيانات حسابك للوصول إلى لوحة الذكاء المهني وتقاريرك
            </p>

            {errorMessage && (
              <div className="alert-banner-error mb-5" role="alert">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
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
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="password"
                    className="text-xs sm:text-sm font-bold text-slate-700"
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
                    className="input-field pl-11"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                    aria-label={
                      showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"
                    }
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary w-full py-3 text-sm sm:text-base mt-2"
                disabled={!canSubmit}
              >
                {isLoading ? (
                  <Spinner />
                ) : (
                  <>
                    <span>تسجيل الدخول</span>
                    <ArrowLeft size={16} />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-100 text-center">
              <p className="text-xs sm:text-sm font-medium text-slate-500">
                ليس لديك حساب بعد؟{" "}
                <Link
                  to="/register"
                  state={location.state}
                  className="font-extrabold text-primary-600 hover:text-primary-700 hover:underline"
                >
                  إنشاء حساب مجاني
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Left Side (RTL): Executive Showcase Panel */}
      <div className="hidden lg:flex lg:col-span-6 xl:col-span-7 bg-slate-900 text-white p-12 xl:p-16 flex-col justify-between border-r border-slate-800">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/90 px-3.5 py-1.5 text-xs font-bold text-secondary-300">
            <span className="h-2 w-2 rounded-full bg-secondary-400" />
            منصة التوجيه المهني بالذكاء الاصطناعي
          </span>
          <h2 className="mt-6 text-3xl xl:text-4xl font-black leading-tight text-white max-w-xl">
            اكتشف بصمتك المهنية، وطابق مهاراتك مع أقوى الفرص الوظيفية
          </h2>
          <p className="mt-3 text-sm xl:text-base font-medium text-slate-300 max-w-xl leading-relaxed">
            تحليل دقيق للسيرة الذاتية وملفات LinkedIn، فحص توافق ATS، خارطة تعلم تفاعلية لمدة 3 أشهر، ومحاكي مقابلات تقنية بالذكاء الاصطناعي.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 my-8">
          <div className="rounded-2xl border border-slate-800 bg-slate-800/50 p-5">
            <div className="w-10 h-10 rounded-xl bg-primary-500/15 border border-primary-500/30 text-primary-300 flex items-center justify-center mb-3">
              <Target size={20} />
            </div>
            <h3 className="font-bold text-white text-sm mb-1">
              تحليل Career DNA
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              تقييم شامل لـ 5 محاور تقنية وسلوكية مع مؤشر جاهزية دقيق.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-800/50 p-5">
            <div className="w-10 h-10 rounded-xl bg-secondary-500/15 border border-secondary-500/30 text-secondary-300 flex items-center justify-center mb-3">
              <Briefcase size={20} />
            </div>
            <h3 className="font-bold text-white text-sm mb-1">
              شواغر حقيقية مباشرة
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              مطابقة فورية لمهاراتك مع أحدث الوظائف المفتوحة ونسب التوافق معها.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-800/50 p-5">
            <div className="w-10 h-10 rounded-xl bg-accent-500/15 border border-accent-500/30 text-accent-300 flex items-center justify-center mb-3">
              <Mic size={20} />
            </div>
            <h3 className="font-bold text-white text-sm mb-1">
              محاكي مقابلات ذكي
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              تدرب على المقابلات التقنية صوتياً أو نصياً واحصل على تقييم مفصل.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-800/50 p-5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 flex items-center justify-center mb-3">
              <FileCheck2 size={20} />
            </div>
            <h3 className="font-bold text-white text-sm mb-1">
              فحص ATS وخطاب تغطية
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              تقييم توافق سيرتك مع أنظمة الفرز الآلي وتوليد Cover Letter مخصص.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs font-medium text-slate-400 border-t border-slate-800 pt-5">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck size={15} className="text-secondary-400" />
            مدعوم بمحركات الذكاء الاصطناعي وتوصيات المهارات القياسية
          </span>
          <span className="font-bold text-slate-200">
            117+ مهارة تقنية • 30+ مسار وظيفي
          </span>
        </div>
      </div>
    </div>
  );
}
