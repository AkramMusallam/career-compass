import re
with open('frontend/src/api/endpoints.js', 'r', encoding='utf-8') as f:
    content = f.read()

if 'startInterview' not in content:
    content += '''
// ============================================================
// Phase 3: AI Mock Interview
// ============================================================
export const startInterview = (analysisId, jobTitle) => apiClient.post("/interview/start", { analysis_id: analysisId, job_title: jobTitle });
export const chatInterview = (sessionId, message) => apiClient.post("/interview/chat", { session_id: sessionId, message });
'''

with open('frontend/src/api/endpoints.js', 'w', encoding='utf-8') as f:
    f.write(content)