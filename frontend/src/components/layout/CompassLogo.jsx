export default function CompassLogo({
  size = 42,
  spinning = false,
  showText = true,
  lightText = false,
  className = "",
}) {
  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      <div
        className="relative flex items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-emerald-500 p-0.5 shadow-lg shadow-indigo-500/25"
        style={{ width: size, height: size }}
      >
        <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700">
          <svg
            width={Math.round(size * 0.68)}
            height={Math.round(size * 0.68)}
            viewBox="0 0 64 64"
            className={
              spinning
                ? "animate-compass-spin"
                : "transition-transform duration-500 group-hover:rotate-45"
            }
            aria-hidden="true"
          >
            <circle
              cx="32"
              cy="32"
              r="26"
              fill="none"
              stroke="rgba(255,255,255,0.65)"
              strokeWidth="3"
              strokeDasharray="6 4"
            />
            <circle
              cx="32"
              cy="32"
              r="20"
              fill="none"
              stroke="rgba(255,255,255,0.25)"
              strokeWidth="1.5"
            />
            <polygon points="32,10 38,32 32,28 26,32" fill="#34D399" />
            <polygon
              points="32,54 38,32 32,36 26,32"
              fill="#FFFFFF"
              fillOpacity="0.9"
            />
            <circle cx="32" cy="32" r="3.5" fill="#FFFFFF" />
          </svg>
        </div>
      </div>
      {showText && (
        <div className="flex flex-col text-right leading-none">
          <span
            className={`text-xl font-black tracking-tight ${
              lightText ? "text-white" : "text-slate-900"
            }`}
          >
            Career<span className="text-gradient">Compass</span>
          </span>
          <span
            className={`mt-0.5 text-[10px] font-bold uppercase tracking-widest ${
              lightText ? "text-indigo-200" : "text-slate-400"
            }`}
          >
            AI Career Intelligence
          </span>
        </div>
      )}
    </div>
  );
}
