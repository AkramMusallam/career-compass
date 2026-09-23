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
  return { label: "قوية", score, color: "bg-secondary" };
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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <CompassLogo size={48} />
        </div>

        <div className="card">
          <h1 className="mb-1 text-xl font-black text-slate-800">إنشاء حساب جديد</h1>
          <p className="mb-6 text-sm text-slate-500">ابدأ رحلتك نحو المسار المهني الأنسب</p>

          {errorMessage && (
            <div className="alert-banner-error mb-4" role="alert">
              <span aria-hidden="true">⚠️</span>
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-4">
              <label htmlFor="fullName" className="label-text">
                الاسم الكامل
              </label>
              <input
                id="fullName"
                type="text"
                required
                disabled={isLoading}
                className="input-field"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onBlur={() => handleBlur("fullName")}
              />
              {touched.fullName && errors.fullName && <p className="error-text">{errors.fullName}</p>}
            </div>

            <div className="mb-4">
              <label htmlFor="email" className="label-text">
                البريد الإلكتروني
              </label>
              <input
                id="email"
                type="email"
                required
                disabled={isLoading}
                className="input-field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => handleBlur("email")}
              />
              {touched.email && errors.email && <p className="error-text">{errors.email}</p>}
            </div>

            <div className="mb-4">
              <label htmlFor="password" className="label-text">
                كلمة المرور
              </label>
              <input
                id="password"
                type="password"
                required
                disabled={isLoading}
                className="input-field"
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

            <div className="mb-4">
              <label htmlFor="confirmPassword" className="label-text">
                تأكيد كلمة المرور
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                disabled={isLoading}
                className="input-field"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={() => handleBlur("confirmPassword")}
              />
              {touched.confirmPassword && errors.confirmPassword && (
                <p className="error-text">{errors.confirmPassword}</p>
              )}
            </div>

            <label className="mb-6 flex items-start gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary-400"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
              />
              <span>أوافق على الشروط والأحكام الخاصة بمنصة Career Compass</span>
            </label>

            <button type="submit" className="btn-primary w-full" disabled={!isValid || isLoading}>
              {isLoading ? <Spinner /> : "إنشاء حساب"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            لديك حساب بالفعل؟{" "}
            <Link to="/login" className="font-bold text-primary hover:underline">
              تسجيل الدخول
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
