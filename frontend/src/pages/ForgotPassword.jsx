import { useState } from "react";
import { Link } from "react-router-dom";

import CompassLogo from "../components/CompassLogo";
import { requestPasswordReset } from "../api/endpoints";
import { getErrorMessage } from "../api/client";

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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mb-8 flex justify-center">
          <CompassLogo size={48} />
        </div>
        <div className="card">
          <h1 className="mb-2 text-xl font-black text-slate-800">استعادة كلمة المرور</h1>
          
          {status === "success" ? (
            <div className="mb-6">
              <div className="alert-banner-success mb-4 text-start">{message}</div>
              <Link to="/login" className="btn-primary inline-flex mt-2">
                العودة لتسجيل الدخول
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="text-start">
              <p className="mb-6 text-sm text-slate-500 text-center">
                أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور.
              </p>
              
              {status === "error" && (
                <div className="alert-banner-error mb-4">{message}</div>
              )}

              <div className="mb-6">
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
                className="btn-primary w-full mb-4"
                disabled={status === "loading" || !email}
              >
                {status === "loading" ? "جاري الإرسال..." : "إرسال رابط الاستعادة"}
              </button>

              <div className="text-center">
                <Link to="/login" className="text-sm font-semibold text-primary hover:underline">
                  العودة لتسجيل الدخول
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
