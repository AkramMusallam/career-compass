const STEPS = [
  { key: "upload", label: "رفع السيرة الذاتية" },
  { key: "review", label: "مراجعة البيانات" },
  { key: "assessment", label: "الأسئلة التقييمية" },
  { key: "results", label: "النتائج" },
];

export default function Stepper({ currentStep }) {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep);

  return (
    <ol className="mb-8 flex items-center gap-2 overflow-x-auto pb-2" aria-label="مراحل التحليل">
      {STEPS.map((step, index) => {
        const isDone = index < currentIndex;
        const isActive = index === currentIndex;
        return (
          <li key={step.key} className="flex flex-1 items-center gap-2">
            <div className="flex flex-col items-center gap-1 whitespace-nowrap">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  isDone
                    ? "bg-secondary text-white"
                    : isActive
                    ? "bg-primary text-white"
                    : "bg-slate-200 text-slate-500"
                }`}
              >
                {isDone ? "✓" : index + 1}
              </div>
              <span
                className={`text-xs font-bold ${
                  isActive ? "text-primary" : isDone ? "text-secondary" : "text-slate-400"
                }`}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div className={`h-1 flex-1 rounded-full ${isDone ? "bg-secondary" : "bg-slate-200"}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
