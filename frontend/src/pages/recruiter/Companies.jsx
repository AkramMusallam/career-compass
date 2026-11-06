import { useEffect, useState } from "react";
import apiClient, { getErrorMessage } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Link } from "react-router-dom";

export default function Companies() {
  const [name, setName] = useState("");
  const [mine, setMine] = useState([]);
  const [review, setReview] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteStatus, setInviteStatus] = useState("");
  const { user } = useAuth();

  const load = async () => {
    try {
      const response = await apiClient.get("/companies/mine");
      setMine(response.data);
      try {
        const reviews = await apiClient.get("/companies/review");
        setReview(reviews.data);
      } catch (err) {
        if (err.response?.status === 403) setReview(null);
        else throw err;
      }
      setError("");
    } catch (err) {
      setError(getErrorMessage(err, "تعذر تحميل الشركات"));
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await apiClient.post("/companies", { name });
      setName("");
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "تعذر إرسال الطلب"));
    } finally { setBusy(false); }
  };

  const update = async (companyId, status) => {
    setBusy(true);
    try {
      await apiClient.patch(`/companies/${companyId}/status`, { status });
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "تعذر تحديث حالة الشركة"));
    } finally { setBusy(false); }
  };

  const invite = async (event, companyId) => {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await apiClient.post(`/companies/${companyId}/invitations`, { email: inviteEmail });
      setInviteStatus(response.data.delivery === "sent" ? "تم إرسال الدعوة." : "تعذر إرسال الدعوة؛ تحقق من إعداد البريد.");
      setInviteEmail("");
    } catch (err) { setError(getErrorMessage(err, "تعذر إنشاء الدعوة")); }
    finally { setBusy(false); }
  };

  const removeMember = async (companyId, memberId) => {
    setBusy(true);
    try { await apiClient.delete(`/companies/${companyId}/members/${memberId}`); await load(); }
    catch (err) { setError(getErrorMessage(err, "تعذر إزالة العضو")); }
    finally { setBusy(false); }
  };

  const rename = async (company) => {
    const updated = window.prompt("اسم الشركة", company.name);
    if (!updated?.trim()) return;
    setBusy(true);
    try { await apiClient.put(`/companies/${company.company_id}`, { name: updated.trim() }); await load(); }
    catch (err) { setError(getErrorMessage(err, "تعذر تحديث الشركة")); }
    finally { setBusy(false); }
  };

  const labels = { pending: "قيد المراجعة", approved: "معتمدة", rejected: "مرفوضة", suspended: "موقوفة" };
  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6" dir="rtl">
      <h1 className="text-2xl font-bold">الشركات</h1>
      <p>اختر شركة معتمدة للدخول إلى وظائفها وفريقها.</p>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <form onSubmit={submit} className="card space-y-3">
        <label className="block font-bold" htmlFor="company-name">اسم الشركة</label>
        <input id="company-name" className="w-full rounded border p-2" maxLength={200} required value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary" disabled={busy || !name.trim()}>إرسال طلب شركة</button>
      </form>
      <section className="card space-y-3">
        <h2 className="text-lg font-bold">طلباتي</h2>
        {!mine.length && <p>لا توجد طلبات.</p>}
        {mine.map((company) => <div key={company.company_id}>
          <p>{company.name} — {labels[company.status]}</p>
          {company.status === "approved" && <Link to="/recruiter" className="underline" onClick={() => localStorage.setItem("active_company_id", company.company_id)}>فتح بوابة الشركة</Link>}
          {String(company.owner_id) === String(user?.id) && <div className="space-y-1">
            <button type="button" className="underline" disabled={busy} onClick={() => rename(company)}>تعديل اسم الشركة</button>
            {(company.members || []).map((memberId) => <div key={memberId}>عضو رقم {memberId} <button type="button" className="underline" disabled={busy} onClick={() => removeMember(company.company_id, memberId)}>إزالة</button></div>)}
          </div>}
          {company.status === "approved" && String(company.owner_id) === String(user?.id) && <form onSubmit={(e) => invite(e, company.company_id)} className="flex flex-wrap gap-2 mt-2">
            <label htmlFor={`invite-${company.company_id}`}>بريد عضو الفريق</label>
            <input id={`invite-${company.company_id}`} type="email" required className="rounded border p-1" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
            <button className="rounded border px-3" disabled={busy}>إرسال دعوة</button>
          </form>}
        </div>)}
        {inviteStatus && <p role="status">{inviteStatus}</p>}
      </section>
      {review && <section className="card space-y-4">
        <h2 className="text-lg font-bold">مراجعة الشركات</h2>
        {review.map((company) => <div key={company.company_id} className="border-b pb-3">
          <p>{company.name} — {labels[company.status]} — رقم المالك: {company.owner_id}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {["approved", "rejected", "suspended"].map((status) => <button key={status} type="button" disabled={busy || company.status === status} className="rounded border px-3 py-1 disabled:opacity-50" onClick={() => update(company.company_id, status)}>{labels[status]}</button>)}
          </div>
        </div>)}
      </section>}
    </main>
  );
}
