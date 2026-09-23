import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { getErrorMessage } from "../api/client";
import { confirmExtraction } from "../api/endpoints";
import Stepper from "../components/Stepper";
import { useAnalysisFlow } from "../context/AnalysisContext";

function SkillsSection({ skills, setSkills }) {
  const [newSkill, setNewSkill] = useState("");

  const addSkill = () => {
    const trimmed = newSkill.trim();
    // منع إضافة مهارة مكررة بحالة أحرف مختلفة فقط (مثال: "Python" ثم "python") — الباك إند
    // يُطبّعها وقت التأكيد (/extract/confirm) بأي حال، لكن بدون هذا التحقق هنا كان المستخدم
    // يشوف شريحتين مختلفتين ظاهرياً بالواجهة ثم تندمجان بصمت بدون أي تنبيه له، وهو أمر مربك.
    const isDuplicate = skills.some((s) => s.toLowerCase() === trimmed.toLowerCase());
    if (trimmed && !isDuplicate) {
      setSkills([...skills, trimmed]);
    }
    setNewSkill("");
  };

  return (
    <section className="card">
      <h2 className="mb-3 font-black text-slate-800">المهارات</h2>
      {skills.length === 0 && (
        <p className="mb-3 text-sm text-slate-400">لم يتم العثور على مهارات، أضف مهاراتك يدوياً</p>
      )}
      <div className="mb-3 flex flex-wrap gap-2">
        {skills.map((skill) => (
          <span key={skill} className="chip">
            {skill}
            <button
              type="button"
              onClick={() => setSkills(skills.filter((s) => s !== skill))}
              className="mr-1 text-primary-600 hover:text-danger"
              aria-label={`حذف ${skill}`}
            >
              ✕
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          className="input-field"
          placeholder="إضافة مهارة..."
          value={newSkill}
          onChange={(e) => setNewSkill(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addSkill();
            }
          }}
        />
        <button type="button" className="btn-outline shrink-0" onClick={addSkill}>
          + إضافة مهارة
        </button>
      </div>
    </section>
  );
}

function ProjectsSection({ projects, setProjects }) {
  const updateProject = (index, patch) => {
    setProjects(projects.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };
  const removeProject = (index) => setProjects(projects.filter((_, i) => i !== index));
  const addProject = () => setProjects([...projects, { title: "", description: "", technologies: [] }]);

  return (
    <section className="card">
      <h2 className="mb-3 font-black text-slate-800">المشاريع</h2>
      {projects.length === 0 && (
        <p className="mb-3 text-sm text-slate-400">لم يتم العثور على مشاريع، أضف مشاريعك يدوياً</p>
      )}
      <div className="space-y-3">
        {projects.map((project, index) => (
          <div key={index} className="rounded-xl border border-slate-200 p-4">
            <div className="mb-2 flex items-center gap-2">
              <input
                type="text"
                className="input-field"
                placeholder="عنوان المشروع"
                value={project.title}
                onChange={(e) => updateProject(index, { title: e.target.value })}
              />
              <button
                type="button"
                onClick={() => removeProject(index)}
                className="shrink-0 rounded-full p-2 text-slate-400 hover:bg-danger-50 hover:text-danger"
                aria-label="حذف المشروع"
              >
                🗑️
              </button>
            </div>
            <textarea
              className="input-field mb-2"
              rows={2}
              placeholder="وصف المشروع"
              value={project.description}
              onChange={(e) => updateProject(index, { description: e.target.value })}
            />
            <input
              type="text"
              className="input-field"
              placeholder="التقنيات المستخدمة (مفصولة بفاصلة)"
              value={(project.technologies || []).join(", ")}
              onChange={(e) =>
                updateProject(index, {
                  technologies: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                })
              }
            />
          </div>
        ))}
      </div>
      <button type="button" className="btn-outline mt-3" onClick={addProject}>
        + إضافة مشروع
      </button>
    </section>
  );
}

function EducationSection({ education, setEducation }) {
  const update = (index, patch) => setEducation(education.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  const remove = (index) => setEducation(education.filter((_, i) => i !== index));
  const add = () => setEducation([...education, { degree: "", institution: "", year: "" }]);

  return (
    <section className="card">
      <h2 className="mb-3 font-black text-slate-800">التعليم</h2>
      {education.length === 0 && <p className="mb-3 text-sm text-slate-400">لم يتم العثور على بيانات تعليمية</p>}
      <div className="space-y-3">
        {education.map((edu, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 p-4">
            <input
              type="text"
              className="input-field flex-1"
              placeholder="الدرجة العلمية"
              value={edu.degree}
              onChange={(e) => update(index, { degree: e.target.value })}
            />
            <input
              type="text"
              className="input-field flex-1"
              placeholder="المؤسسة"
              value={edu.institution}
              onChange={(e) => update(index, { institution: e.target.value })}
            />
            <input
              type="number"
              className="input-field w-28"
              placeholder="السنة"
              value={edu.year || ""}
              onChange={(e) => update(index, { year: e.target.value ? Number(e.target.value) : null })}
            />
            <button
              type="button"
              onClick={() => remove(index)}
              className="rounded-full p-2 text-slate-400 hover:bg-danger-50 hover:text-danger"
              aria-label="حذف"
            >
              🗑️
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="btn-outline mt-3" onClick={add}>
        + إضافة
      </button>
    </section>
  );
}

function ExperienceSection({ experience, setExperience }) {
  const update = (index, patch) => setExperience(experience.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  const remove = (index) => setExperience(experience.filter((_, i) => i !== index));
  const add = () => setExperience([...experience, { title: "", company: "", duration_months: 0, description: "" }]);

  return (
    <section className="card">
      <h2 className="mb-3 font-black text-slate-800">الخبرة</h2>
      {experience.length === 0 && <p className="mb-3 text-sm text-slate-400">لم يتم العثور على خبرات عملية</p>}
      <div className="space-y-3">
        {experience.map((exp, index) => (
          <div key={index} className="rounded-xl border border-slate-200 p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <input
                type="text"
                className="input-field flex-1"
                placeholder="المسمى الوظيفي"
                value={exp.title}
                onChange={(e) => update(index, { title: e.target.value })}
              />
              <input
                type="text"
                className="input-field flex-1"
                placeholder="الشركة"
                value={exp.company}
                onChange={(e) => update(index, { company: e.target.value })}
              />
              <input
                type="number"
                className="input-field w-32"
                placeholder="المدة (أشهر)"
                value={exp.duration_months || 0}
                onChange={(e) => update(index, { duration_months: Number(e.target.value) })}
              />
              <button
                type="button"
                onClick={() => remove(index)}
                className="rounded-full p-2 text-slate-400 hover:bg-danger-50 hover:text-danger"
                aria-label="حذف"
              >
                🗑️
              </button>
            </div>
            <textarea
              className="input-field"
              rows={2}
              placeholder="الوصف"
              value={exp.description}
              onChange={(e) => update(index, { description: e.target.value })}
            />
          </div>
        ))}
      </div>
      <button type="button" className="btn-outline mt-3" onClick={add}>
        + إضافة
      </button>
    </section>
  );
}

export default function ReviewExtractedData() {
  const navigate = useNavigate();
  const { extractionId, extractedData } = useAnalysisFlow();

  const [skills, setSkills] = useState(extractedData?.skills || []);
  const [projects, setProjects] = useState(extractedData?.projects || []);
  const [education, setEducation] = useState(extractedData?.education || []);
  const [experience, setExperience] = useState(extractedData?.experience || []);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  if (!extractionId || !extractedData) {
    navigate("/analysis/upload", { replace: true });
    return null;
  }

  const canContinue = skills.length > 0 && !isSaving;

  const handleConfirm = async () => {
    if (!canContinue) return;
    setIsSaving(true);
    setErrorMessage("");
    try {
      await confirmExtraction({
        extraction_id: extractionId,
        skills,
        projects: projects.map((p) => ({
          title: p.title || "Untitled",
          description: p.description || "",
          technologies: p.technologies || [],
        })),
        education: education
          .filter((e) => e.degree)
          .map((e) => ({ degree: e.degree, institution: e.institution || "", year: e.year || null })),
        experience: experience
          .filter((e) => e.title)
          .map((e) => ({
            title: e.title,
            company: e.company || "",
            duration_months: e.duration_months || 0,
            description: e.description || "",
          })),
      });
      navigate("/analysis/assessment");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "تعذر حفظ التغييرات"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Stepper currentStep="review" />

      <div>
        <h1 className="text-xl font-black text-slate-800">مراجعة البيانات المستخرجة</h1>
        <p className="text-sm text-slate-500">
          راجع البيانات التي استخرجناها من سيرتك الذاتية وعدّلها إن لزم — دقة هذه الخطوة تؤثر مباشرة على دقة النتيجة
        </p>
      </div>

      {errorMessage && (
        <div className="alert-banner-error" role="alert">
          <span aria-hidden="true">⚠️</span>
          <span>{errorMessage}</span>
        </div>
      )}

      <SkillsSection skills={skills} setSkills={setSkills} />
      <ProjectsSection projects={projects} setProjects={setProjects} />
      <EducationSection education={education} setEducation={setEducation} />
      <ExperienceSection experience={experience} setExperience={setExperience} />

      {skills.length === 0 && (
        <p className="text-sm font-semibold text-warning">يجب وجود مهارة واحدة على الأقل للمتابعة</p>
      )}

      <div className="flex justify-between gap-3">
        <button type="button" className="btn-outline" onClick={() => navigate("/analysis/upload")}>
          السابق
        </button>
        <button type="button" className="btn-primary" disabled={!canContinue} onClick={handleConfirm}>
          {isSaving ? "جاري الحفظ..." : "تأكيد ومتابعة"}
        </button>
      </div>
    </div>
  );
}
