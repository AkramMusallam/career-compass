import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getErrorMessage } from "../../api/client";
import { getProfile, updateBenchmarkOptIn, updateNotificationsOptIn, updatePassword, deleteAccount } from "../../api/endpoints";
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
      .catch(() => {}); // فشل التحميل الأولي ليس حرجاً — المفاتيح تبقى بحالتها الافتراضية
  }, []);

  const passwordValid =
    newPassword.length >= 8 && /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) && /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword === confirmNewPassword && confirmNewPassword.length > 0;
  const canSubmit = currentPassword.length > 0 && passwordValid && passwordsMatch && !isSaving;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setIsSaving(true);
    setErrorMessage("");
    try {
      await updatePassword({ current_password: currentPassword, new_password: newPassword });
      showToast("تم تحديث كلمة المرور بنجاح");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "كلمة المرور الحالية غير صحيحة"));
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
    setBenchmarkOptIn(checked); // تحديث متفائل
    setIsSavingBenchmark(true);
    try {
      await updateBenchmarkOptIn(checked);
      showToast(checked ? "تم تفعيل المشاركة في متوسط الأقران" : "تم إيقاف المشاركة في متوسط الأقران");
    } catch (error) {
      setBenchmarkOptIn(previous); // تراجع عند الفشل
      showToast(getErrorMessage(error, "تعذر تحديث هذا التفضيل"), "error");
    } finally {
      setIsSavingBenchmark(false);
    }
  };

  // Batch 5.6 (F5.2) — ربط مفتاح التنبيهات البريدية الموجود أصلاً بالـ endpoint الجديد
  // PUT /settings/notifications، بنفس نمط التحديث المتفائل (optimistic) المستخدم أعلاه لمفتاح
  // Benchmark تماماً.
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
    <div className="mx-auto max-w-2xl space-y-6">
      <form onSubmit={handleSubmit} className="card">
        <h2 className="mb-4 font-black text-slate-800">تغيير كلمة المرور</h2>

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
          />
          {newPassword && !passwordValid && (
            <p className="error-text">8 أحرف على الأقل، تحتوي حرفاً كبيراً وصغيراً ورقماً</p>
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
          />
          {confirmNewPassword && !passwordsMatch && <p className="error-text">كلمتا المرور غير متطابقتين</p>}
        </div>

        <button type="submit" className="btn-primary" disabled={!canSubmit}>
          {isSaving ? "جاري التحديث..." : "تحديث كلمة المرور"}
        </button>
      </form>

      <div className="card">
        <h2 className="mb-4 font-black text-slate-800">تفضيلات الإشعارات</h2>
        <label className="flex items-center justify-between">
          <span className="font-semibold text-slate-700">تلقي تنبيه بريدي أسبوعي بحالة تقدّم خطة التعلم</span>
          <input
            type="checkbox"
            className="h-5 w-5 rounded text-primary focus:ring-primary-400"
            checked={emailNotifications}
            disabled={isSavingNotifications}
            onChange={(e) => handleNotificationsToggle(e.target.checked)}
          />
        </label>
      </div>

      <div className="card">
        <h2 className="mb-1 font-black text-slate-800">الخصوصية</h2>
        <p className="mb-4 text-sm text-slate-500">
          هذا الخيار اختياري بالكامل ولا يؤثر على تحليلاتك الشخصية — يُستخدم فقط لحساب متوسط
          مجهول الهوية يظهر لك كمرجع بجانب Career Score.
        </p>
        <label className="flex items-center justify-between">
          <span className="font-semibold text-slate-700">
            المشاركة في متوسط الأقران المجهول (Benchmark)
          </span>
          <input
            type="checkbox"
            className="h-5 w-5 rounded text-primary focus:ring-primary-400"
            checked={benchmarkOptIn}
            disabled={isSavingBenchmark}
            onChange={(e) => handleBenchmarkToggle(e.target.checked)}
          />
        </label>
      </div>

      <div className="card">
        <h2 className="mb-4 font-black text-slate-800">إدارة الحساب</h2>
        <button type="button" className="btn-outline" onClick={handleLogout}>
          تسجيل الخروج
        </button>
      </div>

      <div className="rounded-2xl border-2 border-danger-100 bg-danger-50 p-6">
        <h2 className="mb-2 font-black text-danger">منطقة خطر</h2>
        <p className="mb-4 text-sm text-slate-600">حذف الحساب نهائي ولا يمكن التراجع عنه.</p>
        {!showDangerConfirm ? (
          <button
            type="button"
            className="rounded-xl border-2 border-danger px-5 py-2.5 font-bold text-danger hover:bg-danger hover:text-white"
            onClick={() => setShowDangerConfirm(true)}
          >
            حذف الحساب
          </button>
        ) : (
          <div className="rounded-xl bg-white p-4">
            <p className="mb-3 text-sm font-bold text-slate-700">
              هل أنت متأكد؟ سيتم مسح كافة بياناتك وسيرتك الذاتية.
            </p>
            <div className="flex gap-4">
              <button type="button" className="btn-primary bg-danger hover:bg-danger-600 border-none text-white" onClick={handleDeleteAccount}>
                نعم، احذف حسابي
              </button>
              <button type="button" className="btn-outline" onClick={() => setShowDangerConfirm(false)}>
                إلغاء
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
