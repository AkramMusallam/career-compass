import { Compass } from "lucide-react";

export default function CompassLogo({
  size = 40,
  spinning = false,
  showText = true,
  lightText = false,
  className = "",
}) {
  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <div
        className="relative flex shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm border border-slate-800"
        style={{ width: size, height: size }}
      >
        <Compass
          size={Math.round(size * 0.56)}
          strokeWidth={2}
          className={`text-secondary-400 ${
            spinning ? "animate-compass-spin" : "transition-transform duration-300 group-hover:rotate-12"
          }`}
          aria-hidden="true"
        />
      </div>
      {showText && (
        <div className="flex flex-col text-right leading-none">
          <span
            className={`text-lg sm:text-xl font-black tracking-tight ${
              lightText ? "text-white" : "text-slate-900"
            }`}
          >
            Career<span className="text-primary-600">Compass</span>
          </span>
          <span
            className={`mt-0.5 text-[10px] font-bold uppercase tracking-wider ${
              lightText ? "text-slate-400" : "text-slate-500"
            }`}
          >
            Career Intelligence
          </span>
        </div>
      )}
    </div>
  );
}
