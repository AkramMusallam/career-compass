import { useEffect, useState } from "react";

import { getErrorMessage } from "../api/client";
import { getProfile, getProfileBadges, updateProfile } from "../api/endpoints";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

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
      .catch(() => setBadges([])); // فشل تحميل الإنجازات ليس حرجاً — نتجاهله بصمت
  }, []);

  const isDirty = profile && fullName.trim() !== profile.full_name && fullName.trim().length >= 2;

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
    return <div className="card mx-auto h-64 max-w-2xl animate-pulse" />;
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
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="card flex flex-col items-center gap-3 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-3xl font-black text-white">
          {initial}
        </span>
        <div>
          <p className="text-lg font-black text-slate-800">{profile.full_name}</p>
          <p className="text-sm text-slate-500">{profile.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="card">
          <p className="text-2xl font-black text-primary">{profile.total_analyses}</p>
          <p className="text-xs font-bold text-slate-500">عدد التحليلات</p>
        </div>
        <div className="card">
          <p className="text-2xl font-black text-secondary">{Math.round(profile.highest_career_score)}</p>
          <p className="text-xs font-bold text-slate-500">أعلى Career Score</p>
        </div>
        <div className="card">
          <p className="text-sm font-black text-slate-700">
            {new Date(profile.created_at).toLocaleDateString("ar-EG")}
          </p>
          <p className="text-xs font-bold text-slate-500">تاريخ الانضمام</p>
        </div>
      </div>

      {badges.length > 0 && (
        <div className="card">
          <h2 className="mb-4 font-black text-slate-800">الإنجازات</h2>
          <div className="grid grid-cols-3 gap-3">
            {badges.map((badge) => (
              <div
                key={badge.id}
                title={badge.description}
                className={`flex flex-col items-center gap-1 rounded-2xl p-4 text-center ${
                  badge.achieved ? "bg-secondary-50" : "bg-slate-50 opacity-50"
                }`}
              >
                <span className="text-3xl" aria-hidden="true">
                  {BADGE_ICONS[badge.id] || "🏅"}
                </span>
                <p className="text-xs font-bold text-slate-700">{badge.title}</p>
                {badge.achieved && badge.achieved_at && (
                  <p className="text-[10px] text-slate-400">{new Date(badge.achieved_at).toLocaleDateString("ar-EG")}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="card">
        <h2 className="mb-4 font-black text-slate-800">تعديل البيانات الشخصية</h2>

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
          <input type="email" className="input-field bg-slate-100" value={profile.email} disabled readOnly />
          <p className="mt-1 text-xs text-slate-400">تغيير البريد الإلكتروني يتطلب تحققاً إضافياً</p>
        </div>

        <button type="submit" className="btn-primary" disabled={!isDirty || isSaving}>
          {isSaving ? "جاري الحفظ..." : "حفظ التغييرات"}
        </button>
      </form>
    </div>
  );
}
