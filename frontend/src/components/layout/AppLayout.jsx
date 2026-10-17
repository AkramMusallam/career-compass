import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import CompassLogo from "./CompassLogo";

const NAV_ITEMS = [
  { to: "/dashboard", label: "لوحة التحكم", icon: "⚡" },
  { to: "/analysis/upload", label: "تحليل جديد", icon: "🚀" },
  { to: "/history", label: "سجل التحليلات", icon: "📊" },
  { to: "/profile", label: "الملف الشخصي", icon: "👤" },
  { to: "/settings", label: "الإعدادات", icon: "⚙️" },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path) => {
    if (path === "/analysis/upload") {
      return location.pathname.startsWith("/analysis");
    }
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  const displayName = user?.full_name || user?.email?.split("@")[0] || "المستخدم";
  const initial = (user?.full_name || user?.email || "U").trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden">
      {/* Ambient background glow orbs */}
      <div className="pointer-events-none fixed -top-32 -right-32 h-96 w-96 rounded-full bg-primary-500/10 blur-[110px] -z-10" />
      <div className="pointer-events-none fixed top-1/3 -left-32 h-96 w-96 rounded-full bg-secondary-500/10 blur-[110px] -z-10" />

      {/* Luxury Glassmorphic Navbar */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-2xl bg-white/80 border-b border-slate-200/70 shadow-[0_4px_30px_rgba(15,23,42,0.03)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center gap-4">
            {/* Brand Logo */}
            <Link to="/dashboard" className="group flex items-center">
              <CompassLogo size={42} showText={true} />
            </Link>

            {/* Desktop Navigation Pills */}
            {user && (
              <nav className="hidden lg:flex items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/70 shadow-inner">
                {NAV_ITEMS.map((item) => {
                  const active = isActive(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${
                        active
                          ? "bg-gradient-to-r from-primary-600 to-secondary-600 text-white shadow-md shadow-primary-600/25"
                          : "text-slate-600 hover:text-slate-900 hover:bg-white/70"
                      }`}
                    >
                      <span className="text-xs">{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            )}

            {/* Right User Actions */}
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <Link
                    to="/analysis/upload"
                    className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white shadow-md shadow-slate-900/15 transition hover:bg-primary-600 hover:shadow-primary-600/25"
                  >
                    <span>✨</span>
                    <span>فحص CV بالذكاء الاصطناعي</span>
                  </Link>

                  <div className="hidden md:flex items-center gap-2.5 pl-1 pr-3 py-1.5 rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm">
                    <Link to="/profile" className="flex items-center gap-2.5 hover:opacity-90 transition">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-600 to-secondary-600 flex items-center justify-center text-white font-black text-sm shadow-sm">
                        {initial}
                      </div>
                      <div className="text-right hidden xl:block">
                        <p className="text-xs font-black text-slate-800 leading-tight max-w-[120px] truncate">
                          {displayName}
                        </p>
                        <p className="text-[10px] font-semibold text-slate-400 leading-tight max-w-[120px] truncate">
                          {user.email}
                        </p>
                      </div>
                    </Link>
                    <span className="h-5 w-px bg-slate-200 mx-0.5" />
                    <button
                      type="button"
                      onClick={logout}
                      title="تسجيل الخروج"
                      className="rounded-lg p-1.5 text-xs font-bold text-slate-400 hover:bg-red-50 hover:text-danger transition"
                    >
                      🚪
                    </button>
                  </div>

                  {/* Mobile menu button */}
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="lg:hidden inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 hover:bg-slate-50"
                    aria-label="القائمة"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
                      />
                    </svg>
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <Link to="/login" className="text-sm font-bold text-slate-600 hover:text-primary-600 transition-colors">
                    دخول
                  </Link>
                  <Link to="/register" className="btn-primary py-2 px-5 text-sm rounded-xl">
                    حساب جديد
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {user && mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200/80 bg-white/95 backdrop-blur-xl shadow-2xl">
            <div className="px-4 py-4 space-y-1.5">
              <div className="flex items-center gap-3 px-3 py-2.5 mb-2 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-600 to-secondary-600 flex items-center justify-center text-white font-black">
                  {initial}
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-black text-slate-800 truncate">{displayName}</p>
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
                </div>
              </div>
              {NAV_ITEMS.map((item) => {
                const active = isActive(item.to);
                return (
                  <Link
                    key={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    to={item.to}
                    className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-bold transition ${
                      active
                        ? "bg-primary-600 text-white shadow-sm"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
                className="flex w-full items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-bold text-danger hover:bg-red-50 transition"
              >
                <span>🚪</span>
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 relative z-10">
        <Outlet />
      </main>

      {/* Executive Footer */}
      <footer className="mt-auto border-t border-slate-200/70 bg-white/70 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CompassLogo size={28} showText={false} />
            <p className="text-xs font-bold text-slate-500">
              © {new Date().getFullYear()} <span className="text-slate-800 font-black">CareerCompass AI</span> — منصة الذكاء المهني وتحليل السير الذاتية
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-3 py-1 rounded-full">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>محرك الذكاء الاصطناعي نشط</span>
          </div>
        </div>
      </footer>
    </div>
  );
}