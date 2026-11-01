import {
  FileText,
  SlidersHorizontal,
  ClipboardCheck,
  Sparkles,
  Check,
} from "lucide-react";

const STEPS = [
  { key: "upload", label: "رفع السيرة", fullLabel: "رفع السيرة الذاتية", Icon: FileText },
  { key: "review", label: "المراجعة", fullLabel: "مراجعة البيانات", Icon: SlidersHorizontal },
  { key: "assessment", label: "التقييم", fullLabel: "الأسئلة التقييمية", Icon: ClipboardCheck },
  { key: "results", label: "التقرير", fullLabel: "التقرير المهني", Icon: Sparkles },
];

export default function Stepper({ currentStep }) {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep);

  return (
    <div className="mb-6 rounded-2xl border border-slate-200/80 bg-white p-3 sm:p-4 shadow-card">
      <ol className="flex items-center justify-between gap-1.5 sm:gap-3" aria-label="مراحل التحليل">
        {STEPS.map((step, index) => {
          const isDone = index < currentIndex;
          const isActive = index === currentIndex;
          const IconComponent = step.Icon;
          return (
            <li key={step.key} className="flex flex-1 items-center gap-1.5 sm:gap-2.5 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition-colors duration-200 ${
                    isDone
                      ? "bg-secondary-600 text-white"
                      : isActive
                      ? "bg-primary-600 text-white ring-4 ring-primary-50"
                      : "bg-slate-100 text-slate-400 border border-slate-200/70"
                  }`}
                >
                  {isDone ? <Check size={16} strokeWidth={2.5} /> : <IconComponent size={16} />}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="hidden sm:block text-[10px] font-bold text-slate-400">
                    الخطوة {index + 1}
                  </span>
                  <span
                    className={`truncate text-[11px] sm:text-xs font-extrabold ${
                      isActive
                        ? "text-slate-900"
                        : isDone
                        ? "text-secondary-700"
                        : "text-slate-400"
                    }`}
                  >
                    <span className="sm:hidden">{step.label}</span>
                    <span className="hidden sm:inline">{step.fullLabel}</span>
                  </span>
                </div>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`h-0.5 flex-1 rounded-full transition-colors duration-300 ${
                    isDone ? "bg-secondary-500" : "bg-slate-200"
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
