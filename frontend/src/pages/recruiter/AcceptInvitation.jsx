import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import apiClient, { getErrorMessage } from "../../api/client";
import { readFragmentToken } from "../../utils/fragmentToken";

export default function AcceptInvitation() {
  const { token: routeToken } = useParams();
  const [token] = useState(() =>
    readFragmentToken({ paramToken: routeToken, cleanPath: "/company-invitation" })
  );
  const [message, setMessage] = useState(
    token ? "" : "رابط الدعوة غير مكتمل أو مفقود."
  );
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const accept = async () => {
    if (!token) return;
    setBusy(true);
    try {
      await apiClient.post("/companies/invitations/accept", { token });
      setAccepted(true);
      setMessage("تم قبول الدعوة والانضمام إلى الشركة.");
    } catch (error) { setMessage(getErrorMessage(error, "تعذر قبول الدعوة")); }
    finally { setBusy(false); }
  };
  return <main className="mx-auto max-w-xl space-y-4 p-6" dir="rtl">
    <h1 className="text-2xl font-bold">دعوة للانضمام إلى شركة</h1>
    <p>سجّل الدخول بالحساب المؤكد المطابق للبريد الذي وصلته الدعوة.</p>
    {message && <p role="status">{message}</p>}
    {!accepted && <button className="btn-primary" disabled={busy || !token} onClick={accept}>قبول الدعوة</button>}
    <Link className="block underline" to="/companies">الشركات</Link>
  </main>;
}
