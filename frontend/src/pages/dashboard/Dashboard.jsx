import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Welcome Hero Section */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 to-primary-900 p-10 sm:p-14 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-primary-500 rounded-full mix-blend-screen filter blur-[80px] opacity-50"></div>
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-secondary-500 rounded-full mix-blend-screen filter blur-[80px] opacity-50"></div>
        
        <div className="relative z-10">
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-4 tracking-tight">
            مرحباً بك، {user?.email?.split("@")[0]} 👋
          </h1>
          <p className="text-lg sm:text-xl text-primary-100 max-w-2xl font-medium leading-relaxed">
            مستعد لاتخاذ خطوتك المهنية التالية؟ ارفع سيرتك الذاتية ودع الذكاء الاصطناعي يوجهك نحو أفضل المسارات الوظيفية المتاحة.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link to="/analysis/upload" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-8 py-4 font-black text-primary-700 shadow-xl transition-all hover:scale-105 hover:bg-primary-50 hover:shadow-primary-500/20 focus-visible:ring-4 focus-visible:ring-white/50">
              🚀 تحليل سيرة ذاتية جديدة
            </Link>
            <Link to="/history" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/10 backdrop-blur-md px-8 py-4 font-bold text-white border border-white/20 shadow-xl transition-all hover:bg-white/20 hover:scale-105 focus-visible:ring-4 focus-visible:ring-white/50">
              📂 تصفح تحليلاتك السابقة
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Stats / Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card group hover:border-primary-200">
          <div className="w-14 h-14 rounded-2xl bg-primary-100 text-primary-600 flex items-center justify-center text-2xl mb-5 group-hover:scale-110 transition-transform">
            🎯
          </div>
          <h3 className="text-xl font-black text-slate-800 mb-2">توجيه دقيق</h3>
          <p className="text-slate-600 font-medium">نحلل مهاراتك بعمق لنطابقها مع متطلبات سوق العمل الحقيقية باستخدام الذكاء الاصطناعي.</p>
        </div>
        
        <div className="card group hover:border-secondary-200">
          <div className="w-14 h-14 rounded-2xl bg-secondary-100 text-secondary-600 flex items-center justify-center text-2xl mb-5 group-hover:scale-110 transition-transform">
            📈
          </div>
          <h3 className="text-xl font-black text-slate-800 mb-2">خطة تطور</h3>
          <p className="text-slate-600 font-medium">نحدد الفجوات في مهاراتك ونرسم لك خارطة طريق واضحة لمدة 3 أشهر مع كورسات مقترحة.</p>
        </div>

        <div className="card group hover:border-accent-200">
          <div className="w-14 h-14 rounded-2xl bg-accent-100 text-accent-600 flex items-center justify-center text-2xl mb-5 group-hover:scale-110 transition-transform">
            🎤
          </div>
          <h3 className="text-xl font-black text-slate-800 mb-2">مقابلات ذكية</h3>
          <p className="text-slate-600 font-medium">تدرب على مقابلات العمل في أي وقت من خلال محاكي المقابلات الشخصية بالذكاء الاصطناعي.</p>
        </div>
      </div>
    </div>
  );
}