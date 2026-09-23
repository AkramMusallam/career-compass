export default function CompassLogo({ size = 40, spinning = false, className = "" }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        className={spinning ? "animate-compass-spin" : ""}
        aria-hidden="true"
      >
        <circle cx="32" cy="32" r="30" fill="#1E40AF" />
        <circle cx="32" cy="32" r="24" fill="none" stroke="#059669" strokeWidth="2" />
        <path d="M32 14 L38 32 L32 50 L26 32 Z" fill="#FFFFFF" />
      </svg>
      <span className="text-xl font-black tracking-tight text-primary">Career Compass</span>
    </div>
  );
}
