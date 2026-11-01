import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FilePlus2,
  History,
  Building2,
  Crown,
  User,
  Settings,
  LogOut,
  Menu,
  X,
  Sparkles,
  ChevronLeft,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import CompassLogo from "./CompassLogo";

const NAV_ITEMS = [
  { to: "/dashboard", label: "لوحة التحكم", shortLabel: "الرئيسية", Icon: LayoutDashboard },
  { to: "/analysis/upload", label: "تحليل سيرة جديد", shortLabel: "تحليل", Icon: FilePlus2 },
  { to: "/history", label: "سجل التحليلات", shortLabel: "السجل", Icon: History },
  { to: "/recruiter", label: "بوابة التوظيف للشركات", shortLabel: "التوظيف", Icon: Building2 },
  { to: "/pricing", label: "الباقات والاشتراكات", shortLabel: "الباقات", Icon: Crown },
  { to: "/profile", label: "الملف الشخصي", shortLabel: "ملفي", Icon: User },
  { to: "/settings", label: "الإعدادات والأمان", shortLabel: "الإعدادات", Icon: Settings },
];

const MOBILE_BOTTOM_ITEMS = [
  NAV_ITEMS[0], // الرئيسية
  NAV_ITEMS[1], // تحليل
  NAV_ITEMS[2], // السجل
  NAV_ITEMS[3], // التوظيف
  NAV_ITEMS[5], // ملفي
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const isActive = (path) => {
    if (path === "/analysis/upload") {
      return location.pathname.startsWith("/analysis");
    }
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  const displayName = user?.full_name || user?.email?.split("@")[0] || "المستخدم";
  const initial = (user?.full_name || user?.email || "U").trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F7F8FA] text-slate-800">
      {/* Desktop Executive Sidebar (RTL Right Side) */}
      {user && (
        <aside className="hidden lg:flex lg:w-64 xl:w-72 lg:flex-col lg:fixed lg:inset-y-0 lg:right-0 z-30 border-l border-slate-200/80 bg-white">
          {/* Brand Header */}
          <div className="flex h-16 items-center justify-between px-6 border-b border-slate-100">
            <Link to="/dashboard" className="group flex items-center">
              <CompassLogo size={36} showText={true} />
            </Link>
          </div>

          {/* Primary Action Button */}
          <div className="px-4 pt-5 pb-2">
            <Link
              to="/analysis/upload"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-primary-700"
            >
              <Sparkles size={16} className="text-secondary-400" />
              <span>فحص سيرة ذاتية جديد</span>
            </Link>
          </div>

          {/* Navigation List */}
          <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto" aria-label="القائمة الرئيسية">
            <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              القائمة الرئيسية
            </p>
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.to);
              const IconComponent = item.Icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`group flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-bold transition-colors duration-150 ${
                    active
                      ? "bg-primary-50/90 text-primary-700 border border-primary-100"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <IconComponent
                      size={18}
                      strokeWidth={active ? 2.25 : 1.9}
                      className={active ? "text-primary-600" : "text-slate-400 group-hover:text-slate-600"}
                    />
                    <span>{item.label}</span>
                  </div>
                  {active && <ChevronLeft size={15} className="text-primary-500" />}
                </Link>
              );
            })}
          </nav>

          {/* Sidebar Footer User Card */}
          <div className="border-t border-slate-100 p-4">
            <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-2.5 border border-slate-200/60">
              <Link to="/profile" className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-90">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xs font-black text-white">
                  {initial}
                </div>
                <div className="min-w-0 flex-1 text-right">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-xs font-extrabold text-slate-900">{displayName}</p>
                    {user?.subscription_tier === "pro" && (
                      <span className="shrink-0 rounded bg-primary-100 px-1.5 py-0.5 text-[10px] font-extrabold text-primary-800">
                        Pro
                      </span>
                    )}
                    {(user?.subscription_tier === "enterprise" || user?.role === "recruiter") && (
                      <span className="shrink-0 rounded bg-accent-100 px-1.5 py-0.5 text-[10px] font-extrabold text-accent-700">
                        B2B
                      </span>
                    )}
                  </div>
                  <p className="truncate text-[11px] font-medium text-slate-500">{user.email}</p>
                </div>
              </Link>
              <button
                type="button"
                onClick={logout}
                title="تسجيل الخروج"
                className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-danger transition-colors"
                aria-label="تسجيل الخروج"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Main Content Wrapper */}
      <div className={`flex-1 flex flex-col min-w-0 ${user ? "lg:pr-64 xl:pr-72" : ""}`}>
        {/* Mobile & Tablet Sticky Header */}
        <header className="sticky top-0 z-30 flex h-14 sm:h-16 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 sm:px-6 backdrop-blur-md lg:hidden">
          <Link to="/dashboard" className="flex items-center">
            <CompassLogo size={32} showText={true} />
          </Link>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                <Link
                  to="/analysis/upload"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white"
                >
                  <Sparkles size={14} className="text-secondary-400" />
                  <span>فحص CV</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(true)}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50"
                  aria-label="فتح القائمة"
                >
                  <Menu size={20} />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="text-xs font-bold text-slate-700 px-3 py-1.5">
                  دخول
                </Link>
                <Link to="/register" className="btn-primary !py-1.5 !px-3.5 !text-xs">
                  حساب جديد
                </Link>
              </div>
            )}
          </div>
        </header>

        {/* Mobile Slide-Over Drawer */}
        {user && mobileDrawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
              onClick={() => setMobileDrawerOpen(false)}
            />
            <div className="relative mr-auto flex w-72 max-w-[82vw] flex-col bg-white shadow-elevated h-full z-10">
              <div className="flex h-14 items-center justify-between px-4 border-b border-slate-100">
                <CompassLogo size={30} showText={true} />
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="إغلاق القائمة"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 border-b border-slate-100 bg-slate-50/70">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-black text-white">
                    {initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold text-slate-900">{displayName}</p>
                    <p className="truncate text-xs text-slate-500">{user.email}</p>
                  </div>
                </div>
              </div>

              <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
                {NAV_ITEMS.map((item) => {
                  const active = isActive(item.to);
                  const IconComponent = item.Icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileDrawerOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold transition-colors ${
                        active
                          ? "bg-primary-50 text-primary-700 border border-primary-100"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <IconComponent
                        size={18}
                        className={active ? "text-primary-600" : "text-slate-400"}
                      />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="border-t border-slate-100 p-3">
                <button
                  type="button"
                  onClick={() => {
                    setMobileDrawerOpen(false);
                    logout();
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold text-danger hover:bg-red-50 transition-colors"
                >
                  <LogOut size={18} />
                  <span>تسجيل الخروج</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 w-full max-w-6xl mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 pb-24 lg:pb-10">
          <Outlet />
        </main>

        {/* Desktop Footer */}
        <footer className="hidden lg:block mt-auto border-t border-slate-200/70 bg-white">
          <div className="max-w-6xl mx-auto px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <CompassLogo size={24} showText={false} />
              <p className="text-xs font-medium text-slate-500">
                © {new Date().getFullYear()} <span className="text-slate-800 font-bold">CareerCompass AI</span> — منصة الذكاء المهني وتحليل السير الذاتية
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-secondary-700 bg-secondary-50 border border-secondary-200/80 px-3 py-1 rounded-full">
              <span className="h-2 w-2 rounded-full bg-secondary-500" />
              <span>محرك الذكاء الاصطناعي متصل</span>
            </div>
          </div>
        </footer>

        {/* Mobile Bottom Navigation Bar */}
        {user && (
          <nav
            aria-label="التنقل السريع للموبايل"
            className="fixed bottom-0 inset-x-0 z-30 border-t border-slate-200/90 bg-white/95 backdrop-blur-md lg:hidden"
          >
            <div className="grid grid-cols-5 h-16 max-w-md mx-auto px-1">
              {MOBILE_BOTTOM_ITEMS.map((item) => {
                const active = isActive(item.to);
                const IconComponent = item.Icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex flex-col items-center justify-center gap-1 rounded-lg transition-colors ${
                      active ? "text-primary-600" : "text-slate-400 hover:text-slate-700"
                    }`}
                  >
                    <IconComponent size={20} strokeWidth={active ? 2.4 : 1.9} />
                    <span className={`text-[10px] ${active ? "font-extrabold" : "font-semibold"}`}>
                      {item.shortLabel}
                    </span>
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
