import { useEffect, useState } from "react";
import apiClient, { getErrorMessage } from "../../api/client";

export default function SupportAccess() {
  const [owner, setOwner] = useState(false);
  const [grants, setGrants] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [ownerGrants, setOwnerGrants] = useState([]);
  const [form, setForm] = useState({ candidate_id: "", reason: "", consent_evidence: "", hours: 1 });
  const [created, setCreated] = useState(null);
  const [profile, setProfile] = useState(null);
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      const [myGrants, myProfiles] = await Promise.all([apiClient.get("/support/grants/mine"), apiClient.get("/support/my-profiles")]);
      setGrants(Array.isArray(myGrants.data) ? myGrants.data : []);
      setProfiles(Array.isArray(myProfiles.data) ? myProfiles.data : []);
    }
    catch (error) { setMessage(getErrorMessage(error, "تعذر تحميل صلاحيات الدعم")); }
    try {
      const ownerRes = await apiClient.get("/support/grants");
      setOwnerGrants(Array.isArray(ownerRes.data) ? ownerRes.data : []);
      setOwner(true);
    }
    catch (error) { if (error.response?.status !== 403) setMessage(getErrorMessage(error, "تعذر التحقق من الصلاحية")); }
  };
  useEffect(() => { load(); }, []);

  const submit = async (event) => {
    event.preventDefault();
    try {
      const response = await apiClient.post("/support/grants", { ...form, hours: Number(form.hours) });
      setCreated(response.data); setProfile(null); setMessage("تم تسجيل الموافقة ومنح الصلاحية المؤقتة.");
      await load();
    } catch (error) { setMessage(getErrorMessage(error, "تعذر منح صلاحية الدعم")); }
  };
  const openProfile = async () => {
    try { setProfile((await apiClient.get(`/support/grants/${created.grant_id}/profile`)).data); }
    catch (error) { setMessage(getErrorMessage(error, "تعذر فتح الملف")); }
  };
  const revoke = async (id) => {
    try { await apiClient.delete(`/support/grants/${id}`); await load(); setMessage("تم إلغاء صلاحية الدعم."); }
    catch (error) { setMessage(getErrorMessage(error, "تعذر إلغاء الصلاحية")); }
  };

  return <main className="mx-auto max-w-3xl space-y-6 p-6" dir="rtl">
    <h1 className="text-2xl font-bold">صلاحيات وصول الدعم</h1>
    {message && <p role="status">{message}</p>}
    <section className="card space-y-2"><h2 className="font-bold">معرّفات ملفاتي للدعم</h2>
      <p>شارك المعرّف المناسب مع الدعم عند طلب المساعدة.</p>
      {!profiles.length && <p>لا يوجد ملف مهني بعد.</p>}
      {profiles.map((profile) => <p key={profile.candidate_id} dir="auto">{profile.target_role || "ملف مهني"}: {profile.candidate_id}</p>)}
    </section>
    {owner && <form onSubmit={submit} className="card space-y-3">
      <h2 className="font-bold">تسجيل موافقة المرشح</h2>
      <p>سجّل موافقة المرشح وسبب الوصول قبل فتح ملفه. كل فتح للملف يُسجل.</p>
      <label className="block">معرّف ملف المرشح<input required className="input-field" value={form.candidate_id} onChange={(e) => setForm({ ...form, candidate_id: e.target.value })} /></label>
      <label className="block">سبب الدعم<input required minLength={3} maxLength={500} className="input-field" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></label>
      <label className="block">توثيق الموافقة وتاريخها<textarea required minLength={10} maxLength={1000} className="input-field" value={form.consent_evidence} onChange={(e) => setForm({ ...form, consent_evidence: e.target.value })} /></label>
      <label className="block">المدة بالساعات<input type="number" min="1" max="24" required className="input-field" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} /></label>
      <button className="btn-primary">تسجيل الموافقة</button>
    </form>}
    {created && <section className="card space-y-3"><p>تنتهي الصلاحية: {created.expires_at}</p><button className="btn-primary" onClick={openProfile}>فتح ملف المرشح</button>
      {profile && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4 text-xs sm:text-sm">
          <div className="border-b border-slate-200 pb-3 space-y-1">
            <h3 className="text-base font-bold text-slate-900" dir="auto">
              {profile.full_name || "—"}
            </h3>
            <p className="text-slate-600" dir="ltr">
              {profile.email || "—"}
            </p>
            {profile.target_role && (
              <p className="text-xs font-bold text-primary-700" dir="auto">
                الدور المستهدف: {profile.target_role}
              </p>
            )}
            <p className="text-[11px] text-slate-400" dir="ltr">
              ID: {profile.candidate_id}
            </p>
          </div>

          {Array.isArray(profile.skills) && profile.skills.length > 0 && (
            <div>
              <h4 className="font-bold text-slate-800 mb-1.5">المهارات</h4>
              <div className="flex flex-wrap gap-1.5">
                {profile.skills.map((skill, idx) => (
                  <span
                    key={`${skill}-${idx}`}
                    className="rounded-md bg-white border border-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700"
                    dir="auto"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(profile.experience) && profile.experience.length > 0 && (
            <div>
              <h4 className="font-bold text-slate-800 mb-1.5">الخبرات</h4>
              <div className="space-y-2">
                {profile.experience.map((exp, idx) => (
                  <div key={idx} className="rounded-lg bg-white border border-slate-200 p-2.5">
                    <p className="font-bold text-slate-900" dir="auto">
                      {exp?.title || "—"} {exp?.company ? `— ${exp.company}` : ""}
                    </p>
                    {exp?.duration_months != null && (
                      <p className="text-[11px] text-slate-500">
                        المدة: {exp.duration_months} شهر
                      </p>
                    )}
                    {exp?.description && (
                      <p className="mt-1 text-xs text-slate-600" dir="auto">
                        {exp.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(profile.projects) && profile.projects.length > 0 && (
            <div>
              <h4 className="font-bold text-slate-800 mb-1.5">المشاريع</h4>
              <div className="space-y-2">
                {profile.projects.map((proj, idx) => (
                  <div key={idx} className="rounded-lg bg-white border border-slate-200 p-2.5">
                    <p className="font-bold text-slate-900" dir="auto">
                      {proj?.title || "—"}
                    </p>
                    {Array.isArray(proj?.technologies) && proj.technologies.length > 0 && (
                      <p className="text-[11px] text-primary-700" dir="ltr">
                        {proj.technologies.join(", ")}
                      </p>
                    )}
                    {proj?.description && (
                      <p className="mt-1 text-xs text-slate-600" dir="auto">
                        {proj.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(profile.education) && profile.education.length > 0 && (
            <div>
              <h4 className="font-bold text-slate-800 mb-1.5">التعليم</h4>
              <div className="space-y-1.5">
                {profile.education.map((edu, idx) => (
                  <p key={idx} className="text-xs font-semibold text-slate-700" dir="auto">
                    {[edu?.degree, edu?.institution, edu?.year].filter(Boolean).join(" — ") || "—"}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>}
    {owner && <section className="card space-y-2"><h2 className="font-bold">سجل صلاحيات الدعم</h2>
      {ownerGrants.map((grant) => <div key={grant.grant_id} className="border-b pb-2"><p>{grant.candidate_id} — {grant.reason} — {grant.expires_at} {grant.revoked && "— ملغاة"}</p>
        {!grant.revoked && <><button className="underline ml-3" onClick={() => { setCreated(grant); setProfile(null); }}>اختيار</button><button className="underline" onClick={() => revoke(grant.grant_id)}>إلغاء</button></>}
      </div>)}
    </section>}
    <section className="card space-y-3"><h2 className="font-bold">صلاحيات الدعم لملفي</h2>
      {!grants.length && <p>لا توجد صلاحيات مسجلة.</p>}
      {grants.map((grant) => <div key={grant.grant_id} className="border-b pb-2"><p>{grant.reason} — تنتهي {grant.expires_at}</p>
        {grant.revoked ? <p>ملغاة</p> : <button className="underline" onClick={() => revoke(grant.grant_id)}>إلغاء الصلاحية</button>}
      </div>)}
    </section>
  </main>;
}
