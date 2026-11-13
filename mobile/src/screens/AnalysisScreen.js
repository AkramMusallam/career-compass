import React, { useCallback, useEffect, useRef, useState } from "react";
import Button from "../components/AppButton";
import { ActivityIndicator, Alert, AppState, BackHandler, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as SecureStore from "expo-secure-store";
import { analysisRequest, fetchProfile } from "../services/api";
import { prepareReview } from "../services/review";
import { createDraftStore } from "../services/draft";
import ResultDetails from "./ResultDetails";

const sections = [
  { key: "projects", label: "المشاريع", fields: [["title", "اسم المشروع"], ["description", "الوصف"], ["technologies", "التقنيات، مفصولة بفاصلة"]], empty: { title: "", description: "", technologies: [] } },
  { key: "education", label: "التعليم", fields: [["degree", "الشهادة"], ["institution", "المؤسسة"], ["year", "سنة التخرج"]], empty: { degree: "", institution: "", year: null } },
  { key: "experience", label: "الخبرة", fields: [["title", "المسمى الوظيفي"], ["company", "الشركة"], ["duration_months", "المدة بالأشهر"], ["description", "الوصف"]], empty: { title: "", company: "", duration_months: 0, description: "" } },
];

export default function AnalysisScreen({ token, onBack }) {
  const [stage, setStage] = useState("upload");
  const [data, setData] = useState(null);
  const [skills, setSkills] = useState("");
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [draftWarning, setDraftWarning] = useState("");
  const draftStore = useRef(null);
  const draftFinished = useRef(false);
  const busyRef = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const user = await fetchProfile(token);
        const store = createDraftStore(SecureStore, user.id);
        const draft = await store.load();
        if (!active) return;
        draftStore.current = store;
        if (draft && (draft.stage === "review" || draft.stage === "assessment") && draft.data?.extraction_id) {
          setData(draft.data); setSkills(draft.skills || ""); setQuestions(draft.questions || []); setAnswers(draft.answers || {}); setStage(draft.stage);
        }
      } catch { if (active) setDraftWarning("تعذر استعادة أو تفعيل الحفظ الآمن للمسودة. تحقق من الاتصال وأعد فتح التحليل."); }
      finally { if (active) setDraftReady(true); }
    })();
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (!draftReady || !draftStore.current || !data || (stage !== "review" && stage !== "assessment")) return;
    const save = () => { if (!draftFinished.current) draftStore.current.save({ stage, data, skills, questions, answers }).then(() => setDraftWarning("")).catch(() => setDraftWarning("تعذر حفظ المسودة آمنًا. احتفظ بالشاشة مفتوحة وحاول مرة أخرى.")); };
    const timer = setTimeout(save, 400);
    const subscription = AppState.addEventListener("change", (state) => { if (state !== "active") { clearTimeout(timer); save(); } });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [draftReady, stage, data, skills, questions, answers]);

  const leave = useCallback(() => {
    if (busyRef.current) return;
    if (stage === "review" || stage === "assessment") {
      Alert.alert("مغادرة التحليل؟", draftWarning ? "قد لا تُحفظ آخر التعديلات. هل تريد المغادرة؟" : "سيحاول التطبيق حفظ المسودة آمنًا على هذا الجهاز.", [
        { text: "متابعة التحليل", style: "cancel" },
        { text: "مغادرة", onPress: async () => {
          try { if (draftStore.current) await draftStore.current.save({ stage, data, skills, questions, answers }); }
          catch { Alert.alert("تعذر حفظ المسودة", "ابقَ في الشاشة حتى تستعيد الاتصال أو الحفظ الآمن."); return; }
          onBack();
        } },
      ]);
    } else onBack();
  }, [stage, onBack, draftWarning, data, skills, questions, answers]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { leave(); return true; });
    return () => subscription.remove();
  }, [leave]);

  async function run(action) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try { await action(); } catch (err) { setError(err.message || "تعذر الاتصال بالخادم. حاول مرة أخرى."); } finally { busyRef.current = false; setBusy(false); }
  }

  async function selectCV() {
    await run(async () => {
      const selected = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
      if (selected.canceled) return;
      const file = selected.assets[0];
      if (!file.name.toLowerCase().endsWith(".pdf") || (file.size && file.size > 5 * 1024 * 1024)) throw new Error("اختر ملف PDF بحجم لا يزيد عن 5 ميجابايت.");
      const form = new FormData();
      form.append("file", { uri: file.uri, name: file.name, type: "application/pdf" });
      const uploaded = await analysisRequest(token, "/upload-cv", form);
      const extracted = await analysisRequest(token, "/extract", { file_id: uploaded.file_id });
      setData(extracted);
      setSkills(extracted.skills.join(", "));
      setStage("review");
    });
  }

  async function confirm() {
    await run(async () => {
      const list = skills.split(/[,،\n]/).map((s) => s.trim()).filter(Boolean);
      if (!list.length) throw new Error("أضف مهارة واحدة على الأقل.");
      await analysisRequest(token, "/extract/confirm", prepareReview(data, list));
      const response = await analysisRequest(token, "/assessment");
      setQuestions(response.questions);
      setStage("assessment");
    });
  }

  async function submit() {
    await run(async () => {
      if (questions.some((q) => q.required && (answers[q.id] == null || (Array.isArray(answers[q.id]) && !answers[q.id].length)))) throw new Error("أجب عن جميع الأسئلة المطلوبة.");
      const payload = questions.filter((q) => answers[q.id] != null).map((q) => ({ question_id: q.id, value: answers[q.id] }));
      const assessment = await analysisRequest(token, "/assessment", { answers: payload });
      let analysis;
      try {
        analysis = await analysisRequest(token, "/analyze", { extraction_id: data.extraction_id, assessment_id: assessment.assessment_id });
      } catch (err) {
        if (!err.status) throw new Error("تعذر تأكيد اكتمال التحليل. تحقق من سجل التحليلات قبل المحاولة مجددًا، فقد تكون النتيجة حُفظت.");
        throw err;
      }
      draftFinished.current = true;
      setResult(analysis);
      setStage("result");
      if (draftStore.current) await draftStore.current.clear().catch(() => setDraftWarning("تم التحليل، لكن تعذر حذف المسودة المحلية."));
    });
  }

  function choose(q, option) {
    setAnswers((previous) => {
      if (q.type !== "multiple_choice") return { ...previous, [q.id]: option };
      const selected = previous[q.id] || [];
      return { ...previous, [q.id]: selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option] };
    });
  }

  function updateItem(section, index, field, value) {
    setData((previous) => ({ ...previous, [section]: previous[section].map((item, i) => i === index ? { ...item, [field]: value } : item) }));
  }

  return <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Button title="رجوع للرئيسية" onPress={leave} disabled={busy} />
    <Text style={styles.title}>تحليلك المهني</Text>
    {!!error && <Text style={styles.error}>{error}</Text>}
    {!!draftWarning && <Text style={styles.error}>{draftWarning}</Text>}
    {!draftReady && <ActivityIndicator color="#38bdf8" />}
    {busy && <ActivityIndicator color="#38bdf8" />}
    {draftReady && stage === "upload" && <><Text style={styles.text}>ارفع سيرتك الذاتية بصيغة PDF للبدء.</Text><Button title="اختيار السيرة الذاتية" onPress={selectCV} disabled={busy} /></>}
    {stage === "review" && <>
      <Text style={styles.text}>راجع المهارات وعدّلها، وافصل بينها بفاصلة.</Text>
      <TextInput style={styles.input} multiline value={skills} onChangeText={setSkills} editable={!busy} accessibilityLabel="المهارات" />
      {sections.map(({ key, label, fields, empty }) => <View key={key}>
        <Text style={styles.heading}>{label}</Text>
        {data[key].map((item, index) => <View key={index} style={styles.card}>
          {fields.map(([field, title]) => <View key={field}>
            <Text style={styles.text}>{title}</Text>
            <TextInput style={styles.field} value={Array.isArray(item[field]) ? item[field].join(", ") : String(item[field] ?? "")} onChangeText={(value) => updateItem(key, index, field, value)} editable={!busy} accessibilityLabel={`${title} ${index + 1}`} keyboardType={field === "year" || field === "duration_months" ? "number-pad" : "default"} />
          </View>)}
          <Button title={`حذف ${label}`} color="#b91c1c" disabled={busy} onPress={() => setData((previous) => ({ ...previous, [key]: previous[key].filter((_, i) => i !== index) }))} />
        </View>)}
        <Button title={`إضافة ${label}`} disabled={busy} onPress={() => setData((previous) => ({ ...previous, [key]: [...previous[key], { ...empty }] }))} />
      </View>)}
      <Button title="تأكيد والانتقال للتقييم" onPress={confirm} disabled={busy} />
    </>}
    {stage === "assessment" && <>{questions.map((q) => <View key={q.id}><Text style={styles.heading}>{q.text}{q.required ? " *" : ""}</Text>{(q.type === "scale" ? [1, 2, 3, 4, 5] : q.options).map((option) => <View key={String(option)} style={styles.option}><Button title={`${(Array.isArray(answers[q.id]) ? answers[q.id].includes(option) : answers[q.id] === option) ? "✓ " : ""}${option}`} onPress={() => choose(q, option)} disabled={busy} /></View>)}</View>)}<Button title="عرض التحليل" onPress={submit} disabled={busy} /></>}
    {stage === "result" && <><ResultDetails result={result} /><Text style={styles.text}>تم حفظ النتيجة. يمكنك متابعة خطة التعلم من الرئيسية.</Text><Button title="العودة للرئيسية" onPress={onBack} /></>}
  </ScrollView>;
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: "#0f172a" }, content: { padding: 20, gap: 12 }, title: { color: "white", fontSize: 24, fontWeight: "bold", textAlign: "right" }, heading: { color: "#e2e8f0", fontSize: 17, fontWeight: "bold", marginVertical: 10, textAlign: "right" }, text: { color: "#cbd5e1", fontSize: 15, marginVertical: 4, textAlign: "right" }, error: { color: "#fca5a5", textAlign: "right" }, input: { color: "white", borderWidth: 1, borderColor: "#64748b", borderRadius: 8, padding: 12, minHeight: 80, textAlign: "right" }, card: { padding: 12, marginBottom: 12, backgroundColor: "#1e293b", borderRadius: 10, gap: 8 }, field: { color: "white", borderWidth: 1, borderColor: "#64748b", borderRadius: 8, padding: 10, textAlign: "right" }, option: { marginVertical: 3 } });
