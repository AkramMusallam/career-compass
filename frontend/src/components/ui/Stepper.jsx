const STEPS = [
  { key: "upload", label: "رفع السيرة الذاتية", icon: "📄" },
  { key: "review", label: "مراجعة البيانات", icon: "🔍" },
  { key: "assessment", label: "الأسئلة التقييمية", icon: "🧠" },
  { key: "results", label: "التقرير المهني", icon: "✨" },
];

export default function Stepper({ currentStep }) {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep);

  return (
    <div className="mb-8 rounded-2xl border border-slate-200/80 bg-white/85 p-4 shadow-sm backdrop-blur-md">
      <ol className="flex items-center gap-2 overflow-x-auto" aria-label="مراحل التحليل">
        {STEPS.map((step, index) => {
          const isDone = index < currentIndex;
          const isActive = index === currentIndex;
          return (
            <li key={step.key} className="flex flex-1 items-center gap-2.5">
              <div className="flex items-center gap-2.5 whitespace-nowrap px-1">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black transition-all duration-300 ${
                    isDone
                      ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/25"
                      : isActive
                      ? "bg-gradient-to-br from-primary-600 to-indigo-700 text-white shadow-md shadow-primary-600/30 ring-4 ring-primary-100"
                      : "bg-slate-100 text-slate-400 border border-slate-200/80"
                  }`}
                >
                  {isDone ? "✓" : index + 1}
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400">
                    الخطوة {index + 1}
                  </span>
                  <span
                    className={`text-xs font-extrabold ${
                      isActive
                        ? "text-primary-700"
                        : isDone
                        ? "text-emerald-700"
                        : "text-slate-400"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`h-1 flex-1 rounded-full transition-colors duration-500 ${
                    isDone
                      ? "bg-gradient-to-l from-emerald-500 to-emerald-400"
                      : "bg-slate-100"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
