import { useState, useEffect } from "react";
import {
  Crown,
  Check,
  HelpCircle,
  Clock,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import {
  getSubscriptionPlans,
  getCurrentSubscription,
} from "../../api/endpoints";

export default function PricingPlans() {
  const [plans, setPlans] = useState([]);
  const [currentSub, setCurrentSub] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPlansAndSub();
  }, []);

  const loadPlansAndSub = async () => {
    try {
      setIsLoading(true);
      const [plansRes, subRes] = await Promise.all([
        getSubscriptionPlans(),
        getCurrentSubscription().catch(() => ({ data: null })),
      ]);
      setPlans(plansRes.data || []);
      setCurrentSub(subRes.data);
    } catch (err) {
      console.error("Error loading plans:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const usage = currentSub?.usage || { analyses_used: 0, interviews_used: 0 };

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      {/* Title & Header */}
      <div className="text-center space-y-3 max-w-2xl mx-auto pt-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold">
          <Clock size={14} />
          <span>نظام الاشتراكات والدفع الإلكتروني — قريباً (قيد التطوير)</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
          باقات المنصة المستقبلية
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          جميع أدوات الذكاء الاصطناعي (تحليل السيرة الذاتية، المقابلات الصوتية التفاعلية، وبوابة التوظيف) متاحة ومفتوحة مجاناً بالكامل لجميع المستخدمين خلال المرحلة الحالية، لحين إطلاق بوابة الدفع الإلكتروني قريباً.
        </p>
      </div>

      {/* Coming Soon & Free Access Banner */}
      <div className="card max-w-6xl mx-auto !p-5 bg-slate-900 text-white border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary-500/20 border border-secondary-500/40 text-secondary-300 text-[11px] font-bold">
                <Sparkles size={12} />
                <span>المرحلة التجريبية المفتوحة</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-bold">
                <Clock size={12} />
                <span>الدفع الإلكتروني قيد التطوير — Coming Soon</span>
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-white">
              جميع الميزات الاحترافية مفتوحة لحسابك مجاناً حالياً بدون أي رسوم
            </h2>
            <p className="text-xs text-slate-400">
              تم إيقاف بوابة الدفع مؤقتاً لأنها قيد التطوير والربط المصرفي، ويمكنك استخدام كافة ميزات المنصة بلا حدود.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-6 bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 shrink-0">
            <div>
              <p className="text-[11px] text-slate-400 font-semibold">تحليلات السيرة الذاتية المنجزة</p>
              <p className="text-sm sm:text-base font-black text-white mt-0.5">
                {usage.analyses_used}{" "}
                <span className="text-xs font-normal text-secondary-400">
                  (متاح بلا حدود ∞)
                </span>
              </p>
            </div>
            <div className="border-r border-slate-700 pr-3 sm:pr-6">
              <p className="text-[11px] text-slate-400 font-semibold">جلسات المقابلات التقنية</p>
              <p className="text-sm sm:text-base font-black text-secondary-400 mt-0.5">
                {usage.interviews_used}{" "}
                <span className="text-xs font-normal text-secondary-400">
                  (متاح بلا حدود ∞)
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Cards Grid (Preview Only - Payment Disabled / Coming Soon) */}
      {isLoading ? (
        <div className="py-20 text-center text-slate-500 font-bold text-sm">
          جاري تحميل الباقات...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-6xl mx-auto items-stretch">
          {plans.map((plan) => {
            const isFree = plan.id === "free";
            const isPro = plan.id === "pro";

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-6 sm:p-7 flex flex-col justify-between transition-colors ${
                  isPro
                    ? "bg-slate-900 text-white shadow-elevated border-2 border-slate-700"
                    : "bg-white text-slate-900 border border-slate-200/90 shadow-card"
                }`}
              >
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  {isFree ? (
                    <span className="px-3 py-0.5 rounded-full text-[11px] font-bold shadow-xs bg-secondary-50 text-secondary-700 border border-secondary-200">
                      مفعّلة ومفتوحة حالياً
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[11px] font-bold shadow-xs bg-amber-500 text-slate-950">
                      <Clock size={11} />
                      <span>قريباً — Coming Soon</span>
                    </span>
                  )}
                </div>

                <div className="space-y-5">
                  <div>
                    <h3
                      className={`text-lg sm:text-xl font-black ${
                        isPro ? "text-white" : "text-slate-900"
                      }`}
                    >
                      {plan.name_ar}
                    </h3>
                    <p
                      className={`text-xs mt-1 leading-relaxed ${
                        isPro ? "text-slate-300" : "text-slate-500"
                      }`}
                    >
                      {plan.description_ar}
                    </p>
                  </div>

                  <div className="flex items-baseline gap-1.5">
                    {isFree ? (
                      <>
                        <span className="text-3xl sm:text-4xl font-black text-emerald-600">مجاناً</span>
                        <span className="text-xs font-semibold text-slate-500">
                          / متاح بالكامل حالياً
                        </span>
                      </>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
                        <Clock size={15} className={isPro ? "text-amber-400" : "text-amber-600"} />
                        <span className={`text-sm font-black ${isPro ? "text-amber-300" : "text-amber-700"}`}>
                          قريباً — قيد التطوير
                        </span>
                      </div>
                    )}
                  </div>

                  <div
                    className={`space-y-2.5 pt-4 border-t ${
                      isPro ? "border-slate-800" : "border-slate-100"
                    }`}
                  >
                    <p
                      className={`text-xs font-bold ${
                        isPro ? "text-slate-300" : "text-slate-700"
                      }`}
                    >
                      الميزات المتضمنة:
                    </p>
                    <ul className="space-y-2">
                      {(plan.features_ar || []).map((feat, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs">
                          <Check
                            size={15}
                            className={`shrink-0 mt-0.5 ${
                              isPro ? "text-secondary-400" : "text-primary-600"
                            }`}
                          />
                          <span
                            className={
                              isPro
                                ? "text-slate-200 leading-snug"
                                : "text-slate-600 leading-snug"
                            }
                          >
                            {feat}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div
                  className={`pt-6 mt-6 border-t ${
                    isPro ? "border-slate-800" : "border-slate-100"
                  }`}
                >
                  {isFree ? (
                    <span className="w-full inline-flex items-center justify-center gap-1.5 py-3 rounded-xl font-bold text-xs bg-secondary-50 text-secondary-700 border border-secondary-200">
                      <ShieldCheck size={15} />
                      <span>متاح ومفعّل مجاناً للجميع حالياً</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className={`w-full inline-flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-bold cursor-not-allowed opacity-80 ${
                        isPro
                          ? "bg-slate-800 text-amber-300 border border-slate-700"
                          : "bg-slate-100 text-slate-500 border border-slate-200"
                      }`}
                    >
                      <Clock size={14} />
                      <span>قريباً — قيد التطوير (Coming Soon)</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FAQ Section */}
      <div className="card max-w-4xl mx-auto space-y-5">
        <div className="flex items-center justify-center gap-2">
          <HelpCircle size={18} className="text-primary-600" />
          <h3 className="text-base sm:text-lg font-black text-slate-900 text-center">
            معلومات حول الباقات والمرحلة الحالية
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs text-slate-600 leading-relaxed">
          <div className="space-y-1">
            <h4 className="font-bold text-slate-800 text-xs sm:text-sm">
              لماذا يظهر الدفع الإلكتروني كـ «قريباً — قيد التطوير»؟
            </h4>
            <p>
              نعمل حالياً على استكمال الربط الرسمي مع بوابات الدفع المعتمدة محلياً ودولياً، ولذلك قمنا بفتح كافة ميزات المنصة مجاناً لجميع المستخدمين دون الحاجة لإدخال أي وسيلة دفع.
            </p>
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-slate-800 text-xs sm:text-sm">
              هل هناك أي حد أقصى لتحليل السيرة الذاتية أو المقابلات حالياً؟
            </h4>
            <p>
              لا، خلال هذه المرحلة يمكنك إجراء تحليلات السيرة الذاتية ومقابلات الذكاء الاصطناعي التفاعلية واستخدام بوابة التوظيف بدون أي قيود.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
