import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import CompassLogo from "./CompassLogo";

export default function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAuthPage = ["/login", "/register", "/forgot-password"].includes(location.pathname) || location.pathname.startsWith("/reset-password");

  if (isAuthPage) {
    return (
      <main className="min-h-screen relative overflow-hidden flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="absolute inset-0 bg-hero-pattern opacity-50"></div>
        {/* Decorative blobs */}
        <div className="absolute top-0 -left-4 w-72 h-72 bg-primary-300 rounded-full mix-blend-multiply filter blur-2xl opacity-30 animate-float"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-secondary-300 rounded-full mix-blend-multiply filter blur-2xl opacity-30 animate-float" style={{ animationDelay: '2s' }}></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-accent-300 rounded-full mix-blend-multiply filter blur-2xl opacity-30 animate-float" style={{ animationDelay: '4s' }}></div>
        
        <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center group">
            <div className="transform transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
              <CompassLogo className="w-16 h-16 text-primary-600" />
            </div>
          </div>
          <h2 className="mt-6 text-center text-4xl font-black text-slate-900 tracking-tight">Career<span className="text-gradient">Compass</span></h2>
        </div>
        <div className="relative z-10 mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <Outlet />
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <div className="fixed inset-0 bg-hero-pattern opacity-30 -z-10"></div>
      
      {/* Glassmorphic Navbar */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-white/70 border-b border-slate-200/50 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            
            {/* Logo */}
            <div className="flex items-center gap-3">
              <Link to="/" className="flex items-center gap-2 group">
                <div className="transform transition-transform duration-500 group-hover:rotate-45">
                  <CompassLogo className="w-10 h-10 text-primary-600" />
                </div>
                <span className="text-2xl font-black text-slate-800 tracking-tight">Career<span className="text-gradient">Compass</span></span>
              </Link>
            </div>

                        {/* Navigation & Profile */}
            <div className="flex items-center gap-6">
              {user ? (
                <>
                  <nav className="hidden md:flex items-center gap-1 bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200/50">
                    <Link to="/dashboard" className={px-4 py-2 rounded-xl text-sm font-bold transition-all }>لوحة التحكم</Link>
                    <Link to="/history" className={px-4 py-2 rounded-xl text-sm font-bold transition-all }>السجل</Link>
                    <Link to="/profile" className={px-4 py-2 rounded-xl text-sm font-bold transition-all }>الملف الشخصي</Link>
                  </nav>

                  <div className="relative group hidden md:block">
                    <button className="flex items-center gap-2 focus:outline-none">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary-500 to-secondary-500 p-[2px] shadow-md">
                        <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-primary-600 font-bold">
                          {user.email.charAt(0).toUpperCase()}
                        </div>
                      </div>
                    </button>
                    <div className="absolute left-0 mt-3 w-48 bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-slate-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top scale-95 group-hover:scale-100">
                      <div className="p-2 space-y-1">
                        <Link to="/settings" className="block px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-primary-600 rounded-xl transition-colors">⚙️ الإعدادات</Link>
                        <button onClick={logout} className="block w-full text-right px-4 py-2.5 text-sm font-semibold text-danger-600 hover:bg-danger-50 rounded-xl transition-colors">🚪 تسجيل الخروج</button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Mobile menu button */}
                  <div className="md:hidden flex items-center">
                    <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-slate-600 hover:text-slate-900 focus:outline-none p-2">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
                      </svg>
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <Link to="/login" className="text-sm font-bold text-slate-600 hover:text-primary-600 transition-colors">دخول</Link>
                  <Link to="/register" className="btn-primary py-2 px-5 text-sm rounded-xl">حساب جديد</Link>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Mobile Menu Dropdown */}
        {user && mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white/95 backdrop-blur-md shadow-lg absolute w-full left-0 z-50">
            <div className="px-4 pt-2 pb-4 space-y-1">
              <Link onClick={() => setMobileMenuOpen(false)} to="/dashboard" className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:text-primary-600 hover:bg-slate-50">لوحة التحكم</Link>
              <Link onClick={() => setMobileMenuOpen(false)} to="/history" className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:text-primary-600 hover:bg-slate-50">السجل</Link>
              <Link onClick={() => setMobileMenuOpen(false)} to="/profile" className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:text-primary-600 hover:bg-slate-50">الملف الشخصي</Link>
              <Link onClick={() => setMobileMenuOpen(false)} to="/settings" className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:text-primary-600 hover:bg-slate-50">⚙️ الإعدادات</Link>
              <button onClick={() => { setMobileMenuOpen(false); logout(); }} className="block w-full text-right px-3 py-2 rounded-md text-base font-medium text-danger-600 hover:bg-danger-50">🚪 تسجيل الخروج</button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
        <Outlet />
      </main>
      
      {/* Modern Footer */}
      <footer className="mt-auto border-t border-slate-200/50 bg-white/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p className="text-sm font-medium text-slate-500">
              © {new Date().getFullYear()} <span className="font-bold text-slate-700">CareerCompass</span>. صُنع بشغف.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}