# Career Compass — Chrome Browser Extension 🧭

> **LinkedIn Instant Compatibility, Skill Gap Audit, and Cover Letter Generator**  
> *Aligned with Phase 3 (Section 7.2) of Career Compass Technical Specification*

---

## 🌟 Overview
The Career Compass Chrome Browser Extension allows job seekers to browse vacancies on **LinkedIn**, extract the job requirements directly from the active tab, and immediately compare them against their confirmed resume profile in Career Compass.

### Features
1. **Instant Compatibility Score:** Computes real-time match percentage (0-100%).
2. **Skill Gap Breakdown:** Identifies matched skills (green badges) and missing skills (amber badges).
3. **AI Actionable Advice:** Generates immediate recommendations on positioning and resume emphasis.
4. **1-Click AI Cover Letter Snippet:** Creates a customized introduction paragraph tailored to the specific company and job title.
5. **In-Page LinkedIn Badge:** Automatically injects a floating Career Compass badge on active LinkedIn job postings.

---

## 🚀 Installation Guide (Chrome / Edge / Brave)

1. Open Google Chrome or any Chromium-based browser (Edge, Brave, Arc).
2. Navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** (تحميل إضافة لم تُحزم).
5. Select this folder: `c:\Users\msi\Downloads\career-compass\career-compass\chrome-extension`.
6. Pin the Career Compass extension icon in your browser toolbar!

---

## ⚙️ How It Works
1. Open any job posting on LinkedIn (e.g. `https://www.linkedin.com/jobs/view/...`).
2. Click the Career Compass extension icon in your toolbar.
3. The extension extracts the job title and description and communicates with your local or cloud Career Compass API (`http://localhost:8000/extension/match-job`).
4. View your compatibility score, missing skills, and 1-click tailored cover letter!
