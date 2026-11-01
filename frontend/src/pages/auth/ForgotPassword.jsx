import { useState } from "react";
import { Link } from "react-router-dom";
import { KeyRound, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";

import CompassLogo from "../../components/layout/CompassLogo";
import { requestPasswordReset } from "../../api/endpoints";
import { getErrorMessage } from "../../api/client";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");
    try {
      await requestPasswordReset({ email });
      setStatus("success");
      setMessage(
        "إذا كان البريد الإلكتروني مسجلاً لدينا، فستتلقى رابطاً لإعادة تعيين كلمة المرور خلال دقائق."
      );
    } catch (error) {
      setStatus("error");
      setMessage(
        getErrorMessage(
          error,
          "حدث خطأ أثناء طلب استعادة كلمة المرور. حاول مرة أخرى."
        )
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F8FA] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Link to="/login">
            <CompassLogo size={42} />
          </Link>
        </div>

        <div className="card !p-6 sm:!p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600 border border-primary-100">
              <KeyRound size={22} />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">
              استعادة كلمة المرور
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm font-medium text-slate-500">
              أدخل بريدك الإلكتروني وسنرسل لك رابطاً آمناً لإعادة تعيين كلمة المرور
            </p>
          </div>

          {status === "success" ? (
            <div className="space-y-4 text-center">
              <div className="alert-banner-success text-start">
                <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                <span>{message}</span>
              </div>
              <Link to="/login" className="btn-primary w-full">
                العودة لتسجيل الدخول
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-start">
              {status === "error" && (
                <div className="alert-banner-error">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <span>{message}</span>
                </div>
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
                className="btn-primary w-full py-3"
                disabled={status === "loading" || !email}
              >
                {status === "loading" ? "جاري الإرسال..." : "إرسال رابط الاستعادة"}
              </button>

              <div className="pt-2 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-600 hover:text-primary-600"
                >
                  <ArrowRight size={15} />
                  <span>العودة لتسجيل الدخول</span>
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
