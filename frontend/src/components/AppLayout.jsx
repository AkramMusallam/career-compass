import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import CompassLogo from "./CompassLogo";

const NAV_ITEMS = [
  { to: "/dashboard", label: "لوحة التحكم", icon: "🧭" },
  { to: "/history", label: "سجل التحليلات", icon: "📜" },
  { to: "/profile", label: "الملف الشخصي", icon: "👤" },
  { to: "/settings", label: "الإعدادات", icon: "⚙️" },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const initial = user?.full_name?.trim()?.charAt(0)?.toUpperCase() || "?";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <button
            className="lg:hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            onClick={() => setMobileNavOpen((v) => !v)}
            aria-label="فتح القائمة"
          >
            ☰
          </button>
          <NavLink to="/dashboard">
            <CompassLogo size={32} />
          </NavLink>

          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-full border border-slate-200 py-1 pl-3 pr-1 hover:bg-slate-50"
            >
              <span className="hidden text-sm font-bold text-slate-700 sm:inline">{user?.full_name}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-bold text-white">
                {initial}
              </span>
            </button>
            {menuOpen && (
              <div
                className="absolute left-0 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
                onMouseLeave={() => setMenuOpen(false)}
              >
                <NavLink
                  to="/profile"
                  className="block px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() => setMenuOpen(false)}
                >
                  الملف الشخصي
                </NavLink>
                <NavLink
                  to="/settings"
                  className="block px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() => setMenuOpen(false)}
                >
                  الإعدادات
                </NavLink>
                <button
                  onClick={handleLogout}
                  className="block w-full px-4 py-2.5 text-right text-sm font-semibold text-danger hover:bg-danger-50"
                >
                  تسجيل الخروج
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        <aside
          className={`${
            mobileNavOpen ? "block" : "hidden"
          } lg:block w-full shrink-0 lg:w-56`}
        >
          <nav className="card sticky top-20 flex flex-row flex-wrap gap-1 p-2 lg:flex-col">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileNavOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold transition ${
                    isActive ? "bg-primary-50 text-primary" : "text-slate-600 hover:bg-slate-50"
                  }`
                }
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
