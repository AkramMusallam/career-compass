function prepareReview(data, skills) {
  const integer = (value, label, fallback) => {
    if (value === "" || value == null) return fallback;
    if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value))) throw new Error(`أدخل ${label} صحيحًا.`);
    return Number(value);
  };
  const required = (value, label) => {
    if (!value || !value.trim()) throw new Error(`أدخل ${label}.`);
    return value.trim();
  };
  return {
    extraction_id: data.extraction_id,
    skills,
    projects: data.projects.map((item) => ({ ...item, title: required(item.title, "اسم المشروع"), technologies: Array.isArray(item.technologies) ? item.technologies : item.technologies.split(/[,،\n]/).map((v) => v.trim()).filter(Boolean) })),
    education: data.education.map((item) => ({ ...item, degree: required(item.degree, "الشهادة"), year: integer(item.year, "سنة التخرج", null) })),
    experience: data.experience.map((item) => ({ ...item, title: required(item.title, "المسمى الوظيفي"), duration_months: integer(item.duration_months, "عدد الأشهر", 0) })),
  };
}

module.exports = { prepareReview };
