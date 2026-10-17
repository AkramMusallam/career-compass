import { useEffect, useState } from "react";

import { getErrorMessage } from "../../api/client";
import { getProfile, getProfileBadges, updateProfile } from "../../api/endpoints";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

const BADGE_ICONS = {
  first_analysis: "🧭",
  score_boost_10: "📈",
  first_month_roadmap: "🏁",
};

export default function Profile() {
  const { updateStoredUser } = useAuth();
  const { showToast } = useToast();

  const [status, setStatus] = useState("loading"); // loading | loaded | error
  const [profile, setProfile] = useState(null);
  const [fullName, setFullName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [badges, setBadges] = useState([]);

  const load = () => {
    setStatus("loading");
    getProfile()
      .then((res) => {
        setProfile(res.data);
        setFullName(res.data.full_name);
        setStatus("loaded");
      })
      .catch(() => setStatus("error"));
  };

  useEffect(load, []);

  useEffect(() => {
    getProfileBadges()
      .then((res) => setBadges(res.data.badges))
      .catch(() => setBadges([]));
  }, []);

  const isDirty =
    profile &&
    fullName.trim() !== profile.full_name &&
    fullName.trim().length >= 2;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!isDirty) return;
    setIsSaving(true);
    setErrorMessage("");
    try {
      const res = await updateProfile({ full_name: fullName.trim() });
      setProfile((prev) => ({ ...prev, full_name: res.data.full_name }));
      updateStoredUser({ full_name: res.data.full_name });
      showToast("تم حفظ التغييرات بنجاح");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "تعذر حفظ التغييرات"));
    } finally {
      setIsSaving(false);
    }
  };

  if (status === "loading") {
    return <div className="card mx-auto h-64 max-w-3xl animate-pulse" />;
  }

  if (status === "error") {
    return (
      <div className="card mx-auto max-w-md text-center">
        <p className="mb-4 font-bold text-slate-700">تعذر تحميل بياناتك</p>
        <button className="btn-primary" onClick={load}>
          إعادة المحاولة
        </button>
      </div>
    );
  }

  const initial = profile.full_name?.trim()?.charAt(0)?.toUpperCase() || "?";

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in-up">
      {/* Executive Profile Banner */}
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-50/95 via-white/95 to-emerald-50/85 p-8 text-center shadow-[0_20px_50px_-15px_rgba(79,70,229,0.12)] border border-indigo-100/90 backdrop-blur-xl">
        <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-indigo-400/20 blur-[80px]" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-emerald-400/15 blur-[80px]" />

        <div className="relative z-10 flex flex-col items-center gap-3">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-emerald-500 text-3xl font-black text-white shadow-xl shadow-indigo-500/25 ring-4 ring-white">
            {initial}
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">{profile.full_name}</h1>
            <p className="text-sm font-medium text-slate-500" dir="ltr">
              {profile.email}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
        <div className="card !p-5">
          <p className="text-3xl font-black text-primary-600">{profile.total_analyses}</p>
          <p className="mt-1 text-xs font-bold text-slate-500">إجمالي التحليلات</p>
        </div>
        <div className="card !p-5">
          <p className="text-3xl font-black text-emerald-600">
            {Math.round(profile.highest_career_score)}
          </p>
          <p className="mt-1 text-xs font-bold text-slate-500">أعلى Career Score</p>
        </div>
        <div className="card !p-5 flex flex-col justify-center">
          <p className="text-base font-black text-slate-800">
            {new Date(profile.created_at).toLocaleDateString("ar-EG")}
          </p>
          <p className="mt-1 text-xs font-bold text-slate-500">تاريخ الانضمام</p>
        </div>
      </div>

      {/* Achievements / Badges */}
      {badges.length > 0 && (
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900">🏅 أوسمة الإنجاز المهني</h2>
            <span className="text-xs font-bold text-slate-400">
              {badges.filter((b) => b.achieved).length} من {badges.length} مكتمل
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {badges.map((badge) => (
              <div
                key={badge.id}
                title={badge.description}
                className={`flex flex-col items-center gap-2 rounded-2xl border p-5 text-center transition-all ${
                  badge.achieved
                    ? "border-emerald-200 bg-emerald-50/60 shadow-sm"
                    : "border-slate-200/60 bg-slate-50/60 opacity-55"
                }`}
              >
                <span className="text-3xl" aria-hidden="true">
                  {BADGE_ICONS[badge.id] || "🏅"}
                </span>
                <p className="text-xs font-black text-slate-800">{badge.title}</p>
                {badge.description && (
                  <p className="text-[11px] font-medium text-slate-500">
                    {badge.description}
                  </p>
                )}
                {badge.achieved && badge.achieved_at && (
                  <span className="mt-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                    ✓ {new Date(badge.achieved_at).toLocaleDateString("ar-EG")}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Profile Form */}
      <form onSubmit={handleSave} className="card">
        <h2 className="mb-5 text-lg font-black text-slate-900">تعديل البيانات الشخصية</h2>

        {errorMessage && (
          <div className="alert-banner-error mb-4" role="alert">
            {errorMessage}
          </div>
        )}

        <div className="mb-4">
          <label htmlFor="fullName" className="label-text">
            الاسم الكامل
          </label>
          <input
            id="fullName"
            type="text"
            className="input-field"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>

        <div className="mb-6">
          <label className="label-text">البريد الإلكتروني</label>
          <input
            type="email"
            className="input-field bg-slate-100/80 text-slate-500 cursor-not-allowed"
            value={profile.email}
            disabled
            readOnly
            dir="ltr"
          />
          <p className="mt-1.5 text-xs font-medium text-slate-400">
            البريد الإلكتروني مرتبط بهوية الحساب ولا يمكن تغييره حالياً
          </p>
        </div>

        <button type="submit" className="btn-primary" disabled={!isDirty || isSaving}>
          {isSaving ? "جاري الحفظ..." : "حفظ التغييرات"}
        </button>
      </form>
    </div>
  );
}
