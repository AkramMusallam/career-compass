import { useEffect, useState } from "react";
import {
  Compass,
  TrendingUp,
  Flag,
  Award,
  Check,
  AlertCircle,
} from "lucide-react";

import { getErrorMessage } from "../../api/client";
import { getProfile, getProfileBadges, updateProfile } from "../../api/endpoints";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

const BADGE_ICONS = {
  first_analysis: Compass,
  score_boost_10: TrendingUp,
  first_month_roadmap: Flag,
};

export default function Profile() {
  const { updateStoredUser } = useAuth();
  const { showToast } = useToast();

  const [status, setStatus] = useState("loading");
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
      .then((res) => setBadges(Array.isArray(res.data?.badges) ? res.data.badges : []))
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
    <div className="mx-auto max-w-3xl space-y-5 animate-fade-in">
      {/* Executive Profile Banner */}
      <div className="rounded-2xl bg-slate-900 text-white p-6 sm:p-8 text-center shadow-card border border-slate-800">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-primary-600 text-2xl sm:text-3xl font-black text-white border-2 border-slate-700">
            {initial}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              {profile.full_name}
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-400" dir="ltr">
              {profile.email}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 text-center">
        <div className="card !p-4">
          <p className="text-xl sm:text-2xl font-black text-primary-600">
            {profile.total_analyses}
          </p>
          <p className="mt-1 text-[11px] font-bold text-slate-500">إجمالي التحليلات</p>
        </div>
        <div className="card !p-4">
          <p className="text-xl sm:text-2xl font-black text-secondary-600">
            {Math.round(profile.highest_career_score)}
          </p>
          <p className="mt-1 text-[11px] font-bold text-slate-500">أعلى Career Score</p>
        </div>
        <div className="card !p-4 flex flex-col justify-center">
          <p className="text-xs sm:text-sm font-black text-slate-800">
            {new Date(profile.created_at).toLocaleDateString("ar-EG")}
          </p>
          <p className="mt-1 text-[11px] font-bold text-slate-500">تاريخ الانضمام</p>
        </div>
      </div>

      {/* Achievements / Badges */}
      {badges.length > 0 && (
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award size={18} className="text-accent-600" />
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                أوسمة الإنجاز المهني
              </h2>
            </div>
            <span className="text-xs font-bold text-slate-400">
              {badges.filter((b) => b.achieved).length} من {badges.length} مكتمل
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {badges.map((badge) => {
              const IconComp = BADGE_ICONS[badge.id] || Award;
              return (
                <div
                  key={badge.id}
                  title={badge.description}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-colors ${
                    badge.achieved
                      ? "border-secondary-200 bg-secondary-50/60"
                      : "border-slate-200/70 bg-slate-50/70 opacity-60"
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      badge.achieved
                        ? "bg-secondary-600 text-white"
                        : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    <IconComp size={20} />
                  </div>
                  <p className="text-xs font-black text-slate-800">{badge.title}</p>
                  {badge.description && (
                    <p className="text-[11px] font-medium text-slate-500">
                      {badge.description}
                    </p>
                  )}
                  {badge.achieved && badge.achieved_at && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-secondary-100 px-2.5 py-0.5 text-[10px] font-bold text-secondary-800">
                      <Check size={11} />
                      <span>
                        {new Date(badge.achieved_at).toLocaleDateString("ar-EG")}
                      </span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit Profile Form */}
      <form onSubmit={handleSave} className="card">
        <h2 className="mb-4 text-base sm:text-lg font-black text-slate-900">
          تعديل البيانات الشخصية
        </h2>

        {errorMessage && (
          <div className="alert-banner-error mb-4" role="alert">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
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

        <div className="mb-5">
          <label htmlFor="profileEmail" className="label-text">البريد الإلكتروني</label>
          <input
            id="profileEmail"
            type="email"
            className="input-field bg-slate-100 text-slate-500 cursor-not-allowed"
            value={profile.email || ""}
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
