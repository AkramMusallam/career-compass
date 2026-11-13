// Content script injected into LinkedIn Job pages
if (!window.__careerCompassContentLoaded) {
  window.__careerCompassContentLoaded = true;
  console.log("Career Compass LinkedIn Matcher extension active.");

  const HOST_ID = "career-compass-shadow-host";
  const BADGE_ID = "career-compass-inline-badge";
  const PREVIEW_ID = "career-compass-inline-preview";
  const OBSERVER_DEBOUNCE_MS = 250;

  let activeShadowRoot = null;
  let activeWrapper = null;

  const TITLE_SELECTORS = [
    ".job-details-jobs-unified-top-card__job-title h1",
    ".job-details-jobs-unified-top-card__job-title",
    ".jobs-unified-top-card__job-title h1",
    ".jobs-unified-top-card__job-title",
    ".top-card-layout__title",
    "h1.topcard__title",
    "[data-test-job-title]",
    ".jobs-details__main-content h1",
    "h1.t-24",
    ".job-title",
  ];

  const COMPANY_SELECTORS = [
    ".job-details-jobs-unified-top-card__company-name a",
    ".job-details-jobs-unified-top-card__company-name",
    ".jobs-unified-top-card__company-name a",
    ".jobs-unified-top-card__company-name",
    ".topcard__org-name-link",
    ".top-card-layout__second-subline a",
    "[data-test-company-name]",
    ".company-name",
  ];

  const DIRECT_LOCATION_SELECTORS = [
    ".jobs-unified-top-card__bullet",
    ".topcard__flavor--bullet",
    "[data-test-job-location]",
  ];

  const METADATA_CONTAINER_SELECTORS = [
    ".job-details-jobs-unified-top-card__primary-description-container",
    ".job-details-jobs-unified-top-card__tertiary-description-container",
  ];

  const DESCRIPTION_SELECTORS = [
    "#job-details",
    ".jobs-description__content .jobs-box__html-content",
    ".jobs-description__content",
    ".jobs-description-content__text",
    ".jobs-box__html-content",
    ".show-more-less-html__markup",
    ".description__text",
    "[data-test-job-description]",
  ];

  const TOP_CARD_CONTAINER_SELECTORS = [
    ".job-details-jobs-unified-top-card__content--two-pane",
    ".jobs-unified-top-card__content--two-pane",
    ".job-details-jobs-unified-top-card__container--two-pane",
    ".job-details-jobs-unified-top-card",
    ".jobs-unified-top-card",
    ".top-card-layout__entity-info",
  ];

  const NOISE_LOCATION_RE =
    /(\bago\b|\bapplicant|\bclicked|\breposted|\bpromoted|\bpeople\b|\bresponses\b|منذ|متقدم|تمت إعادة النشر)/i;

  let lastKnownUrl = window.location.href;
  let lastJobSignature = "";
  let debounceTimer = null;

  function isLinkedInJobsPage() {
    const pathname = window.location.pathname;
    return pathname === "/jobs" || pathname.startsWith("/jobs/");
  }

  function readElementText(el) {
    if (!el) return "";
    const text = el.innerText || el.textContent || "";
    return text.replace(/\n{3,}/g, "\n\n").trim();
  }

  function getTextFromSelectors(selectors) {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      const value = readElementText(el);
      if (value) return value;
    }
    return "";
  }

  function extractLinkedInLocation() {
    for (const selector of DIRECT_LOCATION_SELECTORS) {
      const el = document.querySelector(selector);
      const candidate = readElementText(el).replace(/^[·•\s]+|[·•\s]+$/g, "");
      if (candidate && !NOISE_LOCATION_RE.test(candidate)) {
        return candidate.slice(0, 200);
      }
    }

    for (const containerSelector of METADATA_CONTAINER_SELECTORS) {
      const container = document.querySelector(containerSelector);
      if (!container) continue;

      const spans = container.querySelectorAll(".tvm__text");
      const rawSegments = spans.length
        ? Array.from(spans, (s) => readElementText(s))
        : readElementText(container).split(/[·•\n]/);

      for (const raw of rawSegments) {
        const segment = raw.replace(/^[·•\s]+|[·•\s]+$/g, "");
        if (!segment || segment.length < 2) continue;
        if (NOISE_LOCATION_RE.test(segment)) continue;
        return segment.slice(0, 200);
      }
    }

    return "";
  }

  // Extract job data from LinkedIn DOM matching ExtensionMatchRequest fields
  function extractLinkedInJobInfo() {
    const title = getTextFromSelectors(TITLE_SELECTORS);
    const company = getTextFromSelectors(COMPANY_SELECTORS);
    const location = extractLinkedInLocation();
    const description = getTextFromSelectors(DESCRIPTION_SELECTORS);

    return {
      title,
      company,
      location,
      description,
      extracted_skills: [],
    };
  }

  const SHADOW_STYLES = `
    :host {
      all: initial;
      display: block;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
    .cc-wrapper {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
      margin: 8px 0;
    }
    .cc-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%);
      color: #ffffff;
      border: none;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 700;
      font-family: inherit;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
      z-index: 9999;
    }
    .cc-badge:hover {
      opacity: 0.94;
    }
    .cc-preview {
      padding: 12px 14px;
      border-radius: 12px;
      background: #0f172a;
      color: #f8fafc;
      border: 1px solid rgba(56, 189, 248, 0.35);
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.35);
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-width: 480px;
      width: 100%;
      box-sizing: border-box;
      z-index: 9999;
    }
    .cc-preview-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding-bottom: 6px;
    }
    .cc-preview-title {
      font-weight: 700;
      font-size: 12px;
      color: #38bdf8;
    }
    .cc-close-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      font-size: 13px;
      padding: 2px 6px;
    }
    .cc-row {
      font-size: 12px;
      line-height: 1.45;
      color: #cbd5e1;
    }
    .cc-row strong {
      color: #f8fafc;
    }
    .cc-status {
      font-size: 11px;
      margin-top: 2px;
    }
    .cc-status--ready {
      color: #6ee7b7;
    }
    .cc-status--pending {
      color: #fcd34d;
    }
    .cc-actions {
      display: flex;
      gap: 8px;
      margin-top: 4px;
    }
    .cc-rescan-btn {
      background: rgba(56, 189, 248, 0.15);
      color: #38bdf8;
      border: 1px solid rgba(56, 189, 248, 0.35);
      border-radius: 6px;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
    }
  `;

  function getShadowElementById(id) {
    if (!activeShadowRoot) return null;
    if (typeof activeShadowRoot.getElementById === "function") {
      return activeShadowRoot.getElementById(id);
    }
    return activeWrapper?.children?.find((child) => child.id === id) || null;
  }

  function removeBadgeAndPreview() {
    document.getElementById(HOST_ID)?.remove();
    activeShadowRoot = null;
    activeWrapper = null;
  }

  function createPreviewRow(label, value) {
    const row = document.createElement("div");
    row.className = "cc-row";
    const strong = document.createElement("strong");
    strong.textContent = `${label}: `;
    const span = document.createElement("span");
    span.textContent = value;
    row.appendChild(strong);
    row.appendChild(span);
    return row;
  }

  function renderInlinePreview() {
    if (!activeShadowRoot || !activeWrapper) return;
    let preview = getShadowElementById(PREVIEW_ID);
    if (!preview) {
      preview = document.createElement("div");
      preview.id = PREVIEW_ID;
      preview.className = "cc-preview";
      preview.setAttribute("dir", "rtl");
      activeWrapper.appendChild(preview);
    }

    preview.replaceChildren();
    const info = extractLinkedInJobInfo();

    const header = document.createElement("div");
    header.className = "cc-preview-header";
    const heading = document.createElement("span");
    heading.className = "cc-preview-title";
    heading.textContent = "🧭 معاينة Career Compass";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "cc-close-btn";
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      preview.remove();
    });
    header.appendChild(heading);
    header.appendChild(closeBtn);
    preview.appendChild(header);

    preview.appendChild(createPreviewRow("المسمى الوظيفي", info.title || "غير متوفر بعد"));
    if (info.company) {
      preview.appendChild(createPreviewRow("الشركة", info.company));
    }
    if (info.location) {
      preview.appendChild(createPreviewRow("الموقع", info.location));
    }

    const statusLine = document.createElement("div");
    if (info.title && info.description.length >= 5) {
      statusLine.className = "cc-status cc-status--ready";
      statusLine.textContent = `✅ تم التقاط تفاصيل الوظيفة (${info.description.length} حرف). افتح أيقونة Career Compass من شريط المتصفح لتحليل التوافق.`;
    } else {
      statusLine.className = "cc-status cc-status--pending";
      statusLine.textContent = "⏳ بانتظار اكتمال تحميل وصف الوظيفة في الصفحة...";
    }
    preview.appendChild(statusLine);

    const actions = document.createElement("div");
    actions.className = "cc-actions";
    const rescanBtn = document.createElement("button");
    rescanBtn.type = "button";
    rescanBtn.className = "cc-rescan-btn";
    rescanBtn.textContent = "🔄 إعادة الفحص";
    rescanBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      renderInlinePreview();
    });
    actions.appendChild(rescanBtn);
    preview.appendChild(actions);
  }

  function findTopCardContainer() {
    for (const selector of TOP_CARD_CONTAINER_SELECTORS) {
      const container = document.querySelector(selector);
      if (container) return container;
    }
    return null;
  }

  function toggleInlinePreview() {
    const existingPreview = getShadowElementById(PREVIEW_ID);
    if (existingPreview) {
      existingPreview.remove();
    } else {
      renderInlinePreview();
    }
  }

  function injectCareerCompassBadge() {
    if (!isLinkedInJobsPage()) {
      removeBadgeAndPreview();
      return;
    }

    const targetContainer = findTopCardContainer();
    if (!targetContainer) return;

    const existingHost = document.getElementById(HOST_ID);
    if (existingHost) {
      if (!targetContainer.contains(existingHost) || !activeShadowRoot) {
        removeBadgeAndPreview();
      } else {
        return;
      }
    }

    const host = document.createElement("div");
    host.id = HOST_ID;
    const shadow = host.attachShadow({ mode: "closed" });
    activeShadowRoot = shadow;

    const styleEl = document.createElement("style");
    styleEl.textContent = SHADOW_STYLES;
    shadow.appendChild(styleEl);

    const wrapper = document.createElement("div");
    wrapper.className = "cc-wrapper";
    activeWrapper = wrapper;

    const badge = document.createElement("button");
    badge.type = "button";
    badge.id = BADGE_ID;
    badge.className = "cc-badge";
    const iconSpan = document.createElement("span");
    iconSpan.textContent = "🧭";
    const labelSpan = document.createElement("span");
    labelSpan.textContent = "افحص التوافق عبر Career Compass";
    badge.appendChild(iconSpan);
    badge.appendChild(labelSpan);

    badge.addEventListener("click", (e) => {
      e.stopPropagation();
      try {
        chrome.runtime.sendMessage({ type: "OPEN_POPUP_OR_HINT" }, (resp) => {
          if (chrome.runtime.lastError || !resp?.opened) {
            toggleInlinePreview();
          }
        });
      } catch {
        toggleInlinePreview();
      }
    });

    wrapper.appendChild(badge);
    shadow.appendChild(wrapper);
    targetContainer.prepend(host);
  }

  function handleRouteOrDomUpdate(forceRefresh = false) {
    const currentUrl = window.location.href;
    const urlChanged = currentUrl !== lastKnownUrl;
    if (urlChanged) {
      lastKnownUrl = currentUrl;
    }

    if (!isLinkedInJobsPage()) {
      lastJobSignature = "";
      removeBadgeAndPreview();
      return;
    }

    injectCareerCompassBadge();

    const currentTitle = getTextFromSelectors(TITLE_SELECTORS);
    const signature = `${currentUrl}|${currentTitle}`;
    if (forceRefresh || urlChanged || signature !== lastJobSignature) {
      lastJobSignature = signature;
      const badge = getShadowElementById(BADGE_ID);
      const openPreview = getShadowElementById(PREVIEW_ID);
      if (badge && openPreview) {
        renderInlinePreview();
      }
    }
  }

  function scheduleUpdate(forceRefresh = false) {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      handleRouteOrDomUpdate(forceRefresh);
    }, OBSERVER_DEBOUNCE_MS);
  }

  // Listen to Popup and Background messages with strict sender/payload validation
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (sender?.id !== chrome.runtime.id) return false;
    if (!request || typeof request !== "object") return false;

    if (request.type === "EXTRACT_LINKEDIN_JOB") {
      sendResponse(extractLinkedInJobInfo());
      return false;
    }

    if (request.type === "LINKEDIN_URL_CHANGED") {
      scheduleUpdate(true);
      sendResponse({ ok: true });
      return false;
    }

    return false;
  });

  window.addEventListener("popstate", () => scheduleUpdate(true));

  const observer = new MutationObserver(() => {
    const urlChanged = window.location.href !== lastKnownUrl;
    if (!isLinkedInJobsPage() && !urlChanged) return;
    scheduleUpdate(false);
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }

  handleRouteOrDomUpdate(true);
}
