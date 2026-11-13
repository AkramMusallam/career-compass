import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  FileText,
  PenLine,
  Eye,
  X,
  AlertCircle,
  Sparkles,
  Plus,
  Download,
  Check,
} from "lucide-react";
import { getErrorMessage } from "../../api/client";
import { exportAtsResumePdf, optimizeAtsResume } from "../../api/endpoints";

function normalizeProjectsForState(list) {
  return (Array.isArray(list) ? list : []).map((proj) => {
    const technologies = Array.isArray(proj?.technologies) ? proj.technologies : [];
    return {
      title: proj?.title || "",
      description: proj?.description || "",
      technologies,
      _techText: technologies.join(", "),
    };
  });
}

function sanitizeAtsPayload(form) {
  return {
    full_name: form.full_name || "",
    target_role: form.target_role || "",
    email: form.email || "",
    phone: form.phone || "",
    location: form.location || "",
    linkedin_url: form.linkedin_url || "",
    summary: form.summary || "",
    skills: Array.isArray(form.skills) ? form.skills.filter(Boolean) : [],
    experience: (Array.isArray(form.experience) ? form.experience : []).map((exp) => ({
      title: exp?.title || "",
      company: exp?.company || "",
      duration_months: Math.max(0, Number.parseInt(exp?.duration_months, 10) || 0),
      description: exp?.description || "",
    })),
    projects: (Array.isArray(form.projects) ? form.projects : []).map((proj) => {
      const techs =
        typeof proj?._techText === "string"
          ? proj._techText.split(/[،,]/).map((s) => s.trim()).filter(Boolean)
          : Array.isArray(proj?.technologies)
            ? proj.technologies.filter(Boolean)
            : [];
      return {
        title: proj?.title || "",
        description: proj?.description || "",
        technologies: techs,
      };
    }),
    education: (Array.isArray(form.education) ? form.education : []).map((edu) => {
      const parsedYear =
        edu?.year !== "" && edu?.year != null ? Number.parseInt(edu.year, 10) : NaN;
      return {
        degree: edu?.degree || "",
        institution: edu?.institution || "",
        year: Number.isFinite(parsedYear) ? parsedYear : null,
      };
    }),
  };
}

export default function AtsCvBuilderModal({
  extractionId,
  initialSkills = [],
  initialExperience = [],
  initialProjects = [],
  initialEducation = [],
  defaultRole = "",
  onClose,
}) {
  const [activeTab, setActiveTab] = useState("edit");
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
    skills: Array.isArray(initialSkills) ? initialSkills : [],
    experience: Array.isArray(initialExperience) ? initialExperience : [],
    projects: normalizeProjectsForState(initialProjects),
    education: Array.isArray(initialEducation) ? initialEducation : [],
  });

  useEffect(() => {
    let mounted = true;
    setLoadingOptimize(true);
    optimizeAtsResume(
      extractionId,
      sanitizeAtsPayload({
        target_role: defaultRole || "",
        skills: initialSkills,
        experience: initialExperience,
        projects: initialProjects,
        education: initialEducation,
      })
    )
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
          projects: normalizeProjectsForState(
            d.projects?.length ? d.projects : initialProjects
          ),
          education: d.education?.length ? d.education : initialEducation,
        });
      })
      .catch((err) => {
        if (mounted) {
          setErrorMsg(
            getErrorMessage(err, "تعذر جلب البيانات المحسّنة تلقائياً")
          );
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
      const res = await optimizeAtsResume(
        extractionId,
        sanitizeAtsPayload({ ...form, summary: "" })
      );
      setForm((prev) => ({
        ...prev,
        summary: res.data.summary || prev.summary,
      }));
    } catch (err) {
      setErrorMsg(
        getErrorMessage(err, "تعذر توليد الملخص المهني بالذكاء الاصطناعي")
      );
    } finally {
      setLoadingOptimize(false);
    }
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    setErrorMsg("");
    try {
      const res = await exportAtsResumePdf(extractionId, sanitizeAtsPayload(form));
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
      setErrorMsg(
        getErrorMessage(err, "تعذر تصدير ملف الـ PDF المتوافق مع ATS")
      );
    } finally {
      setExportingPdf(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-4xl rounded-2xl bg-white border border-slate-200 shadow-elevated overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 px-4 sm:px-6 py-4 border-b border-slate-200">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <FileText size={18} className="text-primary-600" />
              <h2 className="text-sm sm:text-base font-black text-slate-900">
                منشئ ومُصدِّر السيرة الذاتية المتوافقة مع ATS
              </h2>
              <span className="rounded-md bg-secondary-50 border border-secondary-200 px-2 py-0.5 text-[10px] font-bold text-secondary-700">
                ATS-Compliant
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              نسّق سيرتك الذاتية بهيكلية قياسية أحادية العمود مقروءة لأنظمة الفرز الآلي وصدّرها فوراً كـ PDF
            </p>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2">
            <div className="inline-flex rounded-xl bg-slate-200/70 p-1">
              <button
                type="button"
                onClick={() => setActiveTab("edit")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${
                  activeTab === "edit"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <PenLine size={13} />
                <span>التحرير</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${
                  activeTab === "preview"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Eye size={13} />
                <span>معاينة ATS</span>
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-100"
              aria-label="إغلاق"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {errorMsg && (
            <div className="alert-banner-error text-xs">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {loadingOptimize ? (
            <div className="py-12 text-center">
              <div className="inline-block h-7 w-7 animate-spin rounded-full border-2 border-solid border-primary-600 border-r-transparent mb-3" />
              <p className="text-xs sm:text-sm font-bold text-slate-600">
                جاري تحسين الصياغة وتجهيز قالب ATS الذكي...
              </p>
            </div>
          ) : activeTab === "edit" ? (
            <div className="space-y-4">
              {/* Contact & Role Info */}
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    الاسم الكامل
                  </label>
                  <input
                    type="text"
                    className="input-field !py-2 text-xs"
                    value={form.full_name}
                    onChange={(e) =>
                      setForm({ ...form, full_name: e.target.value })
                    }
                    placeholder="مثال: أحمد محمد"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    المسمى الوظيفي المستهدف
                  </label>
                  <input
                    type="text"
                    className="input-field !py-2 text-xs"
                    value={form.target_role}
                    onChange={(e) =>
                      setForm({ ...form, target_role: e.target.value })
                    }
                    placeholder="Software Engineer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    المدينة / الدولة (اختياري)
                  </label>
                  <input
                    type="text"
                    className="input-field !py-2 text-xs"
                    value={form.location}
                    onChange={(e) =>
                      setForm({ ...form, location: e.target.value })
                    }
                    placeholder="Amman, Jordan"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    رابط LinkedIn / GitHub (اختياري)
                  </label>
                  <input
                    type="text"
                    className="input-field !py-2 text-xs"
                    value={form.linkedin_url}
                    onChange={(e) =>
                      setForm({ ...form, linkedin_url: e.target.value })
                    }
                    placeholder="linkedin.com/in/username"
                  />
                </div>
              </div>

              {/* Professional Summary */}
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <label className="text-xs font-black text-slate-800">
                    الملخص المهني المتوافق مع ATS
                  </label>
                  <button
                    type="button"
                    onClick={handleRegenerateSummary}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary-50 border border-primary-200 px-2.5 py-1 text-xs font-bold text-primary-700 hover:bg-primary-100"
                  >
                    <Sparkles size={13} />
                    <span>توليد/تحسين بالذكاء الاصطناعي</span>
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
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <label className="block text-xs font-black text-slate-800">
                    الكلمات المفتاحية والمهارات التقنية ({form.skills.length} مهارة)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      className="input-field !py-1.5 !px-2.5 text-xs w-40 sm:w-48"
                      value={newSkillInput}
                      onChange={(e) => setNewSkillInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const trimmed = newSkillInput.trim();
                          if (trimmed && !form.skills.includes(trimmed)) {
                            setForm({
                              ...form,
                              skills: [...form.skills, trimmed],
                            });
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
                          setForm({
                            ...form,
                            skills: [...form.skills, trimmed],
                          });
                          setNewSkillInput("");
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-primary-50 border border-primary-200 px-2.5 py-1.5 text-xs font-bold text-primary-700 hover:bg-primary-100"
                    >
                      <Plus size={13} />
                      <span>إضافة</span>
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {form.skills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700"
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
                        className="text-slate-400 hover:text-danger"
                        title="حذف المهارة"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Experience */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-black text-slate-800">
                    الخبرات العملية ({form.experience.length})
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        experience: [
                          ...prev.experience,
                          { title: "", company: "", duration_months: 0, description: "" },
                        ],
                      }))
                    }
                    className="inline-flex items-center gap-1 rounded-lg bg-primary-50 border border-primary-200 px-2.5 py-1 text-xs font-bold text-primary-700 hover:bg-primary-100"
                  >
                    <Plus size={13} />
                    <span>إضافة خبرة</span>
                  </button>
                </div>
                {form.experience.map((exp, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-500">
                        خبرة #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            experience: prev.experience.filter((_, i) => i !== idx),
                          }))
                        }
                        className="text-xs font-bold text-slate-400 hover:text-danger"
                        aria-label="حذف الخبرة"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="grid gap-2.5 sm:grid-cols-3">
                      <input
                        type="text"
                        className="input-field !py-1.5 text-xs"
                        value={exp.title || ""}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            experience: prev.experience.map((item, i) =>
                              i === idx ? { ...item, title: e.target.value } : item
                            ),
                          }))
                        }
                        placeholder="المسمى الوظيفي"
                      />
                      <input
                        type="text"
                        className="input-field !py-1.5 text-xs"
                        value={exp.company || ""}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            experience: prev.experience.map((item, i) =>
                              i === idx ? { ...item, company: e.target.value } : item
                            ),
                          }))
                        }
                        placeholder="اسم الشركة"
                      />
                      <input
                        type="number"
                        min={0}
                        className="input-field !py-1.5 text-xs"
                        value={exp.duration_months ?? 0}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            experience: prev.experience.map((item, i) =>
                              i === idx
                                ? { ...item, duration_months: e.target.value }
                                : item
                            ),
                          }))
                        }
                        placeholder="المدة بالأشهر"
                      />
                    </div>
                    <textarea
                      rows={2}
                      className="input-field text-xs leading-relaxed"
                      value={exp.description || ""}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          experience: prev.experience.map((item, i) =>
                            i === idx ? { ...item, description: e.target.value } : item
                          ),
                        }))
                      }
                      placeholder="ملخص المهام والإنجازات..."
                    />
                  </div>
                ))}
              </div>

              {/* Projects */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-black text-slate-800">
                    المشاريع الرئيسية ({form.projects.length})
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        projects: [
                          ...prev.projects,
                          { title: "", description: "", technologies: [], _techText: "" },
                        ],
                      }))
                    }
                    className="inline-flex items-center gap-1 rounded-lg bg-primary-50 border border-primary-200 px-2.5 py-1 text-xs font-bold text-primary-700 hover:bg-primary-100"
                  >
                    <Plus size={13} />
                    <span>إضافة مشروع</span>
                  </button>
                </div>
                {form.projects.map((proj, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-500">
                        مشروع #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            projects: prev.projects.filter((_, i) => i !== idx),
                          }))
                        }
                        className="text-xs font-bold text-slate-400 hover:text-danger"
                        aria-label="حذف المشروع"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <input
                        type="text"
                        className="input-field !py-1.5 text-xs"
                        value={proj.title || ""}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            projects: prev.projects.map((item, i) =>
                              i === idx ? { ...item, title: e.target.value } : item
                            ),
                          }))
                        }
                        placeholder="اسم المشروع"
                      />
                      <input
                        type="text"
                        className="input-field !py-1.5 text-xs"
                        dir="ltr"
                        value={
                          typeof proj._techText === "string"
                            ? proj._techText
                            : (proj.technologies || []).join(", ")
                        }
                        onChange={(e) => {
                          const raw = e.target.value;
                          const parsed = raw
                            .split(/[،,]/)
                            .map((s) => s.trim())
                            .filter(Boolean);
                          setForm((prev) => ({
                            ...prev,
                            projects: prev.projects.map((item, i) =>
                              i === idx
                                ? { ...item, _techText: raw, technologies: parsed }
                                : item
                            ),
                          }));
                        }}
                        placeholder="React, FastAPI, PostgreSQL"
                      />
                    </div>
                    <textarea
                      rows={2}
                      className="input-field text-xs leading-relaxed"
                      value={proj.description || ""}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          projects: prev.projects.map((item, i) =>
                            i === idx ? { ...item, description: e.target.value } : item
                          ),
                        }))
                      }
                      placeholder="وصف المشروع وأبرز النتائج..."
                    />
                  </div>
                ))}
              </div>

              {/* Education */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-black text-slate-800">
                    التعليم والشهادات ({form.education.length})
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        education: [
                          ...prev.education,
                          { degree: "", institution: "", year: "" },
                        ],
                      }))
                    }
                    className="inline-flex items-center gap-1 rounded-lg bg-primary-50 border border-primary-200 px-2.5 py-1 text-xs font-bold text-primary-700 hover:bg-primary-100"
                  >
                    <Plus size={13} />
                    <span>إضافة مؤهل</span>
                  </button>
                </div>
                {form.education.map((edu, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-500">
                        مؤهل #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            education: prev.education.filter((_, i) => i !== idx),
                          }))
                        }
                        className="text-xs font-bold text-slate-400 hover:text-danger"
                        aria-label="حذف المؤهل"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="grid gap-2.5 sm:grid-cols-3">
                      <input
                        type="text"
                        className="input-field !py-1.5 text-xs"
                        value={edu.degree || ""}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            education: prev.education.map((item, i) =>
                              i === idx ? { ...item, degree: e.target.value } : item
                            ),
                          }))
                        }
                        placeholder="الدرجة / التخصص"
                      />
                      <input
                        type="text"
                        className="input-field !py-1.5 text-xs"
                        value={edu.institution || ""}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            education: prev.education.map((item, i) =>
                              i === idx ? { ...item, institution: e.target.value } : item
                            ),
                          }))
                        }
                        placeholder="الجامعة / المؤسسة"
                      />
                      <input
                        type="number"
                        className="input-field !py-1.5 text-xs"
                        value={edu.year ?? ""}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            education: prev.education.map((item, i) =>
                              i === idx ? { ...item, year: e.target.value } : item
                            ),
                          }))
                        }
                        placeholder="سنة التخرج (مثال: 2024)"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Live ATS Resume Preview */
            <div
              dir="ltr"
              className="mx-auto max-w-2xl rounded-xl border border-slate-300 bg-white p-5 sm:p-8 text-slate-900 space-y-4 text-left"
            >
              <div className="text-center border-b border-slate-300 pb-4">
                <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                  {form.full_name || "Candidate Name"}
                </h3>
                <p className="text-xs sm:text-sm font-bold text-primary-700 mt-0.5">
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
                  <h4 className="text-xs font-black uppercase tracking-wider text-primary-800 mb-1">
                    PROFESSIONAL SUMMARY
                  </h4>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {form.summary}
                  </p>
                </div>
              )}

              {form.skills?.length > 0 && (
                <div className="border-b border-slate-200 pb-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-primary-800 mb-1">
                    TECHNICAL SKILLS & CORE COMPETENCIES
                  </h4>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {form.skills.join(" • ")}
                  </p>
                </div>
              )}

              {form.experience?.length > 0 && (
                <div className="border-b border-slate-200 pb-3 space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-primary-800 mb-1">
                    PROFESSIONAL EXPERIENCE
                  </h4>
                  {form.experience.map((exp, idx) => (
                    <div key={idx}>
                      <p className="text-xs font-bold text-slate-900">
                        {exp.title} {exp.company ? `— ${exp.company}` : ""}{" "}
                        {exp.duration_months
                          ? `(${exp.duration_months} months)`
                          : ""}
                      </p>
                      {exp.description && (
                        <p className="text-xs text-slate-600">
                          {exp.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {form.projects?.length > 0 && (
                <div className="border-b border-slate-200 pb-3 space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-primary-800 mb-1">
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
                        <p className="text-xs text-slate-600">
                          {proj.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {form.education?.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-xs font-black uppercase tracking-wider text-primary-800 mb-1">
                    EDUCATION
                  </h4>
                  {form.education.map((edu, idx) => (
                    <p key={idx} className="text-xs font-bold text-slate-800">
                      {[edu.degree, edu.institution, edu.year]
                        .filter(Boolean)
                        .join(" — ")}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 px-4 sm:px-6 py-3.5 border-t border-slate-200">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <Check size={14} className="text-secondary-600 shrink-0" />
            <span>تنسيق قياسي متوافق مع قارئات السير الذاتية الآلية (ATS)</span>
          </span>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-outline !py-2 !px-3.5 !text-xs"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exportingPdf || loadingOptimize}
              className="btn-primary !py-2 !px-4 !text-xs"
            >
              <Download size={14} />
              <span>
                {exportingPdf
                  ? "جاري توليد ملف PDF..."
                  : "تصدير السيرة كـ PDF متوافق مع ATS"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
