import { useEffect, useState } from "react";
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
  Clock,
} from "lucide-react";
import { getHealthStatus } from "../../api/endpoints";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import CompassLogo from "./CompassLogo";

const NAV_ITEMS = [
  { to: "/dashboard", label: "لوحة التحكم", shortLabel: "الرئيسية", Icon: LayoutDashboard },
  { to: "/analysis/upload", label: "تحليل سيرة جديد", shortLabel: "تحليل", Icon: FilePlus2 },
  { to: "/history", label: "سجل التحليلات", shortLabel: "السجل", Icon: History },
  { to: "/recruiter", label: "بوابة التوظيف للشركات", shortLabel: "التوظيف", Icon: Building2 },
  { to: "/companies", label: "طلبات الشركات", shortLabel: "الشركات", Icon: Building2 },
  { to: "/support-access", label: "صلاحيات الدعم", shortLabel: "الدعم", Icon: User },
  {
    to: "/pricing",
    label: "الباقات والاشتراكات",
    shortLabel: "الباقات",
    Icon: Crown,
    badge: "قيد التطوير",
    comingSoon: true,
  },
  { to: "/profile", label: "الملف الشخصي", shortLabel: "ملفي", Icon: User },
  { to: "/settings", label: "الإعدادات والأمان", shortLabel: "الإعدادات", Icon: Settings },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [aiStatus, setAiStatus] = useState("checking");

  useEffect(() => {
    let mounted = true;
    getHealthStatus()
      .then((res) => {
        if (!mounted) return;
        setAiStatus(res.data?.status === "healthy" ? "healthy" : "degraded");
      })
      .catch((err) => {
        if (!mounted) return;
        setAiStatus(
          err?.response?.data?.status === "degraded" ? "degraded" : "offline"
        );
      });
    return () => {
      mounted = false;
    };
  }, []);

  const isActive = (path) => {
    if (path === "/analysis/upload") {
      return location.pathname.startsWith("/analysis");
    }
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  const handleComingSoonClick = (e) => {
    e.preventDefault();
    showToast(
      "قسم الباقات والاشتراكات قيد التطوير حالياً — جميع ميزات المنصة مفتوحة مجاناً بالكامل!",
      "info"
    );
  };

  const displayName = user?.full_name || user?.email?.split("@")[0] || "المستخدم";
  const initial = (user?.full_name || user?.email || "U").trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FA] text-slate-800">
      {/* Unified Top Header with Corner Menu Button */}
      <header className="sticky top-0 z-30 flex h-[60px] sm:h-16 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 sm:px-6 lg:px-8 backdrop-blur-md">
        <div className="flex items-center gap-3">
          {user && (
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 shadow-sm transition-colors hover:bg-slate-100 hover:text-slate-900"
              aria-label="فتح قائمة الأقسام"
              title="فتح قائمة الأقسام"
            >
              <Menu size={19} />
              <span className="hidden sm:inline">القائمة</span>
            </button>
          )}

          <Link to="/dashboard" className="flex items-center">
            <CompassLogo size={32} showText={true} />
          </Link>
        </div>

        <div className="flex items-center gap-2.5">
          {user ? (
            <>
              <Link
                to="/analysis/upload"
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-primary-700"
              >
                <Sparkles size={14} className="text-secondary-400" />
                <span>فحص سيرة جديد</span>
              </Link>

              <Link
                to="/profile"
                className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50 px-2.5 py-1.5 hover:bg-slate-100 transition-colors"
                title="الملف الشخصي"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-[11px] font-black text-white">
                  {initial}
                </div>
                <span className="max-w-[130px] truncate text-xs font-extrabold text-slate-800">
                  {displayName}
                </span>
              </Link>
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

      {/* Slide-Over Navigation Drawer (Opens on Corner Button Click for Desktop & Mobile) */}
      {user && drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-start">
          <div
            className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm transition-opacity"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="relative flex w-80 max-w-[85vw] flex-col bg-white shadow-2xl h-full z-10 border-l border-slate-200 animate-fade-in">
            {/* Drawer Header */}
            <div className="flex h-16 items-center justify-between px-5 border-b border-slate-100">
              <CompassLogo size={32} showText={true} />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                aria-label="إغلاق القائمة"
              >
                <X size={20} />
              </button>
            </div>

            {/* User Summary inside Drawer */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-black text-white">
                  {initial}
                </div>
                <div className="min-w-0 flex-1 text-right">
                  <p className="truncate text-sm font-extrabold text-slate-900">{displayName}</p>
                  <p className="truncate text-xs text-slate-500">{user.email}</p>
                </div>
              </div>
            </div>

            {/* Primary Action Button */}
            <div className="px-4 pt-4 pb-1">
              <Link
                to="/analysis/upload"
                onClick={() => setDrawerOpen(false)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-primary-700"
              >
                <Sparkles size={15} className="text-secondary-400" />
                <span>فحص سيرة ذاتية جديد</span>
              </Link>
            </div>

            {/* Navigation Items */}
            <nav className="flex-1 space-y-1 p-3 overflow-y-auto" aria-label="القائمة الرئيسية">
              <p className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                أقسام المنصة
              </p>
              {NAV_ITEMS.map((item) => {
                const active = !item.comingSoon && isActive(item.to);
                const IconComponent = item.Icon;

                if (item.comingSoon) {
                  return (
                    <button
                      key={item.to}
                      type="button"
                      onClick={handleComingSoonClick}
                      className="w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-400 hover:bg-amber-50/60 hover:text-slate-600 transition-colors cursor-pointer text-right"
                    >
                      <div className="flex items-center gap-3">
                        <IconComponent size={18} className="text-amber-500" />
                        <span>{item.label}</span>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 text-[10px] font-extrabold text-amber-800">
                        <Clock size={10} />
                        <span>{item.badge}</span>
                      </span>
                    </button>
                  );
                }

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setDrawerOpen(false)}
                    className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-bold transition-colors ${
                      active
                        ? "bg-primary-50 text-primary-700 border border-primary-100"
                        : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <IconComponent
                        size={18}
                        className={active ? "text-primary-600" : "text-slate-400"}
                      />
                      <span>{item.label}</span>
                    </div>
                    {active && <ChevronLeft size={15} className="text-primary-500" />}
                  </Link>
                );
              })}
            </nav>

            {/* Drawer Footer Logout */}
            <div className="border-t border-slate-100 p-3">
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  logout();
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold text-danger hover:bg-red-50 transition-colors"
              >
                <LogOut size={18} />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Wrapper */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 pb-12">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200/70 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <CompassLogo size={24} showText={false} />
            <p className="text-xs font-medium text-slate-500">
              © {new Date().getFullYear()}{" "}
              <span className="text-slate-800 font-bold">CareerCompass AI</span> — منصة الذكاء المهني وتحليل السير الذاتية
            </p>
          </div>
          <div
            className={`flex items-center gap-2 text-xs font-bold border px-3 py-1 rounded-full ${
              aiStatus === "healthy"
                ? "text-secondary-700 bg-secondary-50 border-secondary-200/80"
                : aiStatus === "degraded"
                  ? "text-amber-700 bg-amber-50 border-amber-200/80"
                  : aiStatus === "offline"
                    ? "text-red-700 bg-red-50 border-red-200/80"
                    : "text-slate-600 bg-slate-100 border-slate-200"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                aiStatus === "healthy"
                  ? "bg-secondary-500"
                  : aiStatus === "degraded"
                    ? "bg-amber-500"
                    : aiStatus === "offline"
                      ? "bg-red-500"
                      : "bg-slate-400 animate-pulse"
              }`}
            />
            <span>
              {aiStatus === "healthy"
                ? "محرك الذكاء الاصطناعي متصل"
                : aiStatus === "degraded"
                  ? "حالة المحرك محدودة"
                  : aiStatus === "offline"
                    ? "تعذر الاتصال بمحرك الذكاء الاصطناعي"
                    : "جاري فحص حالة النظام..."}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
