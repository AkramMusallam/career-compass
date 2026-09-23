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

  const passwordValid = newPassword.length >= 8 && /\d/.test(newPassword) && /[a-zA-Z]/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;
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
      setMessage(getErrorMessage(error, "رابط الاستعادة غير صالح أو منتهي الصلاحية."));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mb-8 flex justify-center">
          <CompassLogo size={48} />
        </div>
        <div className="card">
          <h1 className="mb-2 text-xl font-black text-slate-800">كلمة مرور جديدة</h1>
          
          <form onSubmit={handleSubmit} className="text-start">
            <p className="mb-6 text-sm text-slate-500 text-center">
              يرجى إدخال كلمة المرور الجديدة لحسابك.
            </p>
            
            {status === "error" && (
              <div className="alert-banner-error mb-4">{message}</div>
            )}

            <div className="mb-4">
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
              />
              {newPassword && !passwordValid && (
                <p className="error-text">يجب أن تكون 8 أحرف على الأقل وتحتوي على رقم وحرف</p>
              )}
            </div>

            <div className="mb-6">
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
              />
              {confirmPassword && !passwordsMatch && (
                <p className="error-text">كلمتا المرور غير متطابقتين</p>
              )}
            </div>

            <button
              type="submit"
              className="btn-primary w-full mb-4"
              disabled={!canSubmit}
            >
              {status === "loading" ? "جاري التحديث..." : "تعيين كلمة المرور"}
            </button>

            <div className="text-center">
              <Link to="/login" className="text-sm font-semibold text-primary hover:underline">
                العودة لتسجيل الدخول
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
