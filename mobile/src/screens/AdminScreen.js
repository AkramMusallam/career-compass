import React, { useEffect, useState } from "react";
import Button from "../components/AppButton";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { companyRequest } from "../services/api";

const statuses = { pending: "قيد المراجعة", approved: "معتمدة", rejected: "مرفوضة", suspended: "معلّقة" };
const actions = [["approved", "اعتماد"], ["rejected", "رفض"], ["suspended", "تعليق"]];

export default function AdminScreen({ token, onBack }) {
  const [companies, setCompanies] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setBusy(true); setError("");
    try { setCompanies(await companyRequest(token, "/companies/review")); }
    catch (err) { setError(err.status === 403 ? "هذه الصفحة متاحة لمالك المنصة فقط." : "تعذر تحميل الشركات. تحقق من الاتصال وحاول مجددًا."); }
    finally { setBusy(false); }
  }
  useEffect(() => { load(); }, [token]);

  function changeStatus(company, status, label) {
    Alert.alert(`${label} الشركة`, `هل تريد ${label} شركة ${company.name}؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: label, style: status === "approved" ? "default" : "destructive", onPress: async () => {
        setBusy(true); setError(""); setNotice("");
        try {
          const updated = await companyRequest(token, `/companies/${encodeURIComponent(company.company_id)}/status`, null, "PATCH", { status });
          setCompanies((previous) => previous.map((item) => item.company_id === updated.company_id ? updated : item));
          setNotice(`تم تحديث حالة ${updated.name}.`);
        } catch { setError("تعذر تأكيد تحديث الحالة. أعد تحميل القائمة للتحقق."); }
        finally { setBusy(false); }
      } },
    ]);
  }

  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Button title="العودة للرئيسية" onPress={onBack} disabled={busy} />
    <Text style={styles.title}>إدارة المنصة</Text>
    {!!error && <Text style={styles.error}>{error}</Text>}{!!notice && <Text style={styles.notice}>{notice}</Text>}
    {busy && <ActivityIndicator color="#38bdf8" />}
    <Button title="تحديث القائمة" onPress={load} disabled={busy} />
    {companies && <><Text style={styles.text}>الشركات: {companies.length} · قيد المراجعة: {companies.filter((item) => item.status === "pending").length} · المعتمدة: {companies.filter((item) => item.status === "approved").length}</Text>
      {!companies.length && <Text style={styles.text}>لا توجد شركات حتى الآن.</Text>}
      {companies.map((item) => <View style={styles.card} key={item.company_id}><Text style={styles.heading}>{item.name}</Text><Text style={styles.text}>الحالة: {statuses[item.status] || item.status}</Text><Text style={styles.text}>رقم المالك: {item.owner_id}</Text>{actions.map(([status, label]) => <Button key={status} title={label} onPress={() => changeStatus(item, status, label)} disabled={busy || item.status === status} />)}</View>)}
    </>}
  </ScrollView>;
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: "#0f172a" }, content: { padding: 20, gap: 12 }, title: { color: "white", fontSize: 24, fontWeight: "bold", textAlign: "right" }, heading: { color: "#e2e8f0", fontSize: 17, fontWeight: "bold", textAlign: "right" }, text: { color: "#cbd5e1", fontSize: 15, textAlign: "right" }, error: { color: "#fca5a5", textAlign: "right" }, notice: { color: "#a7f3d0", textAlign: "right" }, card: { padding: 14, backgroundColor: "#1e293b", borderRadius: 10, gap: 8 } });
