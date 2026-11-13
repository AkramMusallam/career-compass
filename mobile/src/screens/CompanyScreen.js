import React, { useEffect, useState } from "react";
import Button from "../components/AppButton";
import { ActivityIndicator, Alert, BackHandler, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { companyRequest, fetchProfile } from "../services/api";
import CompanyManagement from "./CompanyManagement";

const statuses = { pending: "قيد المراجعة", approved: "معتمدة", rejected: "مرفوضة", suspended: "معلّقة" };
const stages = [["discovered", "مكتشف"], ["shortlisted", "القائمة المختصرة"], ["contacted", "تم التواصل"], ["interviewed", "تمت المقابلة"], ["offered", "تم تقديم عرض"], ["rejected", "مرفوض"]];
const emptyJob = { title: "", description: "", field: "", experience_level: "", location: "", work_type: "", required_skills: "" };
const fields = [["title", "المسمى الوظيفي", 200], ["description", "وصف الوظيفة", 4000], ["field", "المجال", 150], ["experience_level", "مستوى الخبرة", 100], ["location", "الموقع", 150], ["work_type", "نوع العمل", 100], ["required_skills", "المهارات المطلوبة، مفصولة بفاصلة", 1000]];

export default function CompanyScreen({ token, onBack }) {
  const [companies, setCompanies] = useState(null);
  const [userId, setUserId] = useState(null);
  const [company, setCompany] = useState(null);
  const [jobs, setJobs] = useState(null);
  const [job, setJob] = useState(null);
  const [candidates, setCandidates] = useState(null);
  const [candidate, setCandidate] = useState(null);
  const [profile, setProfile] = useState(null);
  const [stage, setStage] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(null);

  async function loadCompanies() {
    setBusy(true); setError("");
    try { const [result, user] = await Promise.all([companyRequest(token, "/companies/mine"), fetchProfile(token)]); setCompanies(result); setUserId(user.id); }
    catch { setError("تعذر تحميل الشركات. تحقق من الاتصال وحاول مرة أخرى."); }
    finally { setBusy(false); }
  }
  useEffect(() => { loadCompanies(); }, [token]);

  async function openCompany(selected) {
    if (selected.status !== "approved") return;
    setBusy(true); setError("");
    try {
      const result = await companyRequest(token, "/recruiter/jobs", selected.company_id);
      setJobs(result); setCompany(selected);
    } catch { setError("تعذر تحميل وظائف الشركة. تحقق من عضويتك وحالة الشركة وحاول مرة أخرى."); }
    finally { setBusy(false); }
  }

  async function openJob(selected) {
    setBusy(true); setError("");
    try {
      const result = await companyRequest(token, `/recruiter/jobs/${encodeURIComponent(selected.job_id)}/candidates`, company.company_id);
      setCandidates(result.candidates); setJob(selected);
    } catch { setError("تعذر تحميل المرشحين. حاول مرة أخرى."); }
    finally { setBusy(false); }
  }

  async function openCandidate(selected) {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await companyRequest(token, `/recruiter/candidates/${encodeURIComponent(selected.candidate_id)}/profile`, company.company_id);
      setProfile(result); setCandidate(selected);
      setStage(selected.pipeline_status); setNotes(selected.notes || "");
    } catch { setError("تعذر عرض ملف المرشح. ربما لم تعد موافقته سارية؛ أعد تحميل قائمة المرشحين."); }
    finally { setBusy(false); }
  }

  async function saveCandidate() {
    setBusy(true); setError(""); setNotice("");
    try {
      await companyRequest(token, `/recruiter/jobs/${encodeURIComponent(job.job_id)}/candidates/${encodeURIComponent(candidate.candidate_id)}/status`, company.company_id, "POST", { pipeline_status: stage, notes });
      setCandidates((previous) => previous.map((item) => item.candidate_id === candidate.candidate_id ? { ...item, pipeline_status: stage, notes } : item));
      setCandidate((previous) => ({ ...previous, pipeline_status: stage, notes }));
      setNotice("تم حفظ مرحلة المرشح والملاحظات لهذه الوظيفة.");
    } catch { setError("تعذر تأكيد الحفظ. أعد تحميل المرشحين للتحقق من التغييرات والموافقة."); }
    finally { setBusy(false); }
  }

  function back() {
    setError(""); setNotice("");
    if (candidate && (stage !== candidate.pipeline_status || notes !== (candidate.notes || ""))) {
      Alert.alert("مغادرة دون حفظ؟", "ستفقد التغييرات على مرحلة المرشح والملاحظات.", [{ text: "متابعة التعديل", style: "cancel" }, { text: "مغادرة", style: "destructive", onPress: () => { setCandidate(null); setProfile(null); } }]);
    }
    else if (candidate) { setCandidate(null); setProfile(null); }
    else if (form) { Alert.alert("مغادرة دون حفظ؟", "ستفقد تغييرات الوظيفة.", [{ text: "متابعة التعديل", style: "cancel" }, { text: "مغادرة", style: "destructive", onPress: () => { setForm(null); setEditing(null); } }]); }
    else if (job) { setJob(null); setCandidates(null); }
    else if (company) { setCompany(null); setJobs(null); }
    else onBack();
  }

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { if (!busy) back(); return true; });
    return () => subscription.remove();
  }, [busy, candidate, form, job, company, stage, notes]);

  function editJob(item) {
    setError(""); setNotice(""); setEditing(item || null);
    setForm(item ? { title: item.title, description: item.description, field: item.field, experience_level: item.experience_level, location: item.location, work_type: item.work_type, required_skills: item.required_skills.join(", ") } : { ...emptyJob });
  }

  async function saveJob() {
    const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()]));
    payload.required_skills = payload.required_skills.split(/[,،\n]/).map((s) => s.trim()).filter(Boolean);
    if (!payload.title || (editing && payload.title.length < 2) || !payload.description || !payload.field || !payload.experience_level || !payload.location || !payload.work_type || !payload.required_skills.length) { setError("أكمل جميع الحقول وأضف مهارة واحدة على الأقل."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const path = editing ? `/recruiter/jobs/${encodeURIComponent(editing.job_id)}` : "/recruiter/jobs";
      const saved = await companyRequest(token, path, company.company_id, editing ? "PUT" : "POST", payload);
      setJobs((previous) => editing ? previous.map((item) => item.job_id === saved.job_id ? saved : item) : [saved, ...previous]);
      setForm(null); setEditing(null); setNotice("تم حفظ الوظيفة.");
    } catch { setError("تعذر التأكد من حفظ الوظيفة. ارجع للقائمة وأعد تحميل الشركة قبل المحاولة مجددًا لتجنب التكرار."); }
    finally { setBusy(false); }
  }

  async function toggleJob(item) {
    setBusy(true); setError(""); setNotice("");
    try {
      const saved = await companyRequest(token, `/recruiter/jobs/${encodeURIComponent(item.job_id)}`, company.company_id, "PUT", { status: item.status === "active" ? "closed" : "active" });
      setJobs((previous) => previous.map((entry) => entry.job_id === saved.job_id ? saved : entry));
      setNotice("تم تحديث حالة الوظيفة.");
    } catch { setError("تعذر تحديث حالة الوظيفة. أعد فتح الشركة للتحقق من حالتها."); }
    finally { setBusy(false); }
  }

  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Button title={company ? "رجوع" : "العودة للرئيسية"} onPress={back} disabled={busy} />
    <Text style={styles.title}>{candidate ? candidate.full_name : job ? `مرشحو ${job.title}` : company ? company.name : "شركاتي والتوظيف"}</Text>
    {!!error && <Text style={styles.error}>{error}</Text>}
    {!!notice && <Text style={styles.text}>{notice}</Text>}
    {busy && <ActivityIndicator color="#38bdf8" />}
    {!companies && !busy && <Button title="إعادة المحاولة" onPress={loadCompanies} />}
    {!company && companies && <>
      <CompanyManagement token={token} companies={companies} userId={userId} onCompaniesChange={setCompanies} />
      {!companies.length && <Text style={styles.text}>لا تنتمي إلى شركة حاليًا.</Text>}
      {companies.map((item) => <View key={item.company_id} style={styles.card}><Text style={styles.heading}>{item.name}</Text><Text style={styles.text}>الحالة: {statuses[item.status] || item.status}</Text>{item.status === "approved" && <Button title="عرض وظائف الشركة" onPress={() => openCompany(item)} disabled={busy} />}</View>)}
    </>}
    {form && <><Text style={styles.heading}>{editing ? "تعديل الوظيفة" : "إضافة وظيفة"}</Text>{!editing && <Text style={styles.text}>ستُنشر الوظيفة عند الحفظ.</Text>}{fields.map(([key, label, max]) => <View key={key}><Text style={styles.text}>{label}</Text><TextInput style={styles.input} value={form[key]} onChangeText={(value) => setForm((previous) => ({ ...previous, [key]: value }))} editable={!busy} accessibilityLabel={label} maxLength={max} multiline={key === "description"} /></View>)}<Button title={editing ? "حفظ التعديلات" : "نشر الوظيفة"} onPress={saveJob} disabled={busy} /></>}
    {company && !job && !form && jobs && <>
      <Button title="إضافة وظيفة" onPress={() => editJob(null)} disabled={busy} />
      {!jobs.length && <Text style={styles.text}>لا توجد وظائف لهذه الشركة بعد.</Text>}
      {jobs.map((item) => <View key={item.job_id} style={styles.card}><Text style={styles.heading}>{item.title}</Text><Text style={styles.text}>{item.location} · {item.status === "active" ? "نشطة" : "مغلقة"}</Text><Text style={styles.text}>المهارات: {item.required_skills.join("، ")}</Text><Button title="عرض المرشحين" onPress={() => openJob(item)} disabled={busy} /><Button title="تعديل الوظيفة" onPress={() => editJob(item)} disabled={busy} /><Button title={item.status === "active" ? "إغلاق الوظيفة" : "إعادة فتح الوظيفة"} onPress={() => toggleJob(item)} disabled={busy} /></View>)}
    </>}
    {job && candidates && !candidate && <>
      <Text style={styles.text}>تظهر المرشحات والمرشحون المتاحون لهذه الوظيفة وفق موافقتهم وصلاحيات الشركة.</Text>
      {!candidates.length && <Text style={styles.text}>لا يوجد مرشحون متاحون حاليًا.</Text>}
      {candidates.map((item) => <View key={item.candidate_id} style={styles.card}><Text style={styles.heading}>{item.full_name} · {item.match_percentage}%</Text><Text style={styles.text}>{item.target_role}</Text><Text style={styles.text}>المهارات المتوافقة: {item.matched_skills.join("، ") || "لا يوجد"}</Text><Text style={styles.text}>الحالة: {stages.find(([value]) => value === item.pipeline_status)?.[1] || item.pipeline_status}</Text><Button title="عرض الملف والمتابعة" onPress={() => openCandidate(item)} disabled={busy} /></View>)}
    </>}
    {candidate && profile && <>
      <Text style={styles.text}>البريد: {profile.email}</Text><Text style={styles.text}>المهارات: {profile.skills.join("، ") || "لا يوجد"}</Text>
      {[["الخبرة", profile.experience, "title", "company"], ["التعليم", profile.education, "degree", "institution"], ["المشاريع", profile.projects, "title", "description"]].map(([label, items, first, second]) => <View key={label}><Text style={styles.heading}>{label}</Text>{items.length ? items.map((item, index) => <Text style={styles.text} key={index}>{item[first]} {item[second] ? `— ${item[second]}` : ""}</Text>) : <Text style={styles.text}>لا يوجد</Text>}</View>)}
      <Text style={styles.heading}>المرحلة لهذه الوظيفة</Text>
      {stages.map(([value, label]) => <Button key={value} title={`${stage === value ? "✓ " : ""}${label}`} onPress={() => setStage(value)} disabled={busy} />)}
      <Text style={styles.heading}>ملاحظات الشركة لهذه الوظيفة</Text><TextInput style={styles.input} value={notes} onChangeText={setNotes} accessibilityLabel="ملاحظات المرشح" maxLength={1000} multiline editable={!busy} />
      <Button title="حفظ المرحلة والملاحظات" onPress={saveCandidate} disabled={busy || (stage === candidate.pipeline_status && notes === (candidate.notes || ""))} />
    </>}
  </ScrollView>;
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: "#0f172a" }, content: { padding: 20, gap: 12 }, title: { color: "white", fontSize: 24, fontWeight: "bold", textAlign: "right" }, heading: { color: "#e2e8f0", fontSize: 17, fontWeight: "bold", textAlign: "right" }, text: { color: "#cbd5e1", fontSize: 15, textAlign: "right" }, error: { color: "#fca5a5", textAlign: "right" }, card: { padding: 14, backgroundColor: "#1e293b", borderRadius: 10, gap: 8 }, input: { color: "white", borderWidth: 1, borderColor: "#64748b", borderRadius: 8, padding: 10, textAlign: "right" } });
