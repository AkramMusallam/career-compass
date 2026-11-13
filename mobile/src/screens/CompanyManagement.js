import React, { useState } from "react";
import Button from "../components/AppButton";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { companyRequest } from "../services/api";

export default function CompanyManagement({ token, companies, userId, onCompaniesChange }) {
  const [name, setName] = useState("");
  const [invitation, setInvitation] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [members, setMembers] = useState({});
  const [renameId, setRenameId] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  async function run(action, failure) {
    setBusy(true); setError(""); setMessage("");
    try { await action(); } catch (err) { setError(err.status === 404 ? "الخدمة غير متاحة أو لا تملك صلاحيتها. تحقق من تحديث الخادم وصلاحيات الشركة." : failure); } finally { setBusy(false); }
  }
  async function refresh() { onCompaniesChange(await companyRequest(token, "/companies/mine")); }

  function loadMembers(company) {
    run(async () => {
      const result = await companyRequest(token, `/companies/${encodeURIComponent(company.company_id)}/members`);
      setMembers((previous) => ({ ...previous, [company.company_id]: result }));
    }, "تعذر تحميل أعضاء الفريق. تحقق من الصلاحية والاتصال.");
  }
  function rename(company) {
    const value = renameValue.trim();
    if (!value) { setError("أدخل اسم الشركة."); return; }
    run(async () => {
      const updated = await companyRequest(token, `/companies/${encodeURIComponent(company.company_id)}`, null, "PUT", { name: value });
      onCompaniesChange((previous) => previous.map((item) => item.company_id === updated.company_id ? updated : item));
      setRenameId(null); setMessage("تم تحديث اسم الشركة.");
    }, "تعذر تأكيد تعديل الاسم. أعد فتح الصفحة للتحقق.");
  }

  function apply() {
    if (!name.trim()) { setError("أدخل اسم الشركة."); return; }
    run(async () => {
      const result = await companyRequest(token, "/companies", null, "POST", { name: name.trim() });
      onCompaniesChange((previous) => [result, ...previous]); setName(""); setMessage("تم إرسال طلب الشركة للمراجعة.");
    }, "تعذر تأكيد إرسال الطلب. حدّث الصفحة وتحقق من قائمة الشركات قبل إعادة المحاولة.");
  }
  function accept() {
    const value = invitation.trim();
    const match = value.match(/\/company-invitation\/([^/?#]+)(?:[/?#]|$)/);
    const inviteToken = match ? match[1] : value;
    if (!inviteToken || inviteToken.length > 200 || /[\s/]/.test(inviteToken)) { setError("أدخل رمز الدعوة أو رابطها الصحيح."); return; }
    run(async () => {
      const result = await companyRequest(token, "/companies/invitations/accept", null, "POST", { token: inviteToken });
      onCompaniesChange((previous) => [result, ...previous.filter((item) => item.company_id !== result.company_id)]);
      setInvitation(""); setMessage("تم قبول الدعوة.");
    }, "تعذر قبول الدعوة. تحقق من صلاحيتها ومن تسجيل الدخول بالبريد المدعو.");
  }
  function invite(company) {
    const value = email.trim();
    if (!value || !value.includes("@")) { setError("أدخل بريد العضو."); return; }
    run(async () => {
      const result = await companyRequest(token, `/companies/${encodeURIComponent(company.company_id)}/invitations`, null, "POST", { email: value });
      if (result.delivery === "sent") { setEmail(""); setMessage("تم إرسال الدعوة بالبريد."); }
      else setError("لم تُرسل الدعوة. تحقق من إعداد البريد على الخادم.");
    }, "تعذر تأكيد إرسال الدعوة. تحقق من سجل الدعوات قبل المحاولة مجددًا.");
  }
  function remove(company, memberId) {
    Alert.alert("إزالة عضو", `هل تريد إزالة العضو رقم ${memberId} من ${company.name}؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "إزالة", style: "destructive", onPress: () => run(async () => {
        await companyRequest(token, `/companies/${encodeURIComponent(company.company_id)}/members/${encodeURIComponent(memberId)}`, null, "DELETE");
        await refresh(); setMembers((previous) => ({ ...previous, [company.company_id]: (previous[company.company_id] || []).filter((member) => member.id !== memberId) })); setMessage("تمت إزالة العضو.");
      }, "تعذرت إزالة العضو أو تحديث القائمة. أعد فتح الصفحة للتحقق.") },
    ]);
  }

  return <View style={styles.container}>
    {!!error && <Text style={styles.error}>{error}</Text>}{!!message && <Text style={styles.message}>{message}</Text>}
    <Text style={styles.heading}>طلب شركة جديدة</Text><TextInput style={styles.input} value={name} onChangeText={setName} editable={!busy} maxLength={200} accessibilityLabel="اسم الشركة" placeholder="اسم الشركة" placeholderTextColor="#94a3b8" /><Button title="إرسال طلب شركة" onPress={apply} disabled={busy} />
    <Text style={styles.heading}>قبول دعوة فريق</Text><TextInput style={styles.input} value={invitation} onChangeText={setInvitation} editable={!busy} autoCapitalize="none" accessibilityLabel="رمز الدعوة أو رابطها" placeholder="رمز الدعوة أو رابطها" placeholderTextColor="#94a3b8" /><Button title="قبول الدعوة" onPress={accept} disabled={busy} />
    {companies.filter((item) => String(item.owner_id) === String(userId)).map((item) => <View style={styles.card} key={item.company_id}>
      <Text style={styles.heading}>إدارة فريق {item.name}</Text>
      {renameId === item.company_id ? <><TextInput style={styles.input} value={renameValue} onChangeText={setRenameValue} editable={!busy} maxLength={200} accessibilityLabel="اسم الشركة الجديد" /><Button title="حفظ اسم الشركة" onPress={() => rename(item)} disabled={busy} /><Button title="إلغاء التعديل" onPress={() => setRenameId(null)} disabled={busy} /></> : <Button title="تعديل اسم الشركة" onPress={() => { setRenameId(item.company_id); setRenameValue(item.name); }} disabled={busy} />}
      <Button title="عرض أعضاء الفريق" onPress={() => loadMembers(item)} disabled={busy} />
      {members[item.company_id] && !members[item.company_id].length && <Text style={styles.text}>لا يوجد أعضاء آخرون.</Text>}
      {(members[item.company_id] || []).map((member) => <View key={String(member.id)} style={styles.member}><Text style={styles.text}>{member.full_name} · {member.email}</Text><Button title="إزالة العضو" color="#b91c1c" disabled={busy} onPress={() => remove(item, member.id)} /></View>)}
      {item.status === "approved" && <><TextInput style={styles.input} value={email} onChangeText={setEmail} editable={!busy} autoCapitalize="none" keyboardType="email-address" accessibilityLabel={`بريد عضو فريق ${item.name}`} placeholder="بريد عضو الفريق" placeholderTextColor="#94a3b8" /><Button title={`إرسال دعوة لفريق ${item.name}`} onPress={() => invite(item)} disabled={busy} /></>}
    </View>)}
  </View>;
}

const styles = StyleSheet.create({ container: { gap: 10 }, card: { backgroundColor: "#1e293b", padding: 14, borderRadius: 10, gap: 8 }, member: { gap: 6 }, heading: { color: "#e2e8f0", fontSize: 16, fontWeight: "bold", textAlign: "right" }, text: { color: "#cbd5e1", textAlign: "right" }, error: { color: "#fca5a5", textAlign: "right" }, message: { color: "#a7f3d0", textAlign: "right" }, input: { color: "white", borderWidth: 1, borderColor: "#64748b", borderRadius: 8, padding: 10, textAlign: "right" } });
