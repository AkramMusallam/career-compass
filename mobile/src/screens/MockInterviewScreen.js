import React, { useState, useEffect, useRef } from "react";
import Button from "../components/AppButton";
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from "expo-audio";
import { Alert, BackHandler, StyleSheet, Text, View, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from "react-native";
import { fetchLatestRoadmap, sendInterviewChat, sendVoiceAnswer, startMockInterview } from "../services/api";

export default function MockInterviewScreen({ onBack, token }) {
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [error, setError] = useState("");
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceFeedback, setVoiceFeedback] = useState(null);
  const [pendingRecording, setPendingRecording] = useState(null);
  const recording = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const startedRef = useRef(0);

  function leave() {
    if (isSending) return;
    if (isRecording || pendingRecording || inputText.trim()) {
      Alert.alert("مغادرة المقابلة؟", "سيُفقد التسجيل أو النص غير المرسل.", [{ text: "متابعة", style: "cancel" }, { text: "مغادرة", style: "destructive", onPress: onBack }]);
    } else onBack();
  }

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { leave(); return true; });
    return () => subscription.remove();
  }, [isSending, isRecording, pendingRecording, inputText, onBack]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const latest = await fetchLatestRoadmap(token);
        if (!latest?.analysis_id || !latest?.top_jobs?.[0]?.job_title) {
          throw new Error("أكمل تحليلك المهني قبل بدء المقابلة.");
        }
        const session = await startMockInterview(token, latest.analysis_id, latest.top_jobs[0].job_title);
        if (active) {
          setSessionId(session.session_id);
          setMessages(session.messages || []);
        }
      } catch (err) {
        if (active) setError(err.message || "تعذر بدء المقابلة. تحقق من الاتصال.");
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  async function submitRecording(answer) {
    const result = await sendVoiceAnswer(token, sessionId, answer.uri, answer.duration);
    setMessages(result.messages || []);
    setVoiceFeedback(result.voice_feedback || null);
    setPendingRecording(null);
  }

  const toggleRecording = async () => {
    if (!sessionId || isSending) return;
    setError("");
    setIsSending(true);
    try {
      if (pendingRecording) {
        await submitRecording(pendingRecording);
      } else if (!isRecording) {
        const permission = await requestRecordingPermissionsAsync();
        if (!permission.granted) throw new Error("يرجى السماح بالوصول إلى الميكروفون.");
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recording.prepareToRecordAsync();
        recording.record();
        startedRef.current = Date.now();
        setIsRecording(true);
      } else {
        setIsRecording(false);
        setIsSending(true);
        await recording.stop();
        const uri = recording.uri;
        if (!uri) throw new Error("تعذر حفظ التسجيل الصوتي.");
        const answer = { uri, duration: Math.max(1, (Date.now() - startedRef.current) / 1000) };
        setPendingRecording(answer);
        await setAudioModeAsync({ allowsRecording: false });
        await submitRecording(answer);
      }
    } catch (err) {
      setError(err.message || "تعذر تسجيل أو إرسال الصوت.");
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || !sessionId || isSending || isRecording || pendingRecording) return;
    const text = inputText.trim();
    const userMsg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsSending(true);

    try {
      const res = await sendInterviewChat(token, sessionId, text);
      setMessages(res.messages || []);
      setError("");
    } catch (_err) {
      setMessages((prev) => prev.slice(0, -1));
      setInputText(text);
      setError("تعذر إرسال الإجابة. تحقق من الاتصال وأعد المحاولة.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={leave} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="العودة للرئيسية">
          <Text style={styles.backText}>← رجوع</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>🎙️ محاكاة المقابلة التقنية</Text>
      </View>

      {/* Messages ScrollView */}
      <ScrollView style={styles.chatScroll} contentContainerStyle={{ paddingBottom: 20 }}>
        {!!error && <Text style={{ color: "#fca5a5", textAlign: "center" }}>{error}</Text>}
        {!!voiceFeedback && <Text style={{ color: "#a7f3d0", marginBottom: 12 }}>{voiceFeedback.feedback_summary}</Text>}
        {!sessionId && !error && <ActivityIndicator color="#38bdf8" />}
        {messages.map((m, idx) => (
          <View
            key={idx}
            style={[
              styles.msgBubble,
              m.role === "assistant" ? styles.assistantBubble : styles.userBubble,
            ]}
          >
            <Text style={styles.senderLabel}>
              {m.role === "assistant" ? "🤖 المحاور الفني (AI Recruiter)" : "👤 إجابتك"}
            </Text>
            <Text style={styles.msgContent}>{m.content}</Text>
          </View>
        ))}

        {isSending && (
          <View style={[styles.msgBubble, styles.assistantBubble]}>
            <ActivityIndicator size="small" color="#38bdf8" />
            <Text style={styles.loadingText}>المحاور يفكر في السؤال التالي...</Text>
          </View>
        )}
      </ScrollView>

      {/* Input & Voice Controls */}
      {pendingRecording && !isSending && <View style={styles.recordingNotice}><Text style={styles.msgContent}>لم يتأكد إرسال التسجيل. أعد الإرسال أو احذفه قبل تسجيل إجابة جديدة.</Text><Button title="إعادة إرسال التسجيل" onPress={toggleRecording} disabled={isSending} /><Button title="حذف التسجيل" color="#b91c1c" disabled={isSending} onPress={() => Alert.alert("حذف التسجيل؟", "ستفقد هذه الإجابة الصوتية.", [{ text: "إلغاء", style: "cancel" }, { text: "حذف", style: "destructive", onPress: () => setPendingRecording(null) }])} /></View>}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          placeholder="اكتب إجابتك التقنية هنا..."
          placeholderTextColor="#64748b"
          value={inputText}
          onChangeText={setInputText}
          accessibilityLabel="إجابتك في المقابلة"
          editable={!isSending && !isRecording && !pendingRecording}
          multiline
        />

        <TouchableOpacity style={[styles.micBtn, isRecording && styles.micBtnActive]} onPress={toggleRecording} disabled={!sessionId || isSending || !!pendingRecording} accessibilityRole="button" accessibilityLabel={isRecording ? "إيقاف وإرسال التسجيل" : "بدء التسجيل الصوتي"}>
          <Text style={styles.micIcon}>{isRecording ? "⏹️" : "🎙️"}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={!sessionId || isSending || isRecording || !!pendingRecording || !inputText.trim()} accessibilityRole="button" accessibilityLabel="إرسال الإجابة">
          <Text style={styles.sendText}>إرسال</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  topBar: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: "#1e293b",
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  backBtn: { padding: 6, minHeight: 48, minWidth: 48, justifyContent: "center" },
  backText: { color: "#38bdf8", fontSize: 14, fontWeight: "bold" },
  topTitle: { color: "#fff", fontSize: 16, fontWeight: "900", flex: 1, textAlign: "right" },
  chatScroll: { flex: 1, padding: 16 },
  msgBubble: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 14,
    maxWidth: "88%",
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.2)",
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#4f46e5",
  },
  senderLabel: { fontSize: 10, color: "#94a3b8", marginBottom: 4, fontWeight: "bold" },
  msgContent: { color: "#f8fafc", fontSize: 15, lineHeight: 23, textAlign: "right" },
  recordingNotice: { padding: 12, gap: 8 },
  loadingText: { color: "#94a3b8", fontSize: 11, marginTop: 4 },
  inputBar: {
    flexDirection: "row-reverse",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#1e293b",
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: "#0f172a",
    color: "#fff",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    maxHeight: 80,
    textAlign: "right",
  },
  micBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
  },
  micBtnActive: { backgroundColor: "#ef4444" },
  micIcon: { fontSize: 18 },
  sendBtn: {
    minHeight: 48,
    justifyContent: "center",
    backgroundColor: "#38bdf8",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  sendText: { color: "#0f172a", fontWeight: "900", fontSize: 12 },
});
