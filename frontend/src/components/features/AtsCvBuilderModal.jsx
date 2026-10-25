import { useEffect, useState } from "react";
import { getErrorMessage } from "../../api/client";
import { exportAtsResumePdf, optimizeAtsResume } from "../../api/endpoints";

export default function AtsCvBuilderModal({
  extractionId,
  initialSkills = [],
  initialExperience = [],
  initialProjects = [],
  initialEducation = [],
  defaultRole = "",
  onClose,
}) {
  const [activeTab, setActiveTab] = useState("edit"); // "edit" | "preview"
  const [loadingOptimize, setLoadingOptimize] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [newSkillInput, setNewSkillInput] = useState("");

  const [form, setForm] = useState({
    full_name: "",
    target_role: defaultRole || "",
    email: "",
    phone: "",
    location: "",
    linkedin_url: "",
    summary: "",
    skills: initialSkills,
    experience: initialExperience,
    projects: initialProjects,
    education: initialEducation,
  });

  useEffect(() => {
    let mounted = true;
    setLoadingOptimize(true);
    optimizeAtsResume(extractionId, {
      target_role: defaultRole || "",
      skills: initialSkills,
      experience: initialExperience,
      projects: initialProjects,
      education: initialEducation,
    })
      .then((res) => {
        if (!mounted) return;
        const d = res.data;
        setForm({
          full_name: d.full_name || "",
          target_role: d.target_role || defaultRole || "Software Engineer",
          email: d.email || "",
          phone: d.phone || "",
          location: d.location || "",
          linkedin_url: d.linkedin_url || "",
          summary: d.summary || "",
          skills: d.skills?.length ? d.skills : initialSkills,
          experience: d.experience?.length ? d.experience : initialExperience,
          projects: d.projects?.length ? d.projects : initialProjects,
          education: d.education?.length ? d.education : initialEducation,
        });
      })
      .catch((err) => {
        if (mounted) {
          setErrorMsg(getErrorMessage(err, "تعذر جلب البيانات المحسّنة تلقائياً"));
        }
      })
      .finally(() => {
        if (mounted) setLoadingOptimize(false);
      });

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extractionId]);

  const handleRegenerateSummary = async () => {
    setLoadingOptimize(true);
    setErrorMsg("");
    try {
      const res = await optimizeAtsResume(extractionId, {
        ...form,
        summary: "",
      });
      setForm((prev) => ({
        ...prev,
        summary: res.data.summary || prev.summary,
      }));
    } catch (err) {
      setErrorMsg(getErrorMessage(err, "تعذر توليد الملخص المهني بالذكاء الاصطناعي"));
    } finally {
      setLoadingOptimize(false);
    }
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    setErrorMsg("");
    try {
      const res = await exportAtsResumePdf(extractionId, form);
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = (form.full_name || "ATS-Resume").replace(/\s+/g, "-");
      a.download = `${safeName}-ATS-CV.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setErrorMsg(getErrorMessage(err, "تعذر تصدير ملف الـ PDF المتوافق مع ATS"));
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-4xl rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-l from-indigo-50 via-white to-emerald-50 px-6 py-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">📄</span>
              <h2 className="text-lg font-black text-slate-900">
                منشئ ومُصدِّر السيرة الذاتية المتوافقة مع ATS
              </h2>
              <span className="rounded-full bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-800">
                ATS-Compliant Builder
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              نسّق سيرتك الذاتية بهيكلية قياسية أحادية العمود مقروءة بنسبة 100% لأنظمة الفرز الآلي (ATS) وصدّرها فوراً كـ PDF
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTab("edit")}
                className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition ${
                  activeTab === "edit"
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                ✏️ التحرير والتخصيص
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition ${
                  activeTab === "preview"
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                👁️ معاينة ATS المباشرة
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100"
            >
              ✕ إغلاق
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMsg && (
            <div className="alert-banner-error text-xs">
              <span>⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {loadingOptimize ? (
            <div className="py-12 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-3" />
              <p className="text-sm font-bold text-slate-600">
                جاري تحسين الصياغة وتجهيز قالب ATS الذكي...
              </p>
            </div>
          ) : activeTab === "edit" ? (
            <div className="space-y-5">
              {/* Contact & Role Info */}
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    الاسم الكامل
                  </label>
                  <input
                    type="text"
                    className="input-field !py-2 text-xs"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    placeholder="مثال: أحمد محمد"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    المسمى الوظيفي المستهدف (Target Role)
                  </label>
                  <input
                    type="text"
                    className="input-field !py-2 text-xs"
                    value={form.target_role}
                    onChange={(e) => setForm({ ...form, target_role: e.target.value })}
                    placeholder="Software Engineer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    البريد الإلكتروني
                  </label>
                  <input
                    type="email"
                    className="input-field !py-2 text-xs"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="name@example.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    رقم الهاتف (اختياري)
                  </label>
                  <input
                    type="text"
                    className="input-field !py-2 text-xs"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+962 7X XXX XXXX"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    المدينة / الدولة (اختياري)
                  </label>
                  <input
                    type="text"
                    className="input-field !py-2 text-xs"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="Amman, Jordan"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    رابط LinkedIn / GitHub (اختياري)
                  </label>
                  <input
                    type="text"
                    className="input-field !py-2 text-xs"
                    value={form.linkedin_url}
                    onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })}
                    placeholder="linkedin.com/in/username"
                  />
                </div>
              </div>

              {/* Professional Summary */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <label className="text-xs font-black text-slate-800">
                    الملخص المهني المتوافق مع ATS (Professional Summary)
                  </label>
                  <button
                    type="button"
                    onClick={handleRegenerateSummary}
                    className="rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-1 text-xs font-extrabold text-indigo-700 hover:bg-indigo-100"
                  >
                    ✨ توليد/تحسين بالذكاء الاصطناعي
                  </button>
                </div>
                <textarea
                  rows={3}
                  className="input-field text-xs leading-relaxed"
                  value={form.summary}
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                  placeholder="اكتب ملخصاً مهنياً يبرز أهم مهاراتك وسنوات خبرتك..."
                />
              </div>

              {/* Skills */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <label className="block text-xs font-black text-slate-800">
                    الكلمات المفتاحية والمهارات التقنية ({form.skills.length} مهارة)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      className="input-field !py-1 !px-2.5 text-xs w-44"
                      value={newSkillInput}
                      onChange={(e) => setNewSkillInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const trimmed = newSkillInput.trim();
                          if (trimmed && !form.skills.includes(trimmed)) {
                            setForm({ ...form, skills: [...form.skills, trimmed] });
                            setNewSkillInput("");
                          }
                        }
                      }}
                      placeholder="أضف مهارة جديدة..."
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const trimmed = newSkillInput.trim();
                        if (trimmed && !form.skills.includes(trimmed)) {
                          setForm({ ...form, skills: [...form.skills, trimmed] });
                          setNewSkillInput("");
                        }
                      }}
                      className="rounded-lg bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-xs font-extrabold text-indigo-700 hover:bg-indigo-100"
                    >
                      + إضافة
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {form.skills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-xs font-bold text-indigo-800"
                    >
                      <span>{skill}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            skills: form.skills.filter((_, i) => i !== idx),
                          })
                        }
                        className="text-indigo-400 hover:text-rose-600 font-black"
                        title="حذف المهارة"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Live ATS Resume Preview */
            <div className="mx-auto max-w-2xl rounded-2xl border-2 border-slate-300 bg-white p-8 shadow-inner text-slate-900 space-y-4">
              <div className="text-center border-b border-slate-300 pb-4">
                <h3 className="text-2xl font-black text-slate-900">
                  {form.full_name || "Candidate Name"}
                </h3>
                <p className="text-sm font-bold text-indigo-700 mt-0.5">
                  {form.target_role || "Software Engineer"}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {[form.email, form.phone, form.location, form.linkedin_url]
                    .filter(Boolean)
                    .join("  |  ")}
                </p>
              </div>

              {form.summary && (
                <div className="border-b border-slate-200 pb-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-indigo-800 mb-1">
                    PROFESSIONAL SUMMARY
                  </h4>
                  <p className="text-xs text-slate-700 leading-relaxed">{form.summary}</p>
                </div>
              )}

              {form.skills?.length > 0 && (
                <div className="border-b border-slate-200 pb-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-indigo-800 mb-1">
                    TECHNICAL SKILLS & CORE COMPETENCIES
                  </h4>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {form.skills.join(" • ")}
                  </p>
                </div>
              )}

              {form.experience?.length > 0 && (
                <div className="border-b border-slate-200 pb-3 space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-indigo-800 mb-1">
                    PROFESSIONAL EXPERIENCE
                  </h4>
                  {form.experience.map((exp, idx) => (
                    <div key={idx}>
                      <p className="text-xs font-bold text-slate-900">
                        {exp.title} {exp.company ? `— ${exp.company}` : ""}{" "}
                        {exp.duration_months ? `(${exp.duration_months} months)` : ""}
                      </p>
                      {exp.description && (
                        <p className="text-xs text-slate-600">{exp.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {form.projects?.length > 0 && (
                <div className="border-b border-slate-200 pb-3 space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-indigo-800 mb-1">
                    KEY PROJECTS
                  </h4>
                  {form.projects.map((proj, idx) => (
                    <div key={idx}>
                      <p className="text-xs font-bold text-slate-900">
                        {proj.title}{" "}
                        {proj.technologies?.length
                          ? `[${proj.technologies.join(", ")}]`
                          : ""}
                      </p>
                      {proj.description && (
                        <p className="text-xs text-slate-600">{proj.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {form.education?.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-xs font-black uppercase tracking-wider text-indigo-800 mb-1">
                    EDUCATION
                  </h4>
                  {form.education.map((edu, idx) => (
                    <p key={idx} className="text-xs font-bold text-slate-800">
                      {[edu.degree, edu.institution, edu.year].filter(Boolean).join(" — ")}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 px-6 py-4 border-t border-slate-200">
          <span className="text-xs font-semibold text-slate-500">
            ✓ تنسيق قياسي متوافق مع قارئات السير الذاتية الآلية (ATS) باللغتين العربية والإنجليزية
          </span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="btn-outline !py-2.5 !px-4 !text-xs"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exportingPdf || loadingOptimize}
              className="btn-primary !py-2.5 !px-5 !text-xs"
            >
              {exportingPdf
                ? "جاري توليد ملف PDF..."
                : "⬇️ تصدير السيرة الذاتية كـ PDF متوافق مع ATS"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
