import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Settings as SettingsIcon,
  Lock,
  Bell,
  LogOut,
  AlertTriangle,
  AlertCircle,
  KeyRound,
  Copy,
  Check,
  Shield,
} from "lucide-react";

import { getErrorMessage } from "../../api/client";
import {
  getProfile,
  updateBenchmarkOptIn,
  updateNotificationsOptIn,
  updatePassword,
  deleteAccount,
  getRecruiterConsent,
  updateRecruiterConsent,
  getCloudAiConsent,
  updateCloudAiConsent,
  createExtensionToken,
  logoutAllSessions,
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
  const [recruiterConsent, setRecruiterConsent] = useState(false);
  const [isSavingRecruiterConsent, setIsSavingRecruiterConsent] = useState(false);
  const [recruiterConsentLoaded, setRecruiterConsentLoaded] = useState(false);
  const [cloudAiConsent, setCloudAiConsent] = useState(false);
  const [isSavingCloudAiConsent, setIsSavingCloudAiConsent] = useState(false);
  const [cloudAiConsentLoaded, setCloudAiConsentLoaded] = useState(false);
  const [extensionTokenInfo, setExtensionTokenInfo] = useState(null);
  const [isGeneratingExtensionToken, setIsGeneratingExtensionToken] = useState(false);
  const [extensionTokenCopied, setExtensionTokenCopied] = useState(false);
  const [isSavingBenchmark, setIsSavingBenchmark] = useState(false);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showDangerConfirm, setShowDangerConfirm] = useState(false);

  useEffect(() => {
    getProfile()
      .then((res) => {
        setBenchmarkOptIn(Boolean(res.data?.benchmark_opt_in));
        setEmailNotifications(res.data?.notifications_opt_in !== false);
        setPreferencesLoaded(true);
      })
      .catch(() => {
        showToast("تعذر تحميل تفضيلات الحساب", "error");
      });
  }, [showToast]);

  useEffect(() => {
    getRecruiterConsent().then((res) => {
      setRecruiterConsent(Boolean(res.data?.opted_in));
      setRecruiterConsentLoaded(true);
    }).catch(() => showToast("تعذر تحميل إعداد مشاركة الملف مع مسؤولي التوظيف", "error"));
  }, [showToast]);

  useEffect(() => {
    getCloudAiConsent()
      .then((res) => {
        setCloudAiConsent(Boolean(res.data?.opted_in));
        setCloudAiConsentLoaded(true);
      })
      .catch(() => {
        setCloudAiConsentLoaded(true);
      });
  }, []);

  const handleRecruiterConsent = async (checked) => {
    setIsSavingRecruiterConsent(true);
    try {
      await updateRecruiterConsent(checked);
      setRecruiterConsent(checked);
      showToast(checked ? "تم تفعيل مشاركة ملفك مع مسؤولي التوظيف" : "تم إيقاف مشاركة ملفك مع مسؤولي التوظيف");
    } catch (error) {
      showToast(getErrorMessage(error, "تعذر تحديث تفضيل المشاركة"), "error");
    } finally {
      setIsSavingRecruiterConsent(false);
    }
  };

  const handleCloudAiConsent = async (checked) => {
    const previous = cloudAiConsent;
    setCloudAiConsent(checked);
    setIsSavingCloudAiConsent(true);
    try {
      const res = await updateCloudAiConsent(checked);
      setCloudAiConsent(Boolean(res.data?.opted_in ?? checked));
      showToast(
        checked
          ? "تمت الموافقة على المعالجة عبر مزوّد الذكاء الاصطناعي السحابي عند تفعيله"
          : "تم إيقاف المعالجة عبر المزوّد السحابي (سيتم استخدام المعالجة المحلية فقط)"
      );
    } catch (error) {
      setCloudAiConsent(previous);
      showToast(getErrorMessage(error, "تعذر تحديث تفضيل المعالجة السحابية"), "error");
    } finally {
      setIsSavingCloudAiConsent(false);
    }
  };

  const handleGenerateExtensionToken = async () => {
    setIsGeneratingExtensionToken(true);
    setExtensionTokenCopied(false);
    try {
      const res = await createExtensionToken();
      setExtensionTokenInfo(res.data);
      showToast("تم توليد رمز مطابقة الإضافة بنجاح");
    } catch (error) {
      showToast(getErrorMessage(error, "تعذر توليد رمز إضافة المتصفح"), "error");
    } finally {
      setIsGeneratingExtensionToken(false);
    }
  };

  const handleCopyExtensionToken = async () => {
    const token = extensionTokenInfo?.extension_token;
    if (!token) return;
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(token);
      setExtensionTokenCopied(true);
      setTimeout(() => setExtensionTokenCopied(false), 2000);
    } catch {
      showToast("تعذر النسخ التلقائي، انسخ الرمز يدوياً", "error");
    }
  };

  const newPasswordBytes = new TextEncoder().encode(newPassword).length;
  const passwordValid =
    newPassword.length >= 8 &&
    newPasswordBytes <= 72 &&
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

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleLogoutAll = async () => {
    try {
      await logoutAllSessions();
      showToast("تم إنهاء جميع الجلسات النشطة");
    } catch (error) {
      showToast(getErrorMessage(error, "تعذر إنهاء جميع الجلسات"), "error");
    } finally {
      await logout({ skipServer: true });
      navigate("/login");
    }
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
      await logout({ skipServer: true });
      navigate("/login");
    } catch (error) {
      showToast(getErrorMessage(error, "خطأ أثناء حذف الحساب"), "error");
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 animate-fade-in">
      <div className="card">
        <span className="mb-1.5 inline-flex items-center gap-1.5 rounded-lg bg-primary-50 border border-primary-100 px-2.5 py-0.5 text-[11px] font-bold text-primary-700">
          <SettingsIcon size={13} />
          <span>إعدادات الحساب والأمان</span>
        </span>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900">إعدادات المنصة</h1>
        <p className="text-xs font-medium text-slate-500 mt-0.5">
          تحكم بكلمة المرور، التنبيهات البريدية، وتفضيلات الخصوصية
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card">
        <div className="mb-4 flex items-center gap-2">
          <Lock size={18} className="text-primary-600" />
          <h2 className="text-base sm:text-lg font-black text-slate-900">
            تغيير كلمة المرور
          </h2>
        </div>

        {errorMessage && (
          <div className="alert-banner-error mb-4" role="alert">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
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

        <div className="mb-5">
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

      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <Bell size={18} className="text-secondary-600" />
          <h2 className="text-base sm:text-lg font-black text-slate-900">
            التفضيلات والخصوصية
          </h2>
        </div>

        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 transition-colors hover:bg-white">
          <div>
            <p className="font-bold text-slate-800 text-xs sm:text-sm">
              التنبيهات البريدية الأسبوعية
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              تلقي ملخص بريدي أسبوعي بحالة تقدّمك في خطة التعلم المهنية (3 أشهر)
            </p>
          </div>
          <input
            type="checkbox"
            className="h-4 w-4 rounded text-primary-600 focus:ring-primary-500"
            checked={emailNotifications}
            disabled={!preferencesLoaded || isSavingNotifications}
            onChange={(e) => handleNotificationsToggle(e.target.checked)}
          />
        </label>

        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 transition-colors hover:bg-white">
          <div>
            <p className="font-bold text-slate-800 text-xs sm:text-sm">
              المشاركة في متوسط الأقران المجهول (Benchmark)
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              خيار اختياري بالكامل يُستخدم لحساب متوسط مجهول الهوية يظهر كمرجع بجانب Career Score
            </p>
          </div>
          <input
            type="checkbox"
            className="h-4 w-4 rounded text-primary-600 focus:ring-primary-500"
            checked={benchmarkOptIn}
            disabled={!preferencesLoaded || isSavingBenchmark}
            onChange={(e) => handleBenchmarkToggle(e.target.checked)}
          />
        </label>
      </div>

      <label className="card flex cursor-pointer items-center justify-between gap-4">
        <div>
          <p className="font-bold text-slate-800 text-sm">مشاركة ملفي المؤكد مع مسؤولي التوظيف</p>
          <p className="text-xs text-slate-500 mt-1">عند التفعيل يمكن لمسؤولي التوظيف المعتمدين الاطلاع فقط على سيرتك الذاتية المؤكدة (ولا تظهر المسودات غير المؤكدة أبداً). يتم إخفاء بيانات الهوية المباشرة عند تقييم التوافق بالذكاء الاصطناعي. يمكنك إيقاف المشاركة في أي وقت.</p>
        </div>
        <input type="checkbox" checked={recruiterConsent} disabled={!recruiterConsentLoaded || isSavingRecruiterConsent} onChange={(e) => handleRecruiterConsent(e.target.checked)} />
      </label>

      <div className="card space-y-3">
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-primary-600" />
          <h2 className="font-black text-slate-900 text-sm sm:text-base">
            الخصوصية ومعالجة الذكاء الاصطناعي السحابي
          </h2>
        </div>
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 transition-colors hover:bg-white">
          <div>
            <p className="font-bold text-slate-800 text-xs sm:text-sm">
              الموافقة على معالجة البيانات عبر مزوّد الذكاء الاصطناعي السحابي (OpenAI)
            </p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              عند التفعيل وتوفّر مفتاح المزوّد السحابي في بيئة الخادم، قد تُرسل مقتطفات السيرة الذاتية ونصوص أو صوت المقابلة بعد تقليص البيانات وحجب البريد الإلكتروني ورقم الهاتف. عند الإيقاف يقتصر التحليل على المحرّك المحلي (Ollama) أو المنطق الداخلي دون نقل بيانات للخارج.
            </p>
          </div>
          <input
            type="checkbox"
            className="h-4 w-4 rounded text-primary-600 focus:ring-primary-500"
            checked={cloudAiConsent}
            disabled={!cloudAiConsentLoaded || isSavingCloudAiConsent}
            onChange={(e) => handleCloudAiConsent(e.target.checked)}
          />
        </label>
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <KeyRound size={18} className="text-primary-600" />
            <div>
              <h2 className="font-black text-slate-900 text-sm sm:text-base">
                رمز إضافة المتصفح (Match-Only Extension Token)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                رمز مؤقت محدود الصلاحية (extension:match) يُستخدم فقط لمطابقة إعلانات الوظائف في إضافة Chrome دون مشاركة رمز جلستك الكامل.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn-primary shrink-0"
            onClick={handleGenerateExtensionToken}
            disabled={isGeneratingExtensionToken}
          >
            {isGeneratingExtensionToken ? "جاري التوليد..." : "توليد رمز الإضافة"}
          </button>
        </div>

        {extensionTokenInfo?.extension_token && (
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={extensionTokenInfo.extension_token}
                aria-label="رمز مطابقة إضافة المتصفح"
                className="input-field text-xs"
                dir="ltr"
              />
              <button
                type="button"
                className="btn-outline shrink-0"
                onClick={handleCopyExtensionToken}
              >
                {extensionTokenCopied ? (
                  <>
                    <Check size={14} />
                    <span>تم النسخ</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>نسخ</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              النطاق: {extensionTokenInfo.scope || "extension:match"} — صالح لمدة {extensionTokenInfo.expires_in_minutes} دقيقة
            </p>
          </div>
        )}
      </div>

      <div className="card flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-black text-slate-900 text-sm sm:text-base">إدارة الجلسة</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            تسجيل الخروج من جلستك الحالية أو إنهاء جميع الجلسات النشطة
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-outline" onClick={handleLogout}>
            <LogOut size={15} />
            <span>تسجيل الخروج</span>
          </button>
          <button type="button" className="btn-outline" onClick={handleLogoutAll}>
            <LogOut size={15} />
            <span>خروج من كل الأجهزة</span>
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-red-200 bg-red-50/60 p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-1.5">
          <AlertTriangle size={18} className="text-danger" />
          <h2 className="text-base sm:text-lg font-black text-danger">منطقة خطر</h2>
        </div>
        <p className="mb-4 text-xs sm:text-sm font-medium text-slate-600">
          حذف الحساب نهائي ويؤدي إلى مسح كافة التحليلات والسير الذاتية المرتبطة به ولا يمكن التراجع عنه.
        </p>
        {!showDangerConfirm ? (
          <button
            type="button"
            className="rounded-xl border border-danger px-4 py-2 text-xs sm:text-sm font-bold text-danger transition-colors hover:bg-danger hover:text-white"
            onClick={() => setShowDangerConfirm(true)}
          >
            حذف الحساب نهائياً
          </button>
        ) : (
          <div className="rounded-xl border border-red-200 bg-white p-4">
            <p className="mb-3 text-xs sm:text-sm font-bold text-slate-800">
              هل أنت متأكد تماماً؟ سيتم مسح كافة بياناتك وسيرتك الذاتية فوراً.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                className="rounded-xl bg-danger px-4 py-2 text-xs sm:text-sm font-bold text-white hover:bg-red-700"
                onClick={handleDeleteAccount}
              >
                نعم، احذف حسابي نهائياً
              </button>
              <button
                type="button"
                className="btn-outline !py-2"
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
