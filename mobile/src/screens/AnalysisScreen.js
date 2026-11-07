import React, { useState } from "react";
import { ActivityIndicator, Button, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { analysisRequest } from "../services/api";

export default function AnalysisScreen({ token, onBack }) {
  const [stage, setStage] = useState("upload");
  const [data, setData] = useState(null);
  const [skills, setSkills] = useState("");
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(action) {
    setBusy(true);
    setError("");
    try { await action(); } catch (err) { setError(err.message || "تعذر الاتصال بالخادم. حاول مرة أخرى."); } finally { setBusy(false); }
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
      await analysisRequest(token, "/extract/confirm", { extraction_id: data.extraction_id, skills: list, projects: data.projects, education: data.education, experience: data.experience });
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
      const analysis = await analysisRequest(token, "/analyze", { extraction_id: data.extraction_id, assessment_id: assessment.assessment_id });
      setResult(analysis);
      setStage("result");
    });
  }

  function choose(q, option) {
    setAnswers((previous) => {
      if (q.type !== "multiple_choice") return { ...previous, [q.id]: option };
      const selected = previous[q.id] || [];
      return { ...previous, [q.id]: selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option] };
    });
  }

  return <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Button title="رجوع للرئيسية" onPress={onBack} disabled={busy} />
    <Text style={styles.title}>تحليلك المهني</Text>
    {!!error && <Text style={styles.error}>{error}</Text>}
    {busy && <ActivityIndicator color="#38bdf8" />}
    {stage === "upload" && <><Text style={styles.text}>ارفع سيرتك الذاتية بصيغة PDF للبدء.</Text><Button title="اختيار السيرة الذاتية" onPress={selectCV} disabled={busy} /></>}
    {stage === "review" && <>
      <Text style={styles.text}>راجع المهارات وعدّلها، وافصل بينها بفاصلة.</Text>
      <TextInput style={styles.input} multiline value={skills} onChangeText={setSkills} editable={!busy} accessibilityLabel="المهارات" />
      {[["المشاريع", data.projects, "title"], ["التعليم", data.education, "degree"], ["الخبرة", data.experience, "title"]].map(([label, items, field]) => <View key={label}><Text style={styles.heading}>{label}</Text>{items.length ? items.map((item, index) => <Text key={index} style={styles.text}>{item[field]} {item.company || item.institution || ""}</Text>) : <Text style={styles.text}>لا يوجد</Text>}</View>)}
      <Text style={styles.text}>لتعديل المشاريع والتعليم والخبرة استخدم الموقع حاليًا.</Text>
      <Button title="تأكيد والانتقال للتقييم" onPress={confirm} disabled={busy} />
    </>}
    {stage === "assessment" && <>{questions.map((q) => <View key={q.id}><Text style={styles.heading}>{q.text}{q.required ? " *" : ""}</Text>{(q.type === "scale" ? [1, 2, 3, 4, 5] : q.options).map((option) => <View key={String(option)} style={styles.option}><Button title={`${(Array.isArray(answers[q.id]) ? answers[q.id].includes(option) : answers[q.id] === option) ? "✓ " : ""}${option}`} onPress={() => choose(q, option)} disabled={busy} /></View>)}</View>)}<Button title="عرض التحليل" onPress={submit} disabled={busy} /></>}
    {stage === "result" && <><Text style={styles.heading}>درجة الجاهزية: {Math.round(result.career_score)}%</Text>{result.top_jobs.map((job, index) => <Text key={index} style={styles.text}>{job.job_title} — {Math.round(job.match_percentage)}%</Text>)}<Text style={styles.text}>تم حفظ النتيجة. يمكنك متابعة خطة التعلم من الرئيسية.</Text><Button title="العودة للرئيسية" onPress={onBack} /></>}
  </ScrollView>;
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: "#0f172a" }, content: { padding: 20, gap: 12 }, title: { color: "white", fontSize: 24, fontWeight: "bold", textAlign: "right" }, heading: { color: "#e2e8f0", fontSize: 17, fontWeight: "bold", marginVertical: 10, textAlign: "right" }, text: { color: "#cbd5e1", fontSize: 15, marginVertical: 4, textAlign: "right" }, error: { color: "#fca5a5", textAlign: "right" }, input: { color: "white", borderWidth: 1, borderColor: "#64748b", borderRadius: 8, padding: 12, minHeight: 80, textAlign: "right" }, option: { marginVertical: 3 } });
