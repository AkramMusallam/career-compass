import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ShieldCheck, ArrowRight, AlertCircle } from "lucide-react";

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
    newPassword.length >= 8 &&
    /[A-Z]/.test(newPassword) &&
    /[a-z]/.test(newPassword) &&
    /[0-9]/.test(newPassword);
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
    <div className="flex min-h-screen items-center justify-center bg-[#F7F8FA] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Link to="/login">
            <CompassLogo size={42} />
          </Link>
        </div>

        <div className="card !p-6 sm:!p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary-50 text-secondary-600 border border-secondary-100">
              <ShieldCheck size={22} />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">
              تعيين كلمة مرور جديدة
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm font-medium text-slate-500">
              اختر كلمة مرور قوية لتأمين حسابك المهني
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-start">
            {status === "error" && (
              <div className="alert-banner-error">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <span>{message}</span>
              </div>
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
                  8 أحرف على الأقل، تحتوي حرفاً كبيراً وصغيراً ورقماً
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
              className="btn-primary w-full py-3 mt-2"
              disabled={!canSubmit}
            >
              {status === "loading" ? "جاري التحديث..." : "حفظ وتعيين كلمة المرور"}
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
        </div>
      </div>
    </div>
  );
}
