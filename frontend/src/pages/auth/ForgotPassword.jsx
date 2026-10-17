import { useState } from "react";
import { Link } from "react-router-dom";

import CompassLogo from "../../components/layout/CompassLogo";
import { requestPasswordReset } from "../../api/endpoints";
import { getErrorMessage } from "../../api/client";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle, loading, success, error
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");
    try {
      await requestPasswordReset({ email });
      setStatus("success");
      setMessage("إذا كان البريد الإلكتروني مسجلاً لدينا، فستتلقى رابطاً لإعادة تعيين كلمة المرور خلال دقائق.");
    } catch (error) {
      setStatus("error");
      setMessage(getErrorMessage(error, "حدث خطأ أثناء طلب استعادة كلمة المرور. حاول مرة أخرى."));
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute -top-24 right-1/4 h-80 w-80 rounded-full bg-indigo-500/10 blur-[100px]" />
      <div className="pointer-events-none absolute bottom-10 left-1/4 h-80 w-80 rounded-full bg-emerald-500/10 blur-[100px]" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Link to="/login">
            <CompassLogo size={46} />
          </Link>
        </div>

        <div className="card p-8 sm:p-10">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-2xl border border-primary-100">
              🔐
            </div>
            <h1 className="text-2xl font-black text-slate-900">استعادة كلمة المرور</h1>
            <p className="mt-1.5 text-sm font-medium text-slate-500">
              أدخل بريدك الإلكتروني وسنرسل لك رابطاً آمناً لإعادة تعيين كلمة المرور
            </p>
          </div>

          {status === "success" ? (
            <div className="space-y-5 text-center">
              <div className="alert-banner-success text-start">{message}</div>
              <Link to="/login" className="btn-primary w-full">
                العودة لتسجيل الدخول
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5 text-start">
              {status === "error" && (
                <div className="alert-banner-error">{message}</div>
              )}

              <div>
                <label htmlFor="email" className="label-text">
                  البريد الإلكتروني
                </label>
                <input
                  id="email"
                  type="email"
                  className="input-field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  dir="ltr"
                  placeholder="name@example.com"
                />
              </div>

              <button
                type="submit"
                className="btn-primary w-full py-3.5"
                disabled={status === "loading" || !email}
              >
                {status === "loading" ? "جاري الإرسال..." : "إرسال رابط الاستعادة"}
              </button>

              <div className="pt-2 text-center">
                <Link
                  to="/login"
                  className="text-sm font-extrabold text-primary-600 hover:text-primary-800 hover:underline"
                >
                  ← العودة لتسجيل الدخول
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
