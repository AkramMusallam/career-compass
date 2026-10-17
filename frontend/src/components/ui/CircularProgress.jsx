import { useId } from "react";

function getScorePalette(score) {
  if (score < 40) {
    return {
      from: "#EF4444",
      to: "#F97316",
      badgeText: "يحتاج تطوير",
      badgeClass: "bg-red-500/15 text-red-500 border-red-500/25",
    };
  }
  if (score < 70) {
    return {
      from: "#F59E0B",
      to: "#EAB308",
      badgeText: "مستوى جيد",
      badgeClass: "bg-amber-500/15 text-amber-500 border-amber-500/25",
    };
  }
  return {
    from: "#10B981",
    to: "#6366F1",
    badgeText: "جاهزية عالية",
    badgeClass: "bg-emerald-500/15 text-emerald-500 border-emerald-500/25",
  };
}

export default function CircularProgress({
  value,
  size = 160,
  strokeWidth = 14,
  label,
  dark = false,
}) {
  const gradientId = useId();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, Number(value) || 0));
  const offset = circumference - (clamped / 100) * circumference;
  const palette = getScorePalette(clamped);

  return (
    <div className="flex flex-col items-center gap-2.5">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90 drop-shadow-sm">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={palette.from} />
              <stop offset="100%" stopColor={palette.to} />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={dark ? "rgba(255,255,255,0.12)" : "#E2E8F0"}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.16, 1, 0.3, 1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`text-4xl font-black tracking-tight ${
              dark ? "text-white" : "text-slate-900"
            }`}
          >
            {Math.round(clamped)}
          </span>
          <span
            className={`text-[11px] font-bold ${
              dark ? "text-slate-400" : "text-slate-400"
            }`}
          >
            من 100
          </span>
        </div>
      </div>
      {label && (
        <p className={`text-center text-sm font-bold ${dark ? "text-slate-300" : "text-slate-600"}`}>
          {label}
        </p>
      )}
    </div>
  );
}
