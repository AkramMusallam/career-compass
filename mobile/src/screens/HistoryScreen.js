import React, { useEffect, useState } from "react";
import Button from "../components/AppButton";
import { ActivityIndicator, BackHandler, ScrollView, StyleSheet, Text, View } from "react-native";
import { analysisRequest } from "../services/api";
import ResultDetails from "./ResultDetails";

export default function HistoryScreen({ token, onBack }) {
  const [history, setHistory] = useState(null);
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setBusy(true); setError(""); setHistory(null);
    try { setHistory(await analysisRequest(token, `/history?page=${page}&limit=10`)); }
    catch { setError("تعذر تحميل سجل التحليلات. تحقق من الاتصال وحاول مرة أخرى."); }
    finally { setBusy(false); }
  }
  useEffect(() => { load(); }, [token, page]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { if (!busy) { if (detail) setDetail(null); else onBack(); } return true; });
    return () => subscription.remove();
  }, [busy, detail, onBack]);

  async function open(id) {
    setBusy(true); setError("");
    try { setDetail(await analysisRequest(token, `/history/${encodeURIComponent(id)}`)); }
    catch { setError("تعذر تحميل تفاصيل التحليل. حاول مرة أخرى."); }
    finally { setBusy(false); }
  }

  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Button title={detail ? "العودة للسجل" : "العودة للرئيسية"} onPress={() => detail ? setDetail(null) : onBack()} disabled={busy} />
    <Text style={styles.title}>{detail ? "تفاصيل التحليل" : "سجل التحليلات"}</Text>
    {!!error && <Text style={styles.error}>{error}</Text>}
    {busy && <ActivityIndicator color="#38bdf8" />}
    {!history && !busy && <Button title="إعادة المحاولة" onPress={load} />}
    {detail ? <ResultDetails result={detail} /> : history && <>
      {!history.analyses.length && <Text style={styles.text}>لا توجد تحليلات بعد. ابدأ تحليلًا من الرئيسية.</Text>}
      {history.analyses.map((item) => <View style={styles.card} key={item.analysis_id}><Text style={styles.heading}>{item.top_job_title}</Text><Text style={styles.text}>الدرجة: {Math.round(item.career_score)}% · {new Date(item.date).toLocaleDateString()}</Text><Button title="عرض التفاصيل" onPress={() => open(item.analysis_id)} disabled={busy} /></View>)}
      <Text style={styles.text}>صفحة {page} · المجموع {history.total}</Text>
      {page > 1 && <Button title="الصفحة السابقة" onPress={() => setPage(page - 1)} disabled={busy} />}
      {page * history.limit < history.total && <Button title="الصفحة التالية" onPress={() => setPage(page + 1)} disabled={busy} />}
    </>}
  </ScrollView>;
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: "#0f172a" }, content: { padding: 20, gap: 12 }, title: { color: "white", fontSize: 24, fontWeight: "bold", textAlign: "right" }, heading: { color: "#e2e8f0", fontSize: 17, fontWeight: "bold", textAlign: "right", marginVertical: 5 }, text: { color: "#cbd5e1", fontSize: 15, textAlign: "right", marginVertical: 4 }, error: { color: "#fca5a5", textAlign: "right" }, card: { padding: 14, backgroundColor: "#1e293b", borderRadius: 10, gap: 8 } });
