import { useState, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  FileText,
  X,
  Plus,
  Trash2,
  AlertCircle,
  Briefcase,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";

import { getErrorMessage } from "../../api/client";
import { confirmExtraction, getAtsScore } from "../../api/endpoints";
import AtsCvBuilderModal from "../../components/features/AtsCvBuilderModal";
import Stepper from "../../components/ui/Stepper";
import { useAnalysisFlow } from "../../context/AnalysisContext";

function AtsScoreSection({ extractionId, onOpenAtsBuilder }) {
  const [scoreData, setScoreData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    getAtsScore(extractionId)
      .then((res) => {
        if (isMounted) {
          setScoreData(res.data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [extractionId]);

  if (loading)
    return (
      <div className="card">
        <h2 className="mb-2 text-sm font-black text-slate-800">ATS Score</h2>
        <p className="text-xs text-slate-500">جاري تقييم السيرة الذاتية (ATS)...</p>
      </div>
    );
  if (!scoreData) return null;

  return (
    <section className="card !bg-primary-50/70 !border-primary-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <h2 className="text-sm sm:text-base font-black text-slate-900">
          مقياس توافق السيرة الذاتية (ATS Score)
        </h2>
        {onOpenAtsBuilder && (
          <button
            type="button"
            onClick={onOpenAtsBuilder}
            className="btn-primary !py-2 !px-3.5 !text-xs"
          >
            <FileText size={14} />
            <span>بناء وتصدير سيرة ذاتية متوافقة مع ATS</span>
          </button>
        )}
      </div>
      <div className="flex items-center gap-4 mb-3">
        <div
          className={`text-3xl sm:text-4xl font-black ${
            scoreData.score >= 70 ? "text-secondary-600" : "text-accent-600"
          }`}
        >
          {scoreData.score}%
        </div>
        <p className="text-xs sm:text-sm text-slate-600">
          هذا التقييم يوضح مدى توافق سيرتك الذاتية مع أنظمة الفرز الآلي (ATS).
        </p>
      </div>
      {scoreData.feedback && scoreData.feedback.length > 0 && (
        <div>
          <h3 className="font-bold text-xs sm:text-sm text-slate-800 mb-1.5">
            ملاحظات التحسين:
          </h3>
          <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-slate-600">
            {scoreData.feedback.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function SkillsSection({ skills, setSkills }) {
  const [newSkill, setNewSkill] = useState("");

  const addSkill = () => {
    const trimmed = newSkill.trim();
    const isDuplicate = skills.some(
      (s) => s.toLowerCase() === trimmed.toLowerCase()
    );
    if (trimmed && !isDuplicate) {
      setSkills([...skills, trimmed]);
    }
    setNewSkill("");
  };

  return (
    <section className="card">
      <h2 className="mb-3 text-base font-black text-slate-900">المهارات</h2>
      {skills.length === 0 && (
        <p className="mb-3 text-xs sm:text-sm text-slate-400">
          لم يتم العثور على مهارات، أضف مهاراتك يدوياً
        </p>
      )}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {skills.map((skill) => (
          <span key={skill} className="chip">
            <span>{skill}</span>
            <button
              type="button"
              onClick={() => setSkills(skills.filter((s) => s !== skill))}
              className="mr-1 rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-danger"
              aria-label={`حذف ${skill}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
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
          <Plus size={15} />
          <span>إضافة مهارة</span>
        </button>
      </div>
    </section>
  );
}

function ProjectsSection({ projects, setProjects }) {
  const updateProject = (index, patch) => {
    setProjects(projects.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };
  const removeProject = (index) =>
    setProjects(projects.filter((_, i) => i !== index));
  const addProject = () =>
    setProjects([...projects, { title: "", description: "", technologies: [] }]);

  return (
    <section className="card">
      <h2 className="mb-3 text-base font-black text-slate-900">المشاريع</h2>
      {projects.length === 0 && (
        <p className="mb-3 text-xs sm:text-sm text-slate-400">
          لم يتم العثور على مشاريع، أضف مشاريعك يدوياً
        </p>
      )}
      <div className="space-y-3">
        {projects.map((project, index) => (
          <div key={index} className="rounded-xl border border-slate-200 p-3.5 sm:p-4">
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
                className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-danger"
                aria-label="حذف المشروع"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <textarea
              className="input-field mb-2"
              rows={2}
              placeholder="وصف المشروع"
              value={project.description}
              onChange={(e) =>
                updateProject(index, { description: e.target.value })
              }
            />
            <input
              type="text"
              className="input-field"
              placeholder="التقنيات المستخدمة (مفصولة بفاصلة)"
              value={
                project._rawTech !== undefined
                  ? project._rawTech
                  : (project.technologies || []).join(", ")
              }
              onChange={(e) =>
                updateProject(index, {
                  _rawTech: e.target.value,
                  technologies: e.target.value
                    .split(/[,،]/)
                    .map((t) => t.trim())
                    .filter(Boolean),
                })
              }
              onBlur={() =>
                updateProject(index, {
                  _rawTech: undefined,
                })
              }
            />
          </div>
        ))}
      </div>
      <button type="button" className="btn-outline mt-3" onClick={addProject}>
        <Plus size={15} />
        <span>إضافة مشروع</span>
      </button>
    </section>
  );
}

function EducationSection({ education, setEducation }) {
  const update = (index, patch) =>
    setEducation(education.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  const remove = (index) =>
    setEducation(education.filter((_, i) => i !== index));
  const add = () =>
    setEducation([...education, { degree: "", institution: "", year: "" }]);

  return (
    <section className="card">
      <h2 className="mb-3 text-base font-black text-slate-900">التعليم</h2>
      {education.length === 0 && (
        <p className="mb-3 text-xs sm:text-sm text-slate-400">
          لم يتم العثور على بيانات تعليمية
        </p>
      )}
      <div className="space-y-3">
        {education.map((edu, index) => (
          <div
            key={index}
            className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl border border-slate-200 p-3.5 sm:p-4"
          >
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
            <div className="flex items-center gap-2">
              <input
                type="number"
                className="input-field sm:w-28"
                placeholder="السنة"
                value={edu.year || ""}
                onChange={(e) =>
                  update(index, {
                    year: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
              <button
                type="button"
                onClick={() => remove(index)}
                className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-danger"
                aria-label="حذف"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="btn-outline mt-3" onClick={add}>
        <Plus size={15} />
        <span>إضافة</span>
      </button>
    </section>
  );
}

function ExperienceSection({ experience, setExperience }) {
  const update = (index, patch) =>
    setExperience(
      experience.map((e, i) => (i === index ? { ...e, ...patch } : e))
    );
  const remove = (index) =>
    setExperience(experience.filter((_, i) => i !== index));
  const add = () =>
    setExperience([
      ...experience,
      { title: "", company: "", duration_months: 0, description: "" },
    ]);

  return (
    <section className="card">
      <h2 className="mb-3 text-base font-black text-slate-900">الخبرة</h2>
      {experience.length === 0 && (
        <p className="mb-3 text-xs sm:text-sm text-slate-400">
          لم يتم العثور على خبرات عملية
        </p>
      )}
      <div className="space-y-3">
        {experience.map((exp, index) => (
          <div key={index} className="rounded-xl border border-slate-200 p-3.5 sm:p-4">
            <div className="mb-2 flex flex-col sm:flex-row sm:items-center gap-2">
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
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  className="input-field sm:w-32"
                  placeholder="المدة (أشهر)"
                  value={exp.duration_months || 0}
                  onChange={(e) =>
                    update(index, { duration_months: Number(e.target.value) })
                  }
                />
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-danger"
                  aria-label="حذف"
                >
                  <Trash2 size={16} />
                </button>
              </div>
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
        <Plus size={15} />
        <span>إضافة</span>
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
  const [showAtsBuilder, setShowAtsBuilder] = useState(false);

  if (!extractionId || !extractedData) {
    return <Navigate to="/analysis/upload" replace />;
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
          .map((e) => ({
            degree: e.degree,
            institution: e.institution || "",
            year: e.year || null,
          })),
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
    <div className="mx-auto max-w-3xl space-y-5 animate-fade-in">
      <Stepper currentStep="review" />

      <div>
        <h1 className="text-lg sm:text-xl font-black text-slate-900">
          مراجعة البيانات المستخرجة
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          راجع البيانات التي استخرجناها من سيرتك الذاتية وعدّلها إن لزم — دقة هذه الخطوة تؤثر مباشرة على دقة النتيجة
        </p>
      </div>

      {errorMessage && (
        <div className="alert-banner-error" role="alert">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {extractedData?.is_linkedin && (
        <div className="flex items-center gap-2.5 p-3.5 bg-primary-50 border border-primary-200 text-primary-800 rounded-xl text-xs font-bold">
          <Briefcase size={16} className="shrink-0 text-primary-600" />
          <span>
            تم التعرّف على الملف كملف شخصي مُصدَّر من <b>LinkedIn</b>، وجرى استخراج المهارات والخبرات بنجاح.
          </span>
        </div>
      )}

      <AtsScoreSection
        extractionId={extractionId}
        onOpenAtsBuilder={() => setShowAtsBuilder(true)}
      />
      <SkillsSection skills={skills} setSkills={setSkills} />
      <ProjectsSection projects={projects} setProjects={setProjects} />
      <EducationSection education={education} setEducation={setEducation} />
      <ExperienceSection
        experience={experience}
        setExperience={setExperience}
      />

      {showAtsBuilder && (
        <AtsCvBuilderModal
          extractionId={extractionId}
          initialSkills={skills}
          initialProjects={projects}
          initialEducation={education}
          initialExperience={experience}
          onClose={() => setShowAtsBuilder(false)}
        />
      )}

      {skills.length === 0 && (
        <p className="text-xs sm:text-sm font-bold text-accent-600">
          يجب وجود مهارة واحدة على الأقل للمتابعة
        </p>
      )}

      <div className="flex justify-between gap-3 pt-2">
        <button
          type="button"
          className="btn-outline"
          onClick={() => navigate("/analysis/upload")}
        >
          <ArrowRight size={15} />
          <span>السابق</span>
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={!canContinue}
          onClick={handleConfirm}
        >
          <span>{isSaving ? "جاري الحفظ..." : "تأكيد ومتابعة"}</span>
          <ArrowLeft size={15} />
        </button>
      </div>
    </div>
  );
}
