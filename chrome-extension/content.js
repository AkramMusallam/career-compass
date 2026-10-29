// Content script injected into LinkedIn Job pages
console.log("Career Compass LinkedIn Matcher extension active.");

// استخراج بيانات الوظيفة من DOM صفحة لينكد إن
function extractLinkedInJobInfo() {
  const titleEl =
    document.querySelector(".job-details-jobs-unified-top-card__job-title") ||
    document.querySelector(".jobs-unified-top-card__job-title") ||
    document.querySelector("h1.t-24") ||
    document.querySelector(".job-title");

  const companyEl =
    document.querySelector(".job-details-jobs-unified-top-card__company-name") ||
    document.querySelector(".jobs-unified-top-card__company-name") ||
    document.querySelector(".company-name");

  const descEl =
    document.querySelector(".jobs-description__content") ||
    document.querySelector(".jobs-box__html-content") ||
    document.querySelector("#job-details");

  const title = titleEl ? titleEl.innerText.trim() : "";
  const company = companyEl ? companyEl.innerText.trim() : "";
  const description = descEl ? descEl.innerText.trim() : "";

  return { title, company, description };
}

// الاستماع لطلبات Popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "EXTRACT_LINKEDIN_JOB") {
    const jobInfo = extractLinkedInJobInfo();
    sendResponse(jobInfo);
  }
  return true;
});

// حقن شارة تفاعلية أنيقة "Career Compass Match" في رأس الوظيفة
function injectCareerCompassBadge() {
  if (document.getElementById("career-compass-inline-badge")) return;

  const targetContainer =
    document.querySelector(".jobs-unified-top-card__content--two-pane") ||
    document.querySelector(".job-details-jobs-unified-top-card");

  if (targetContainer) {
    const badge = document.createElement("div");
    badge.id = "career-compass-inline-badge";
    badge.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      margin: 8px 0;
      background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%);
      color: white;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
      z-index: 9999;
    `;
    badge.innerHTML = `🧭 <span>افحص التوافق عبر Career Compass</span>`;
    badge.addEventListener("click", () => {
      alert("افتح إضافة Career Compass من شريط أدوات المتصفح لمطابقة هذه الوظيفة مع سيرتك الذاتية وتوليد خطاب التقديم!");
    });
    targetContainer.prepend(badge);
  }
}

// تشغيل الحقن بعد تحميل الصفحة
setTimeout(injectCareerCompassBadge, 2000);
