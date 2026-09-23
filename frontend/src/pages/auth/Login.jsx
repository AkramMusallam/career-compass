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
      setErrorMessage(getErrorMessage(error, "البريد الإلكتروني أو كلمة المرور غير صحيحة"));
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
          <h1 className="mb-1 text-xl font-black text-slate-800">تسجيل الدخول</h1>
          <p className="mb-6 text-sm text-slate-500">حدد مسارك المهني في دقائق معدودة</p>

          {errorMessage && (
            <div className="alert-banner-error mb-4" role="alert">
              <span aria-hidden="true">⚠️</span>
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-4">
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
              />
            </div>

            <div className="mb-2">
              <label htmlFor="password" className="label-text">
                كلمة المرور
              </label>
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
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <div className="mb-6 text-left">
              <Link to="/forgot-password" className="text-sm font-semibold text-primary hover:underline">
                نسيت كلمة المرور؟
              </Link>
            </div>

            <button type="submit" className="btn-primary w-full" disabled={!canSubmit}>
              {isLoading ? <Spinner /> : "تسجيل الدخول"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            ليس لديك حساب؟{" "}
            <Link to="/register" className="font-bold text-primary hover:underline">
              إنشاء حساب جديد
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
