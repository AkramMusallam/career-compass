// Mobile API Client configuration
import { Platform } from "react-native";

export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || (Platform.OS === "android" ? "http://10.0.2.2:8000" : "http://localhost:8000")).replace(/\/+$/, "");

let unauthorizedHandler = null;
export function setUnauthorizedHandler(handler) { unauthorizedHandler = handler; }

async function authenticatedFetch(url, options) {
  const response = await fetch(url, options);
  if (response.status === 401 && options.headers?.Authorization?.startsWith("Bearer ")) {
    unauthorizedHandler?.(options.headers.Authorization.slice(7));
  }
  return response;
}

async function authRequest(path, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const resp = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!resp.ok) {
      if (resp.status === 409) throw new Error("البريد الإلكتروني مستخدم بالفعل.");
      if (resp.status === 400 || resp.status === 422) throw new Error("تحقق من البيانات المدخلة وحاول مرة أخرى.");
      throw new Error("تعذر إكمال الطلب. تحقق من البيانات وحاول مرة أخرى.");
    }
    return await resp.json();
  } catch (error) {
    if (controller.signal.aborted || error instanceof TypeError) {
      throw new Error("تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function login(email, password) {
  return authRequest("/login", { email, password });
}

export function register(fullName, email, password) {
  return authRequest("/register", { full_name: fullName, email, password });
}

export function forgotPassword(email) {
  return authRequest("/forgot-password", { email });
}

export async function analysisRequest(token, path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180000);
  try {
    const headers = { Authorization: `Bearer ${token}` };
    const options = { headers, signal: controller.signal };
    if (body !== undefined) {
      options.method = "POST";
      if (body instanceof FormData) options.body = body;
      else {
        headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(body);
      }
    }
    const response = await authenticatedFetch(`${API_BASE_URL}${path}`, options);
    if (!response.ok) {
      const error = new Error(response.status === 401 ? "انتهت الجلسة. ارجع للرئيسية وسجّل الدخول مجددًا." : `تعذر إكمال الطلب (${response.status}). حاول مرة أخرى.`);
      error.status = response.status;
      throw error;
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function companyRequest(token, path, companyId, method = "GET", body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const headers = { Authorization: `Bearer ${token}` };
    if (companyId) headers["X-Company-Id"] = companyId;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const response = await authenticatedFetch(`${API_BASE_URL}${path}`, { method, headers, signal: controller.signal, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) {
      const error = new Error(`تعذر تحميل البيانات (${response.status}).`);
      error.status = response.status;
      throw error;
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export function getRecruiterConsent(token) {
  return companyRequest(token, "/settings/recruiter-consent");
}

export function updateRecruiterConsent(token, optedIn) {
  return companyRequest(token, "/settings/recruiter-consent", null, "PUT", { opted_in: optedIn });
}

async function timedFetch(url, options, milliseconds = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), milliseconds);
  try { return await authenticatedFetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

export async function fetchProfile(token) {
  const resp = await timedFetch(`${API_BASE_URL}/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

export async function updateProfile(token, fullName, targetRole) {
  const resp = await timedFetch(`${API_BASE_URL}/profile`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ full_name: fullName, ...(targetRole !== undefined ? { target_role: targetRole } : {}) }),
  });
  if (!resp.ok) throw new Error(`تعذر حفظ الملف الشخصي (${resp.status}).`);
  return resp.json();
}

export async function fetchLatestRoadmap(token) {
  const resp = await timedFetch(`${API_BASE_URL}/history?limit=1`, {
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

  const detailResp = await timedFetch(`${API_BASE_URL}/history/${latestItem.analysis_id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!detailResp.ok) throw new Error(`HTTP ${detailResp.status}`);
  return detailResp.json();
}

export async function toggleMilestoneSkill(token, analysisId, skill, completed) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const resp = await authenticatedFetch(`${API_BASE_URL}/history/${analysisId}/roadmap`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ skill, completed }),
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function startMockInterview(token, analysisId, jobTitle) {
  const resp = await timedFetch(`${API_BASE_URL}/interview/start`, {
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
  const resp = await timedFetch(`${API_BASE_URL}/interview/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ session_id: sessionId, message }),
  }, 180000);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

export async function sendVoiceAnswer(token, sessionId, uri, durationSeconds) {
  const data = new FormData();
  data.append("file", { uri, name: "answer.m4a", type: "audio/mp4" });
  data.append("duration_seconds", String(durationSeconds));
  const resp = await timedFetch(`${API_BASE_URL}/interview/${sessionId}/voice`, {
    method: "POST", headers: { Authorization: `Bearer ${token}` }, body: data,
  }, 180000);
  const result = await resp.json();
  if (!resp.ok) throw new Error(result.detail || "تعذرت معالجة التسجيل الصوتي.");
  return result;
}
