// Mobile API Client configuration
export const API_BASE_URL = "http://localhost:8000";

export async function fetchProfile(token) {
  const resp = await fetch(`${API_BASE_URL}/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return resp.json();
}

export async function fetchLatestRoadmap(token) {
  const resp = await fetch(`${API_BASE_URL}/history?limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await resp.json();
  return data && data.length > 0 ? data[0] : null;
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
  return resp.json();
}
