// Mobile API Client configuration
import { Platform } from "react-native";

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || (Platform.OS === "android" ? "http://10.0.2.2:8000" : "http://localhost:8000");

export async function login(email, password) {
  const resp = await fetch(`${API_BASE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!resp.ok) throw new Error("تعذر تسجيل الدخول. تحقق من البيانات واتصال الخادم.");
  return resp.json();
}

export async function fetchProfile(token) {
  const resp = await fetch(`${API_BASE_URL}/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

export async function fetchLatestRoadmap(token) {
  const resp = await fetch(`${API_BASE_URL}/history?limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  const latestItem =
    Array.isArray(data) && data.length > 0
      ? data[0]
      : data && Array.isArray(data.analyses) && data.analyses.length > 0
      ? data.analyses[0]
      : null;
  if (!latestItem || !latestItem.analysis_id) return null;

  const detailResp = await fetch(`${API_BASE_URL}/history/${latestItem.analysis_id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!detailResp.ok) throw new Error(`HTTP ${detailResp.status}`);
  return detailResp.json();
}

export async function toggleMilestoneSkill(token, analysisId, skill, completed) {
  const resp = await fetch(`${API_BASE_URL}/history/${analysisId}/roadmap`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ skill, completed }),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

export async function startMockInterview(token, analysisId, jobTitle) {
  const resp = await fetch(`${API_BASE_URL}/interview/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ analysis_id: analysisId, job_title: jobTitle }),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

export async function sendInterviewChat(token, sessionId, message) {
  const resp = await fetch(`${API_BASE_URL}/interview/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ session_id: sessionId, message }),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

export async function sendVoiceAnswer(token, sessionId, uri, durationSeconds) {
  const data = new FormData();
  data.append("file", { uri, name: "answer.m4a", type: "audio/mp4" });
  data.append("duration_seconds", String(durationSeconds));
  const resp = await fetch(`${API_BASE_URL}/interview/${sessionId}/voice`, {
    method: "POST", headers: { Authorization: `Bearer ${token}` }, body: data,
  });
  const result = await resp.json();
  if (!resp.ok) throw new Error(result.detail || "تعذرت معالجة التسجيل الصوتي.");
  return result;
}
