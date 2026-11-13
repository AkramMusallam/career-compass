import React, { useEffect, useRef, useState } from "react";
import Button from "../components/AppButton";
import { ActivityIndicator, Alert, BackHandler, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { fetchProfile, updateProfile, getRecruiterConsent, updateRecruiterConsent } from "../services/api";

export default function ProfileScreen({ token, onBack }) {
  const [profile, setProfile] = useState(null);
  const [name, setName] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [consent, setConsent] = useState(null);
  const [consentBusy, setConsentBusy] = useState(false);
  const [consentError, setConsentError] = useState("");
  const consentBusyRef = useRef(false);

  async function loadConsent() {
    if (consentBusyRef.current) return;
    consentBusyRef.current = true; setConsentBusy(true); setConsentError("");
    try { const result = await getRecruiterConsent(token); setConsent(result.opted_in); }
    catch { setConsent(null); setConsentError("تعذر معرفة حالة المشاركة. تحقق من الاتصال وأعد المحاولة."); }
    finally { consentBusyRef.current = false; setConsentBusy(false); }
  }

  async function load() {
    setBusy(true); setError("");
    try { const result = await fetchProfile(token); setProfile(result); setName(result.full_name); setTargetRole(result.target_role || ""); }
    catch { setError("تعذر تحميل الملف الشخصي. تحقق من الاتصال وحاول مرة أخرى."); }
    finally { setBusy(false); }
  }
  useEffect(() => { load(); loadConsent(); }, [token]);

  function leave() {
    if (busy || consentBusy) return;
    if (profile && (name.trim() !== profile.full_name || targetRole.trim() !== (profile.target_role || ""))) {
      Alert.alert("مغادرة دون حفظ؟", "ستفقد التغييرات على ملفك الشخصي.", [{ text: "متابعة التعديل", style: "cancel" }, { text: "مغادرة", style: "destructive", onPress: onBack }]);
    } else onBack();
  }
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { leave(); return true; });
    return () => subscription.remove();
  }, [busy, consentBusy, profile, name, targetRole, onBack]);

  async function changeConsent(value) {
    if (consentBusyRef.current) return;
    consentBusyRef.current = true; setConsentBusy(true); setConsentError("");
    try { const result = await updateRecruiterConsent(token, value); setConsent(result.opted_in); }
    catch { setConsent(null); setConsentError("تعذر تأكيد تغيير المشاركة. أعد تحميل الحالة للتحقق منها."); }
    finally { consentBusyRef.current = false; setConsentBusy(false); }
  }

  async function save() {
    const value = name.trim();
    if (value.length < 2 || value.length > 255) { setError("يجب أن يكون الاسم بين حرفين و255 حرفًا."); return; }
    setBusy(true); setError(""); setNotice("");
    try { const updated = await updateProfile(token, value, Object.prototype.hasOwnProperty.call(profile, "target_role") ? targetRole.trim() || null : undefined); setProfile({ ...profile, ...updated }); setName(updated.full_name); setTargetRole(updated.target_role || ""); setNotice("تم حفظ الملف الشخصي."); }
    catch { setError("تعذر حفظ الاسم. تحقق من الاتصال وحاول مرة أخرى."); }
    finally { setBusy(false); }
  }

  return <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Button title="العودة للرئيسية" onPress={leave} disabled={busy || consentBusy} />
    <Text style={styles.title}>الملف الشخصي</Text>
    {!!error && <Text style={styles.error}>{error}</Text>}
    {!!notice && <Text style={styles.notice}>{notice}</Text>}
    {busy && <ActivityIndicator color="#38bdf8" />}
    {!profile && !busy && <Button title="إعادة المحاولة" onPress={load} />}
    {profile && <><Text style={styles.text}>الاسم الكامل</Text><TextInput style={styles.input} value={name} onChangeText={setName} editable={!busy} accessibilityLabel="الاسم الكامل" maxLength={255} />{Object.prototype.hasOwnProperty.call(profile, "target_role") && <><Text style={styles.text}>المسمى الوظيفي المستهدف</Text><TextInput style={styles.input} value={targetRole} onChangeText={setTargetRole} editable={!busy} accessibilityLabel="المسمى الوظيفي المستهدف" maxLength={120} /></>}<Text style={styles.text}>البريد الإلكتروني: {profile.email}</Text><Text style={styles.text}>عدد التحليلات: {profile.total_analyses}</Text><Text style={styles.text}>أعلى درجة: {Math.round(profile.highest_career_score)}%</Text><Button title="حفظ الملف" onPress={save} disabled={busy || (name.trim() === profile.full_name && targetRole.trim() === (profile.target_role || ""))} /></>}
    <View style={styles.consent}><Text style={styles.heading}>مشاركة ملفي مع مسؤولي التوظيف</Text><Text style={styles.text}>عند التفعيل يمكن لمسؤولي التوظيف الاطلاع على اسمك وبريدك ومهاراتك وخبراتك ومشاريعك وتعليمك. يمكنك إيقاف المشاركة في أي وقت.</Text>
      {consent !== null && <><Text style={styles.text}>{consent ? "المشاركة مفعّلة" : "المشاركة متوقفة"}</Text><Switch value={consent} onValueChange={changeConsent} disabled={consentBusy} accessibilityLabel="مشاركة ملفي مع مسؤولي التوظيف" /></>}
      {!!consentError && <Text style={styles.error}>{consentError}</Text>}
      {consentBusy && <ActivityIndicator color="#38bdf8" />}
      {consent === null && !consentBusy && <Button title="تحميل حالة المشاركة" onPress={loadConsent} />}
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: "#0f172a" }, content: { padding: 20, gap: 12 }, title: { color: "white", fontSize: 24, fontWeight: "bold", textAlign: "right" }, heading: { color: "white", fontSize: 17, fontWeight: "bold", textAlign: "right" }, consent: { backgroundColor: "#1e293b", padding: 14, borderRadius: 10, gap: 10 }, text: { color: "#cbd5e1", fontSize: 16, textAlign: "right" }, error: { color: "#fca5a5", textAlign: "right" }, notice: { color: "#a7f3d0", textAlign: "right" }, input: { color: "white", borderWidth: 1, borderColor: "#64748b", borderRadius: 8, padding: 12, textAlign: "right" } });
