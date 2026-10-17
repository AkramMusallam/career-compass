import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getErrorMessage } from "../../api/client";
import {
  getProfile,
  updateBenchmarkOptIn,
  updateNotificationsOptIn,
  updatePassword,
  deleteAccount,
} from "../../api/endpoints";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

export default function Settings() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [benchmarkOptIn, setBenchmarkOptIn] = useState(false);
  const [isSavingBenchmark, setIsSavingBenchmark] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showDangerConfirm, setShowDangerConfirm] = useState(false);

  useEffect(() => {
    getProfile()
      .then((res) => {
        setBenchmarkOptIn(res.data.benchmark_opt_in);
        setEmailNotifications(res.data.notifications_opt_in);
      })
      .catch(() => {});
  }, []);

  const passwordValid =
    newPassword.length >= 8 &&
    /[A-Z]/.test(newPassword) &&
    /[a-z]/.test(newPassword) &&
    /[0-9]/.test(newPassword);
  const passwordsMatch =
    newPassword === confirmNewPassword && confirmNewPassword.length > 0;
  const canSubmit =
    currentPassword.length > 0 && passwordValid && passwordsMatch && !isSaving;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setIsSaving(true);
    setErrorMessage("");
    try {
      await updatePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      showToast("تم تحديث كلمة المرور بنجاح");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, "كلمة المرور الحالية غير صحيحة")
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleBenchmarkToggle = async (checked) => {
    const previous = benchmarkOptIn;
    setBenchmarkOptIn(checked);
    setIsSavingBenchmark(true);
    try {
      await updateBenchmarkOptIn(checked);
      showToast(
        checked
          ? "تم تفعيل المشاركة في متوسط الأقران"
          : "تم إيقاف المشاركة في متوسط الأقران"
      );
    } catch (error) {
      setBenchmarkOptIn(previous);
      showToast(getErrorMessage(error, "تعذر تحديث هذا التفضيل"), "error");
    } finally {
      setIsSavingBenchmark(false);
    }
  };

  const handleNotificationsToggle = async (checked) => {
    const previous = emailNotifications;
    setEmailNotifications(checked);
    setIsSavingNotifications(true);
    try {
      await updateNotificationsOptIn(checked);
      showToast(checked ? "تم تفعيل الإشعارات" : "تم إيقاف الإشعارات");
    } catch (error) {
      setEmailNotifications(previous);
      showToast(getErrorMessage(error, "خطأ أثناء تحديث الإعدادات"), "error");
    } finally {
      setIsSavingNotifications(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount();
      showToast("تم حذف الحساب بنجاح");
      logout();
      navigate("/login");
    } catch (error) {
      showToast(getErrorMessage(error, "خطأ أثناء حذف الحساب"), "error");
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in-up">
      <div className="card !p-6">
        <span className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200 px-3 py-0.5 text-[11px] font-extrabold text-indigo-700">
          ⚙️ إعدادات الحساب والأمان
        </span>
        <h1 className="text-2xl font-black text-slate-900">إعدادات المنصة</h1>
        <p className="text-xs font-medium text-slate-500 mt-0.5">
          تحكم بكلمة المرور، التنبيهات البريدية، وتفضيلات الخصوصية
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card">
        <h2 className="mb-5 text-lg font-black text-slate-900">
          🔐 تغيير كلمة المرور
        </h2>

        {errorMessage && (
          <div className="alert-banner-error mb-4" role="alert">
            {errorMessage}
          </div>
        )}

        <div className="mb-4">
          <label htmlFor="currentPassword" className="label-text">
            كلمة المرور الحالية
          </label>
          <input
            id="currentPassword"
            type="password"
            className="input-field"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            dir="ltr"
          />
        </div>

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
            dir="ltr"
          />
          {newPassword && !passwordValid && (
            <p className="error-text">
              8 أحرف على الأقل، تحتوي حرفاً كبيراً وصغيراً ورقماً
            </p>
          )}
        </div>

        <div className="mb-6">
          <label htmlFor="confirmNewPassword" className="label-text">
            تأكيد كلمة المرور الجديدة
          </label>
          <input
            id="confirmNewPassword"
            type="password"
            className="input-field"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            dir="ltr"
          />
          {confirmNewPassword && !passwordsMatch && (
            <p className="error-text">كلمتا المرور غير متطابقتين</p>
          )}
        </div>

        <button type="submit" className="btn-primary" disabled={!canSubmit}>
          {isSaving ? "جاري التحديث..." : "تحديث كلمة المرور"}
        </button>
      </form>

      <div className="card space-y-5">
        <h2 className="text-lg font-black text-slate-900">
          🔔 التفضيلات والخصوصية
        </h2>

        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 transition hover:bg-white">
          <div>
            <p className="font-bold text-slate-800 text-sm">
              التنبيهات البريدية الأسبوعية
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              تلقي ملخص بريدي أسبوعي بحالة تقدّمك في خطة التعلم المهنية (3 أشهر)
            </p>
          </div>
          <input
            type="checkbox"
            className="h-5 w-5 rounded text-primary-600 focus:ring-primary-400"
            checked={emailNotifications}
            disabled={isSavingNotifications}
            onChange={(e) => handleNotificationsToggle(e.target.checked)}
          />
        </label>

        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 transition hover:bg-white">
          <div>
            <p className="font-bold text-slate-800 text-sm">
              المشاركة في متوسط الأقران المجهول (Benchmark)
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              خيار اختياري بالكامل يُستخدم لحساب متوسط مجهول الهوية يظهر كمرجع بجانب Career Score
            </p>
          </div>
          <input
            type="checkbox"
            className="h-5 w-5 rounded text-primary-600 focus:ring-primary-400"
            checked={benchmarkOptIn}
            disabled={isSavingBenchmark}
            onChange={(e) => handleBenchmarkToggle(e.target.checked)}
          />
        </label>
      </div>

      <div className="card flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-black text-slate-900">إدارة الجلسة</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            تسجيل الخروج من جلستك الحالية على هذا المتصفح
          </p>
        </div>
        <button type="button" className="btn-outline" onClick={handleLogout}>
          تسجيل الخروج
        </button>
      </div>

      <div className="rounded-3xl border-2 border-red-200/80 bg-red-50/60 p-6">
        <h2 className="mb-1 text-lg font-black text-danger">⚠️ منطقة خطر</h2>
        <p className="mb-4 text-sm font-medium text-slate-600">
          حذف الحساب نهائي ويؤدي إلى مسح كافة التحليلات والسير الذاتية المرتبطة به ولا يمكن التراجع عنه.
        </p>
        {!showDangerConfirm ? (
          <button
            type="button"
            className="rounded-xl border-2 border-danger px-5 py-2.5 text-sm font-bold text-danger transition hover:bg-danger hover:text-white"
            onClick={() => setShowDangerConfirm(true)}
          >
            حذف الحساب نهائياً
          </button>
        ) : (
          <div className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm">
            <p className="mb-4 text-sm font-bold text-slate-800">
              هل أنت متأكد تماماً؟ سيتم مسح كافة بياناتك وسيرتك الذاتية فوراً.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-xl bg-danger px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-red-700"
                onClick={handleDeleteAccount}
              >
                نعم، احذف حسابي نهائياً
              </button>
              <button
                type="button"
                className="btn-outline"
                onClick={() => setShowDangerConfirm(false)}
              >
                إلغاء
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
