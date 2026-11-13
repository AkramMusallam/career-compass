const API_BASE = "http://localhost:8000";
const REQUEST_TIMEOUT_MS = 25000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const JWT_SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/;

let currentJobData = null;

function showStatus(message, type = "info") {
  const banner = document.getElementById("status-banner");
  if (!banner) return;
  banner.textContent = message;
  banner.className = `status-banner status-banner--${type}`;
}

function clearStatus() {
  const banner = document.getElementById("status-banner");
  if (!banner) return;
  banner.textContent = "";
  banner.className = "status-banner hidden";
}

function normalizeToken(raw) {
  if (typeof raw !== "string") return "";
  return raw.replace(/^\s*bearer\s+/i, "").trim();
}

function decodeBase64UrlJson(segment) {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const decoded = new TextDecoder().decode(bytes);
  return JSON.parse(decoded);
}

function validateJwtToken(raw) {
  const token = normalizeToken(raw);
  if (!token) {
    return {
      valid: false,
      reason: "empty",
      message: "يرجى إدخال رمز الجلسة (JWT Access Token).",
    };
  }
  if (EMAIL_PATTERN.test(token)) {
    return {
      valid: false,
      reason: "email",
      message: "يرجى إدخال رمز الجلسة (JWT Access Token) وليس البريد الإلكتروني.",
    };
  }

  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !part || !JWT_SEGMENT_PATTERN.test(part))) {
    return {
      valid: false,
      reason: "malformed",
      message: "صيغة رمز الجلسة (JWT) غير صالحة. يجب أن يتكون من 3 مقاطع بصيغة base64url.",
    };
  }

  let header;
  let payload;
  try {
    header = decodeBase64UrlJson(parts[0]);
    payload = decodeBase64UrlJson(parts[1]);
  } catch {
    return {
      valid: false,
      reason: "malformed",
      message: "تعذر فك ترميز رمز الجلسة (JWT). تأكد من نسخ الرمز كاملاً.",
    };
  }

  if (
    !header ||
    typeof header !== "object" ||
    Array.isArray(header) ||
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    return {
      valid: false,
      reason: "malformed",
      message: "بنية رمز الجلسة (JWT) غير صالحة.",
    };
  }

  if (payload.type !== undefined && payload.type !== "access") {
    return {
      valid: false,
      reason: "wrong_type",
      message: "هذا الرمز مخصص لغرض آخر وليس رمز دخول (Access Token).",
    };
  }

  if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
    return {
      valid: false,
      reason: "missing_exp",
      message: "رمز الجلسة يفتقد تاريخ انتهاء الصلاحية (exp) الصالح.",
    };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (payload.exp <= nowSeconds) {
    return {
      valid: false,
      reason: "expired",
      message: "انتهت صلاحية رمز الجلسة (JWT expired). يرجى نسخ رمز جديد من حسابك.",
    };
  }

  return { valid: true, token, payload };
}

function parseValidApiBase(rawUrl) {
  const url = new URL((rawUrl || "").trim());
  const isAllowedLocalHttp =
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(url.hostname) &&
    url.port === "8000";
  if (url.protocol !== "https:" && !isAllowedLocalHttp) {
    throw new Error("Invalid protocol or port");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("Invalid URL components");
  }
  return {
    origin: url.origin,
    protocol: url.protocol,
    normalized: url.href.replace(/\/$/, ""),
  };
}

function isLinkedInJobsUrl(url) {
  if (typeof url !== "string" || !url) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      (parsed.hostname === "linkedin.com" || parsed.hostname.endsWith(".linkedin.com")) &&
      (parsed.pathname === "/jobs" || parsed.pathname.startsWith("/jobs/"))
    );
  } catch {
    return false;
  }
}

async function getStoredToken() {
  const result = await chrome.storage.local.get("career_compass_token");
  return normalizeToken(result.career_compass_token || "");
}

async function setStoredToken(token) {
  await chrome.storage.local.set({ career_compass_token: token });
}

async function clearStoredToken() {
  await chrome.storage.local.remove("career_compass_token");
}

function syncAuthUi(token) {
  const authSection = document.getElementById("auth-section");
  const logoutBtn = document.getElementById("logout-btn");
  if (token) {
    authSection?.classList.add("hidden");
    logoutBtn?.classList.remove("hidden");
  } else {
    authSection?.classList.remove("hidden");
    logoutBtn?.classList.add("hidden");
  }
}

function setEmptyDetectedJob(titleText, companyText) {
  const titleEl = document.getElementById("job-title");
  const companyEl = document.getElementById("job-company");
  const locationEl = document.getElementById("job-location");

  currentJobData = null;
  titleEl.textContent = titleText;
  companyEl.textContent = companyText;
  locationEl.textContent = "";
  locationEl.classList.add("hidden");
}

function renderDetectedJob(response) {
  const titleEl = document.getElementById("job-title");
  const companyEl = document.getElementById("job-company");
  const locationEl = document.getElementById("job-location");

  const title = typeof response?.title === "string" ? response.title.trim() : "";
  const company = typeof response?.company === "string" ? response.company.trim() : "";
  const location = typeof response?.location === "string" ? response.location.trim() : "";
  const description =
    typeof response?.description === "string" ? response.description.trim() : "";
  const extractedSkills = Array.isArray(response?.extracted_skills)
    ? response.extracted_skills.filter((s) => typeof s === "string" && s.trim())
    : [];

  if (!title) {
    setEmptyDetectedJob(
      "تعذر قراءة إعلان الوظيفة",
      "افتح إعلان وظيفة على LinkedIn ثم اضغط تحديث"
    );
    return;
  }

  currentJobData = {
    title,
    company,
    location,
    description,
    extracted_skills: extractedSkills,
  };
  titleEl.textContent = title;
  companyEl.textContent =
    description.length >= 5
      ? company || "شركة غير محددة"
      : "تم رصد العنوان فقط — انتظر تحميل الوصف ثم اضغط تحديث";

  if (location) {
    locationEl.textContent = location;
    locationEl.classList.remove("hidden");
  } else {
    locationEl.textContent = "";
    locationEl.classList.add("hidden");
  }
}

async function extractJobFromActiveTab() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs?.[0];
    if (!activeTab?.id) {
      setEmptyDetectedJob("افتح إعلان وظيفة على LinkedIn", "");
      return;
    }

    let response = null;
    try {
      response = await chrome.tabs.sendMessage(activeTab.id, {
        type: "EXTRACT_LINKEDIN_JOB",
      });
    } catch {
      if (isLinkedInJobsUrl(activeTab.url)) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            files: ["content.js"],
          });
          response = await chrome.tabs.sendMessage(activeTab.id, {
            type: "EXTRACT_LINKEDIN_JOB",
          });
        } catch {
          response = null;
        }
      } else {
        setEmptyDetectedJob("افتح إعلان وظيفة على LinkedIn", "");
        return;
      }
    }

    renderDetectedJob(response);
  } catch (err) {
    console.warn("Tab query failed:", err);
    setEmptyDetectedJob("تعذر قراءة إعلان الوظيفة", "افتح الإعلان ثم أعد المحاولة");
  }
}

async function revokeStaleHttpsPermissions(keepOrigin) {
  const toRemove = new Set();
  const prev = await chrome.storage.local.get("api_base");
  if (prev.api_base) {
    try {
      const prevParsed = parseValidApiBase(prev.api_base);
      if (prevParsed.protocol === "https:" && prevParsed.origin !== keepOrigin) {
        toRemove.add(`${prevParsed.origin}/*`);
      }
    } catch {
      // Ignore invalid stored previous URL
    }
  }

  if (typeof chrome.permissions?.getAll === "function") {
    try {
      const manifestPerms = new Set(
        chrome.runtime?.getManifest?.()?.host_permissions || [
          "https://*.linkedin.com/jobs/*",
        ]
      );
      const perms = await chrome.permissions.getAll();
      for (const origin of perms?.origins || []) {
        if (
          origin.startsWith("https://") &&
          !manifestPerms.has(origin) &&
          origin !== `${keepOrigin}/*`
        ) {
          toRemove.add(origin);
        }
      }
    } catch {
      // Ignore getAll unsupported errors
    }
  }

  if (toRemove.size > 0 && typeof chrome.permissions?.remove === "function") {
    try {
      await chrome.permissions.remove({ origins: Array.from(toRemove) });
    } catch {
      // Ignore non-removable host permission errors
    }
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const settings = await chrome.storage.local.get("api_base");
  document.getElementById("server-url").value = settings.api_base || API_BASE;

  document.getElementById("save-server-btn").addEventListener("click", async () => {
    clearStatus();
    try {
      const parsed = parseValidApiBase(document.getElementById("server-url").value);

      if (parsed.protocol === "https:") {
        const granted = await chrome.permissions.request({
          origins: [`${parsed.origin}/*`],
        });
        if (!granted) {
          showStatus(
            "تعذر الحصول على الصلاحية لهذا العنوان. يرجى الموافقة على الإذن المطلوب.",
            "error"
          );
          return;
        }
      }

      await revokeStaleHttpsPermissions(
        parsed.protocol === "https:" ? parsed.origin : ""
      );

      await chrome.storage.local.set({ api_base: parsed.normalized });
      document.getElementById("server-url").value = parsed.normalized;
      showStatus("تم حفظ عنوان الخادم بنجاح!", "success");
    } catch {
      showStatus(
        "يرجى إدخال عنوان HTTPS صالح ومكتمل (أو http://localhost:8000 للتطوير المحلي).",
        "error"
      );
    }
  });

  const rawStoredToken = await getStoredToken();
  if (rawStoredToken) {
    const check = validateJwtToken(rawStoredToken);
    if (!check.valid) {
      await clearStoredToken();
      syncAuthUi("");
      showStatus(check.message, "error");
    } else {
      syncAuthUi(check.token);
    }
  } else {
    syncAuthUi("");
  }

  await extractJobFromActiveTab();

  document.getElementById("save-token-btn")?.addEventListener("click", async () => {
    clearStatus();
    const inputEl = document.getElementById("token-input");
    const check = validateJwtToken(inputEl.value);
    if (!check.valid) {
      showStatus(check.message, "error");
      inputEl.focus();
      return;
    }
    await setStoredToken(check.token);
    inputEl.value = "";
    syncAuthUi(check.token);
    showStatus("تم حفظ رمز الجلسة وربط الحساب بنجاح.", "success");
  });

  document.getElementById("logout-btn")?.addEventListener("click", async () => {
    await clearStoredToken();
    syncAuthUi("");
    document.getElementById("results-box").classList.add("hidden");
    document.getElementById("detected-job-box").classList.remove("hidden");
    showStatus("تم مسح رمز الجلسة. أدخل رمزاً جديداً للمتابعة.", "info");
    document.getElementById("token-input")?.focus();
  });

  document.getElementById("refresh-job-btn")?.addEventListener("click", async () => {
    clearStatus();
    await extractJobFromActiveTab();
  });

  document.getElementById("analyze-btn")?.addEventListener("click", () => {
    executeJobAnalysis();
  });

  document.getElementById("back-btn")?.addEventListener("click", async () => {
    clearStatus();
    document.getElementById("results-box").classList.add("hidden");
    document.getElementById("detected-job-box").classList.remove("hidden");
    await extractJobFromActiveTab();
  });

  document.getElementById("copy-cover-btn")?.addEventListener("click", async () => {
    clearStatus();
    const text = document.getElementById("cover-snippet").textContent.trim();
    if (!text) {
      showStatus("لا يوجد نص لنسخه حالياً.", "error");
      return;
    }
    if (!navigator.clipboard?.writeText) {
      showStatus("الحافظة غير متاحة في هذا السياق.", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      showStatus("تم نسخ مقدمة خطاب التقديم!", "success");
    } catch {
      showStatus("تعذر النسخ إلى الحافظة. انسخ النص يدوياً.", "error");
    }
  });
});

async function readApiErrorDetail(resp) {
  try {
    const errBody = await resp.json();
    return typeof errBody?.detail === "string" ? errBody.detail : "";
  } catch {
    return "";
  }
}

async function executeJobAnalysis() {
  clearStatus();
  const loading = document.getElementById("loading-box");
  const results = document.getElementById("results-box");
  const detected = document.getElementById("detected-job-box");
  const analyzeBtn = document.getElementById("analyze-btn");

  const rawToken = await getStoredToken();
  const tokenCheck = validateJwtToken(rawToken);
  if (!tokenCheck.valid) {
    await clearStoredToken();
    syncAuthUi("");
    showStatus(tokenCheck.message, "error");
    document.getElementById("token-input")?.focus();
    return;
  }
  const token = tokenCheck.token;

  const jobTitle = (currentJobData?.title || "").trim();
  const jobDescription = (currentJobData?.description || "").trim();
  const company = (currentJobData?.company || "").trim();
  const location = (currentJobData?.location || "").trim();
  const extractedSkills = Array.isArray(currentJobData?.extracted_skills)
    ? currentJobData.extracted_skills.filter((s) => typeof s === "string" && s.trim())
    : [];

  if (jobTitle.length < 2 || jobDescription.length < 5) {
    showStatus(
      "افتح إعلان وظيفة على LinkedIn وانتظر تحميل العنوان والوصف ثم اضغط تحديث.",
      "error"
    );
    return;
  }

  let parsedApiBase;
  try {
    const { api_base = API_BASE } = await chrome.storage.local.get("api_base");
    parsedApiBase = parseValidApiBase(api_base);
  } catch {
    showStatus("عنوان الخادم المحفوظ غير صالح. يرجى تحديث عنوان الخادم.", "error");
    return;
  }

  if (
    parsedApiBase.protocol === "https:" &&
    typeof chrome.permissions?.contains === "function"
  ) {
    try {
      const hasOriginPerm = await chrome.permissions.contains({
        origins: [`${parsedApiBase.origin}/*`],
      });
      if (!hasOriginPerm) {
        showStatus(
          "صلاحية الوصول لعنوان الخادم غير مفعّلة. اضغط حفظ عنوان الخادم للموافقة.",
          "error"
        );
        return;
      }
    } catch {
      showStatus("تعذر التحقق من صلاحية الوصول لعنوان الخادم.", "error");
      return;
    }
  }
  const validatedApiBase = parsedApiBase.normalized;

  if (analyzeBtn) analyzeBtn.disabled = true;
  detected.classList.add("hidden");
  loading.classList.remove("hidden");
  results.classList.add("hidden");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const resp = await fetch(`${validatedApiBase}/extension/match-job`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        job_title: jobTitle.slice(0, 300),
        company: company.slice(0, 200),
        location: location.slice(0, 200),
        job_description: jobDescription.slice(0, 15000),
        extracted_skills: extractedSkills,
      }),
      signal: controller.signal,
    });

    if (resp.status === 401 || resp.status === 403) {
      const detail = await readApiErrorDetail(resp);
      await clearStoredToken();
      syncAuthUi("");
      detected.classList.remove("hidden");
      showStatus(
        detail
          ? `انتهت صلاحية الجلسة أو تعذر التفويض (${detail}). يرجى إدخال رمز جديد.`
          : "انتهت صلاحية رمز الجلسة أو أنه غير صالح. يرجى إدخال رمز جديد.",
        "error"
      );
      document.getElementById("token-input")?.focus();
      return;
    }

    if (!resp.ok) {
      const detail = await readApiErrorDetail(resp);
      const apiErr = new Error(detail || `API returned status ${resp.status}`);
      apiErr.apiDetail = detail;
      throw apiErr;
    }

    const data = await resp.json();
    renderAnalysisResults(data);
    results.classList.remove("hidden");
  } catch (error) {
    console.warn("Job matching failed:", error);
    detected.classList.remove("hidden");
    if (error?.name === "AbortError") {
      showStatus("انتهت مهلة الاتصال بالخادم. تحقق من اتصالك وأعد المحاولة.", "error");
    } else if (error?.apiDetail) {
      showStatus(`تعذرت مطابقة الوظيفة: ${error.apiDetail}`, "error");
    } else {
      showStatus(
        "تعذرت مطابقة الوظيفة. تحقق من تشغيل الخادم وصلاحية رمز الجلسة ثم أعد المحاولة.",
        "error"
      );
    }
  } finally {
    clearTimeout(timeoutId);
    loading.classList.add("hidden");
    if (analyzeBtn) analyzeBtn.disabled = false;
  }
}

function renderTagList(container, items, emptyText) {
  container.replaceChildren();
  const list = Array.isArray(items)
    ? items.filter((item) => typeof item === "string" && item.trim())
    : [];

  if (list.length === 0) {
    const emptyEl = document.createElement("span");
    emptyEl.className = "tag-empty";
    emptyEl.textContent = emptyText;
    container.appendChild(emptyEl);
    return;
  }

  list.forEach((skill) => {
    const el = document.createElement("span");
    el.textContent = skill;
    container.appendChild(el);
  });
}

function renderAnalysisResults(data) {
  const rawScore = Number(data?.match_score);
  const score = Number.isFinite(rawScore)
    ? Math.max(0, Math.min(100, Math.round(rawScore)))
    : 0;

  const scoreTier =
    score >= 75 ? "score-high" : score >= 45 ? "score-medium" : "score-low";

  const scoreCircle = document.getElementById("score-circle");
  scoreCircle.className = `score-circle ${scoreTier}`;
  document.getElementById("score-val").textContent = `${score}%`;

  const verdictEl = document.getElementById("verdict-text");
  verdictEl.className = `verdict-title ${scoreTier}`;
  verdictEl.textContent =
    typeof data?.verdict === "string" && data.verdict.trim()
      ? data.verdict
      : "نتيجة المطابقة";

  const candidateName =
    typeof data?.candidate_name === "string" && data.candidate_name.trim()
      ? data.candidate_name
      : "الملف المسجل";
  document.getElementById("candidate-meta").textContent = `المرشح: ${candidateName}`;

  renderTagList(
    document.getElementById("matched-tags"),
    data?.matched_skills,
    "لا توجد مهارات متطابقة مسجلة"
  );
  renderTagList(
    document.getElementById("missing-tags"),
    data?.missing_skills,
    "لا توجد فجوات مهارات مكتشفة"
  );

  const recList = document.getElementById("recommendations-list");
  recList.replaceChildren();
  const recommendations = Array.isArray(data?.recommendations)
    ? data.recommendations.filter((rec) => typeof rec === "string" && rec.trim())
    : [];
  recommendations.forEach((rec) => {
    const li = document.createElement("li");
    li.textContent = rec;
    recList.appendChild(li);
  });

  document.getElementById("cover-snippet").textContent =
    typeof data?.suggested_cover_letter_snippet === "string"
      ? data.suggested_cover_letter_snippet
      : "";
}
