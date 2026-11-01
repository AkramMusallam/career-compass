import React, { useState } from "react";
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from "react-native";
import { sendInterviewChat } from "../services/api";

export default function MockInterviewScreen({ onBack, token, sessionId }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "مرحباً بك في جلسة المقابلة التقنية لمنصب Full Stack Engineer لدى كبرى الشركات التقنية. كيف تصمم معمارية REST API تضمن حماية المسارات الحساسة وعزل الصلاحيات؟",
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const text = inputText.trim();
    const userMsg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsSending(true);

    if (token && sessionId) {
      try {
        const res = await sendInterviewChat(token, sessionId, text);
        if (res && Array.isArray(res.messages) && res.messages.length > 0) {
          setMessages(res.messages);
          setIsSending(false);
          return;
        }
      } catch (_err) {
        // Fallback to local simulated interviewer
      }
    }

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "إجابة ممتازة! استخدام JWT مع التحقق من الصلاحيات وRBAC يمنح مرونة عالية. ما هي استراتيجيتك لحماية النظام من هجمات الـ Rate Limiting و N+1 queries عند التوسع؟",
        },
      ]);
      setIsSending(false);
    }, 1200);
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      setTimeout(() => {
        setIsRecording(false);
        setInputText("أستخدم FastAPI مع JWT Bearer tokens وميدلوير Sliding Window للـ Rate Limiting، مع تفعيل Eager Loading لمنع استعلامات N+1.");
      }, 2500);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← رجوع</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>🎙️ محاكاة المقابلة التقنية</Text>
      </View>

      {/* Messages ScrollView */}
      <ScrollView style={styles.chatScroll} contentContainerStyle={{ paddingBottom: 20 }}>
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
      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          placeholder="اكتب إجابتك التقنية هنا..."
          placeholderTextColor="#64748b"
          value={inputText}
          onChangeText={setInputText}
          multiline
        />

        <TouchableOpacity
          style={[styles.micBtn, isRecording && styles.micBtnActive]}
          onPress={toggleRecording}
        >
          <Text style={styles.micIcon}>{isRecording ? "⏹️" : "🎙️"}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
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
    paddingTop: 45,
    paddingBottom: 14,
    backgroundColor: "#1e293b",
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  backBtn: { padding: 6 },
  backText: { color: "#38bdf8", fontSize: 14, fontWeight: "bold" },
  topTitle: { color: "#fff", fontSize: 16, fontWeight: "900" },
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
  msgContent: { color: "#f8fafc", fontSize: 13, lineHeight: 20 },
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
  },
  micBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
  },
  micBtnActive: { backgroundColor: "#ef4444" },
  micIcon: { fontSize: 18 },
  sendBtn: {
    backgroundColor: "#38bdf8",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  sendText: { color: "#0f172a", fontWeight: "900", fontSize: 12 },
});
