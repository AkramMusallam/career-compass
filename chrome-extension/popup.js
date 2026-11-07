const API_BASE = "http://localhost:8000";

let currentJobData = null;

document.addEventListener("DOMContentLoaded", async () => {
  const settings = await chrome.storage.local.get("api_base");
  document.getElementById("server-url").value = settings.api_base || API_BASE;
  document.getElementById("save-server-btn").addEventListener("click", async () => {
    try {
      const url = new URL(document.getElementById("server-url").value.trim());
      if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new Error();
      if (url.username || url.password || url.search || url.hash) throw new Error();
      if (url.protocol === "https:" && !(await chrome.permissions.request({ origins: [`${url.origin}/*`] }))) {
        alert("تعذر الحصول على الصلاحية لهذا العنوان. يرجى الموافقة على الإذن المطلوب.");
        return;
      }
      await chrome.storage.local.set({ api_base: url.href.replace(/\/$/, "") });
      alert("تم حفظ عنوان الخادم بنجاح!");
    } catch { alert("يرجى إدخال عنوان HTTPS صالح ومكتمل (أو localhost للتطوير)."); }
  });
  const token = await getStoredToken();
  if (!token) {
    document.getElementById("auth-section").classList.remove("hidden");
  }

  // محاولة قراءة الوظيفة المفتوحة حالياً في التبويب النشط
  try {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "EXTRACT_LINKEDIN_JOB" }, (response) => {
          if (chrome.runtime.lastError) {
            // التبويب الحالي ليس صفحة LinkedIn نشطة
            document.getElementById("job-title").textContent = "افتح إعلان وظيفة على LinkedIn";
            document.getElementById("job-company").textContent = "";
            return;
          }
          if (response && response.title) {
            currentJobData = response;
            document.getElementById("job-title").textContent = response.title;
            document.getElementById("job-company").textContent = response.company || "LinkedIn Job";
          } else {
            // بيانات افتراضية إذا لم تكن صفحة لينكد إن مفتوحة
            document.getElementById("job-title").textContent = "تعذر قراءة إعلان الوظيفة";
            document.getElementById("job-company").textContent = "افتح الإعلان ثم أعد المحاولة";
          }
        });
      }
    });
  } catch (err) {
    console.log("Tab query fallback:", err);
  }

  // أحداث الأزرار
  document.getElementById("save-token-btn")?.addEventListener("click", async () => {
    const val = document.getElementById("token-input").value.trim();
    if (val) {
      await chrome.storage.local.set({ career_compass_token: val });
      document.getElementById("auth-section").classList.add("hidden");
    }
  });

  document.getElementById("analyze-btn")?.addEventListener("click", () => {
    executeJobAnalysis();
  });

  document.getElementById("copy-cover-btn")?.addEventListener("click", () => {
    const text = document.getElementById("cover-snippet").textContent;
    navigator.clipboard.writeText(text);
    alert("تم نسخ مقدمة خطاب التقديم!");
  });
});

async function getStoredToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["career_compass_token"], (result) => {
      resolve(result.career_compass_token || "");
    });
  });
}

async function executeJobAnalysis() {
  const loading = document.getElementById("loading-box");
  const results = document.getElementById("results-box");
  const detected = document.getElementById("detected-job-box");

  if (!currentJobData?.title || !currentJobData?.description) {
    alert("افتح إعلان وظيفة على LinkedIn وانتظر تحميل تفاصيله ثم أعد المحاولة.");
    return;
  }

  detected.classList.add("hidden");
  loading.classList.remove("hidden");
  results.classList.add("hidden");

  let token = await getStoredToken();
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const { api_base = API_BASE } = await chrome.storage.local.get("api_base");
    const resp = await fetch(`${api_base}/extension/match-job`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        job_title: currentJobData.title || "Backend Engineer",
        company: currentJobData.company || "Tech Enterprise",
        job_description: currentJobData.description || "Python, React, SQL, Docker",
      }),
    });

    if (!resp.ok) {
      throw new Error(`API returned status ${resp.status}`);
    }

    const data = await resp.json();
    renderAnalysisResults(data);
  } catch (error) {
    console.warn("Job matching failed:", error);
    alert("تعذرت مطابقة الوظيفة. تحقق من تشغيل الخادم وصلاحية رمز الجلسة ثم أعد المحاولة.");
    detected.classList.remove("hidden");
    return;
  } finally {
    loading.classList.add("hidden");
  }
  results.classList.remove("hidden");
}

function renderAnalysisResults(data) {
  document.getElementById("score-val").textContent = `${data.match_score}%`;
  document.getElementById("verdict-text").textContent = data.verdict;
  document.getElementById("candidate-meta").textContent = `المرشح: ${data.candidate_name || "الملف المسجل"}`;

  const matchedContainer = document.getElementById("matched-tags");
  matchedContainer.innerHTML = "";
  (data.matched_skills || []).forEach((skill) => {
    const el = document.createElement("span");
    el.textContent = skill;
    matchedContainer.appendChild(el);
  });

  const missingContainer = document.getElementById("missing-tags");
  missingContainer.innerHTML = "";
  (data.missing_skills || []).forEach((skill) => {
    const el = document.createElement("span");
    el.textContent = skill;
    missingContainer.appendChild(el);
  });

  const recList = document.getElementById("recommendations-list");
  recList.innerHTML = "";
  (data.recommendations || []).forEach((rec) => {
    const li = document.createElement("li");
    li.textContent = rec;
    recList.appendChild(li);
  });

  document.getElementById("cover-snippet").textContent = data.suggested_cover_letter_snippet || "";
}
