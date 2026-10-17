import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";

import CompassLogo from "../../components/layout/CompassLogo";
import { resetPassword } from "../../api/endpoints";
import { getErrorMessage } from "../../api/client";
import { useToast } from "../../context/ToastContext";

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  const passwordValid =
    newPassword.length >= 8 && /\d/.test(newPassword) && /[a-zA-Z]/.test(newPassword);
  const passwordsMatch =
    newPassword === confirmPassword && confirmPassword.length > 0;
  const canSubmit = passwordValid && passwordsMatch && status !== "loading";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setStatus("loading");
    try {
      await resetPassword({ token, new_password: newPassword });
      setStatus("success");
      showToast("تم إعادة تعيين كلمة المرور بنجاح");
      navigate("/login");
    } catch (error) {
      setStatus("error");
      setMessage(
        getErrorMessage(error, "رابط الاستعادة غير صالح أو منتهي الصلاحية.")
      );
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
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-2xl border border-emerald-100">
              🔑
            </div>
            <h1 className="text-2xl font-black text-slate-900">تعيين كلمة مرور جديدة</h1>
            <p className="mt-1.5 text-sm font-medium text-slate-500">
              اختر كلمة مرور قوية لتأمين حسابك المهني
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-start">
            {status === "error" && (
              <div className="alert-banner-error">{message}</div>
            )}

            <div>
              <label htmlFor="newPassword" className="label-text">
                كلمة المرور الجديدة
              </label>
              <input
                id="newPassword"
                type="password"
                className="input-field"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                dir="ltr"
                placeholder="••••••••"
              />
              {newPassword && !passwordValid && (
                <p className="error-text">
                  يجب أن تكون 8 أحرف على الأقل وتحتوي على رقم وحرف
                </p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="label-text">
                تأكيد كلمة المرور
              </label>
              <input
                id="confirmPassword"
                type="password"
                className="input-field"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                dir="ltr"
                placeholder="••••••••"
              />
              {confirmPassword && !passwordsMatch && (
                <p className="error-text">كلمتا المرور غير متطابقتين</p>
              )}
            </div>

            <button
              type="submit"
              className="btn-primary w-full py-3.5 mt-2"
              disabled={!canSubmit}
            >
              {status === "loading" ? "جاري التحديث..." : "حفظ وتعيين كلمة المرور"}
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
        </div>
      </div>
    </div>
  );
}
