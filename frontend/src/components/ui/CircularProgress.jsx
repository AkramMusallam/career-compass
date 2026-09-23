function getColor(score) {
  if (score < 40) return "#DC2626"; // أحمر
  if (score < 70) return "#EA580C"; // برتقالي
  return "#059669"; // أخضر
}

export default function CircularProgress({ value, size = 160, strokeWidth = 14, label }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference - (clamped / 100) * circumference;
  const color = getColor(clamped);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} stroke="#E2E8F0" strokeWidth={strokeWidth} fill="none" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black text-slate-800">{Math.round(clamped)}</span>
          <span className="text-xs font-bold text-slate-400">من 100</span>
        </div>
      </div>
      {label && <p className="text-center text-sm font-bold text-slate-600">{label}</p>}
    </div>
  );
}
