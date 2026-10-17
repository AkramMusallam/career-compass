import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { getErrorMessage } from "../../api/client";
import CompassLogo from "../../components/layout/CompassLogo";
import Spinner from "../../components/ui/Spinner";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

function getPasswordStrength(password) {
  if (!password) return { label: "", score: 0 };
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 1) return { label: "ضعيفة", score, color: "bg-danger" };
  if (score <= 2) return { label: "متوسطة", score, color: "bg-warning" };
  return { label: "قوية", score, color: "bg-emerald-500" };
}

export default function Register() {
  const { register, login } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [touched, setTouched] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const strength = getPasswordStrength(password);

  const errors = {
    fullName: fullName.trim().length < 2 ? "الاسم يجب أن يحتوي على حرفين على الأقل" : "",
    email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "صيغة البريد الإلكتروني غير صحيحة" : "",
    password:
      password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)
        ? "8 أحرف على الأقل، تحتوي حرفاً كبيراً وصغيراً ورقماً"
        : "",
    confirmPassword: confirmPassword !== password ? "كلمتا المرور غير متطابقتين" : "",
  };

  const isValid = Object.values(errors).every((e) => !e) && agreedToTerms;

  const handleBlur = (field) => setTouched((prev) => ({ ...prev, [field]: true }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ fullName: true, email: true, password: true, confirmPassword: true });
    if (!isValid) return;

    setIsLoading(true);
    setErrorMessage("");
    try {
      await register(fullName, email, password);
      await login(email, password);
      showToast("تم إنشاء الحساب بنجاح، مرحباً بك!");
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "تعذر إنشاء الحساب، حاول مرة أخرى"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-12 bg-[#F8FAFC]">
      {/* Right Side (RTL): Registration Form */}
      <div className="lg:col-span-6 xl:col-span-5 flex flex-col justify-center px-6 py-10 sm:px-12 lg:px-14">
        <div className="w-full max-w-md mx-auto">
          <div className="mb-6 flex items-center justify-between">
            <CompassLogo size={44} />
            <span className="chip !text-[11px]">حساب مجاني 🚀</span>
          </div>

          <div className="card !p-7 sm:!p-9">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mb-1.5">إنشاء حساب جديد</h1>
            <p className="mb-6 text-sm font-medium text-slate-500">
              ابدأ رحلتك نحو المسار المهني الأنسب خلال دقائق معدودة
            </p>

            {errorMessage && (
              <div className="alert-banner-error mb-5" role="alert">
                <span aria-hidden="true">⚠️</span>
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div>
                <label htmlFor="fullName" className="label-text">
                  الاسم الكامل
                </label>
                <input
                  id="fullName"
                  type="text"
                  required
                  disabled={isLoading}
                  className="input-field"
                  placeholder="مثال: أحمد محمد"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  onBlur={() => handleBlur("fullName")}
                />
                {touched.fullName && errors.fullName && <p className="error-text">{errors.fullName}</p>}
              </div>

              <div>
                <label htmlFor="email" className="label-text">
                  البريد الإلكتروني
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  disabled={isLoading}
                  className="input-field"
                  placeholder="you@example.com"
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => handleBlur("email")}
                />
                {touched.email && errors.email && <p className="error-text">{errors.email}</p>}
              </div>

              <div>
                <label htmlFor="password" className="label-text">
                  كلمة المرور
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  disabled={isLoading}
                  className="input-field"
                  placeholder="••••••••"
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => handleBlur("password")}
                />
                {password && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full transition-all ${strength.color}`}
                        style={{ width: `${(strength.score / 4) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-slate-500">{strength.label}</span>
                  </div>
                )}
                {touched.password && errors.password && <p className="error-text">{errors.password}</p>}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="label-text">
                  تأكيد كلمة المرور
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  disabled={isLoading}
                  className="input-field"
                  placeholder="••••••••"
                  dir="ltr"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onBlur={() => handleBlur("confirmPassword")}
                />
                {touched.confirmPassword && errors.confirmPassword && (
                  <p className="error-text">{errors.confirmPassword}</p>
                )}
              </div>

              <label className="flex items-start gap-2.5 pt-1 text-xs sm:text-sm font-medium text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary-400"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                />
                <span>أوافق على الشروط والأحكام وسياسة الخصوصية الخاصة بمنصة Career Compass</span>
              </label>

              <button type="submit" className="btn-primary w-full py-3.5 text-base" disabled={!isValid || isLoading}>
                {isLoading ? <Spinner /> : "إنشاء حساب والبدء الآن ←"}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-100 text-center">
              <p className="text-sm font-medium text-slate-500">
                لديك حساب بالفعل؟{" "}
                <Link to="/login" className="font-black text-primary-600 hover:text-primary-700 hover:underline">
                  تسجيل الدخول
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Left Side (RTL): Luxury Dark Showcase Panel */}
      <div className="hidden lg:flex lg:col-span-6 xl:col-span-7 relative overflow-hidden bg-slate-950 p-12 xl:p-16 flex-col justify-between text-white">
        <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-primary-600/35 blur-[110px]" />
        <div className="pointer-events-none absolute top-1/3 right-0 h-96 w-96 rounded-full bg-secondary-600/30 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-80 w-80 rounded-full bg-emerald-500/20 blur-[110px]" />

        <div className="relative z-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 backdrop-blur-md px-4 py-1.5 text-xs font-bold text-emerald-300">
            ✨ خطوتك الأولى نحو مستقبل مهني أقوى
          </span>
          <h2 className="mt-6 text-4xl xl:text-5xl font-black leading-tight text-white max-w-2xl">
            انتقل من التشتت المهني إلى{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-emerald-300 bg-clip-text text-transparent">
              خارطة طريق واضحة
            </span>
          </h2>
          <p className="mt-4 text-base text-slate-300/90 max-w-xl leading-relaxed">
            في 3 خطوات فقط: ارفع سيرتك الذاتية أو أدخل مهاراتك يدوياً، أجب عن أسئلة التقييم الذكية، واحصل على تقرير شامل مع فرص عمل حقيقية.
          </p>
        </div>

        <div className="relative z-10 space-y-4 my-8 max-w-xl">
          {[
            { step: "01", title: "استخراج ذكي وتقييم ATS", desc: "قراءة فورية لملفات PDF وLinkedIn بالعربية والإنجليزية مع قياس توافق ATS." },
            { step: "02", title: "تحليل البصمة المهنية وفجوة المهارات", desc: "تحديد أفضل 5 مسارات وظيفية مناسبة لك وتصنيف المهارات الناقصة حسب الأولوية." },
            { step: "03", title: "خارطة تعلم + مقابلات تجريبية بالذكاء الاصطناعي", desc: "خطة عملية لمدة 3 أشهر مع كورسات مقترحة ومحاكي مقابلات تفاعلي." },
          ].map((item) => (
            <div
              key={item.step}
              className="flex items-start gap-4 rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-5"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-secondary-600 text-xs font-black text-white shadow-md">
                {item.step}
              </span>
              <div>
                <h3 className="font-black text-white text-base">{item.title}</h3>
                <p className="mt-1 text-xs text-slate-300/80 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 border-t border-white/10 pt-6">
          <span>حماية كاملة للبيانات وخصوصية تامة</span>
          <span className="font-bold text-emerald-400">✓ مجاني بالكامل</span>
        </div>
      </div>
    </div>
  );
}
