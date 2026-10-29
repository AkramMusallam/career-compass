import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import {
  getSubscriptionPlans,
  getCurrentSubscription,
  createCheckoutSession,
  cancelSubscription,
} from "../../api/endpoints";

export default function PricingPlans() {
  const { user, updateStoredUser } = useAuth();
  const { showToast } = useToast();

  const [plans, setPlans] = useState([]);
  const [currentSub, setCurrentSub] = useState(null);
  const [billingCycle, setBillingCycle] = useState("annual"); // "monthly" | "annual"
  const [isLoading, setIsLoading] = useState(true);
  const [upgradingPlanId, setUpgradingPlanId] = useState(null);

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

  const handleUpgrade = async (planId) => {
    if (planId === "free") return;

    try {
      setUpgradingPlanId(planId);
      // استخدام وضع الاختبار/المحاكاة للتفعيل الفوري والسلس
      const res = await createCheckoutSession({
        plan_id: planId,
        billing_cycle: billingCycle,
        test_token: "sandbox_upgrade",
      });

      // ترقية المستخدم في السياق المحلي والتخزين
      updateStoredUser({
        subscription_tier: planId,
        role: planId === "enterprise" ? "recruiter" : user?.role || "candidate",
      });

      showToast(`تمت الترقية إلى باقة ${planId === "enterprise" ? "الشركات (Enterprise)" : "المحترف (AI Pro)"} بنجاح! 💎`, "success");
      await loadPlansAndSub();
    } catch (err) {
      showToast("تعذر استكمال عملية الترقية", "error");
    } finally {
      setUpgradingPlanId(null);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm("هل أنت متأكد من رغبتك في إلغاء التجديد التلقائي؟")) return;
    try {
      await cancelSubscription();
      updateStoredUser({ subscription_tier: "free" });
      showToast("تم إلغاء الاشتراك والعودة للباقة المجانية", "info");
      await loadPlansAndSub();
    } catch (err) {
      showToast("تعذر إلغاء الاشتراك", "error");
    }
  };

  const activeTier = currentSub?.tier || user?.subscription_tier || "free";

  return (
    <div className="space-y-12 animate-fade-in pb-20">
      {/* Title & Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto pt-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50 border border-primary-200 text-primary-700 text-xs font-bold">
          <span>💎</span>
          <span>باقات الاشتراك والترقية المرنة</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight">
          استثمر في مستقبلك التقني بالذكاء الاصطناعي
        </h1>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          اختر الباقة المناسبة لاحتياجاتك؛ من فحص السيرة الذاتية المجاني وحتى المقابلات الصوتية غير المحدودة وبوابة اكتشاف الكفاءات للشركات.
        </p>

        {/* Billing Cycle Switcher */}
        <div className="flex items-center justify-center gap-4 pt-4">
          <span className={`text-xs font-bold ${billingCycle === "monthly" ? "text-slate-900" : "text-slate-400"}`}>
            فاتورة شهرية
          </span>
          <button
            type="button"
            onClick={() => setBillingCycle(billingCycle === "monthly" ? "annual" : "monthly")}
            className="w-14 h-8 bg-slate-900 rounded-full p-1 relative transition-colors"
          >
            <div
              className={`w-6 h-6 rounded-full bg-white transition-transform ${
                billingCycle === "annual" ? "transform -translate-x-6 bg-primary-500" : ""
              }`}
            />
          </button>
          <span className={`text-xs font-bold flex items-center gap-1.5 ${billingCycle === "annual" ? "text-slate-900" : "text-slate-400"}`}>
            <span>فاتورة سنوية</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
              وفر 20% 🎉
            </span>
          </span>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      {isLoading ? (
        <div className="py-24 text-center text-slate-500 font-bold">جاري تحميل الباقات والأسعار...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto items-stretch">
          {plans.map((plan) => {
            const isCurrent = activeTier === plan.id;
            const price = billingCycle === "annual" ? Math.round(plan.price_annual / 12) : plan.price_monthly;
            const isPro = plan.id === "pro";
            const isEnterprise = plan.id === "enterprise";

            return (
              <div
                key={plan.id}
                className={`relative rounded-3xl p-8 flex flex-col justify-between transition-all duration-300 ${
                  isPro
                    ? "bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 text-white shadow-2xl ring-2 ring-primary-500 scale-105 z-10"
                    : "bg-white text-slate-900 border border-slate-200/90 shadow-lg hover:shadow-xl"
                }`}
              >
                {/* Ribbon Tag */}
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 transform -translate-x-1/2">
                    <span
                      className={`px-4 py-1 rounded-full text-xs font-black shadow-md ${
                        isPro ? "bg-gradient-to-r from-primary-500 to-indigo-500 text-white" : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="space-y-6">
                  {/* Plan Name & Desc */}
                  <div>
                    <h3 className={`text-xl font-black ${isPro ? "text-white" : "text-slate-900"}`}>
                      {plan.name_ar}
                    </h3>
                    <p className={`text-xs mt-1.5 leading-relaxed ${isPro ? "text-slate-300" : "text-slate-500"}`}>
                      {plan.description_ar}
                    </p>
                  </div>

                  {/* Price Box */}
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black">${price}</span>
                    <span className={`text-xs font-semibold ${isPro ? "text-slate-400" : "text-slate-500"}`}>
                      / شهرياً {billingCycle === "annual" && plan.price_annual > 0 && `(يُدفع $${plan.price_annual} سنوياً)`}
                    </span>
                  </div>

                  {/* Features List */}
                  <div className="space-y-3 pt-4 border-t border-slate-100/10">
                    <p className={`text-xs font-bold ${isPro ? "text-slate-300" : "text-slate-700"}`}>
                      الميزات المتضمنة:
                    </p>
                    <ul className="space-y-2.5">
                      {(plan.features_ar || []).map((feat, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-xs">
                          <span className={isPro ? "text-emerald-400 font-bold" : "text-primary-600 font-bold"}>✓</span>
                          <span className={isPro ? "text-slate-200 leading-tight" : "text-slate-600 leading-tight"}>
                            {feat}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Call To Action Button */}
                <div className="pt-8 mt-8 border-t border-slate-100/10">
                  {isCurrent ? (
                    <div className="space-y-2 text-center">
                      <span className="w-full inline-block py-3 rounded-2xl bg-emerald-500/20 text-emerald-300 font-bold text-xs border border-emerald-500/30">
                        ✓ هذه باقتك الحالية
                      </span>
                      {plan.id !== "free" && (
                        <button
                          onClick={handleCancel}
                          className="text-[11px] text-slate-400 hover:text-red-400 transition underline"
                        >
                          إلغاء التجديد التلقائي
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={upgradingPlanId === plan.id}
                      className={`w-full py-3.5 rounded-2xl text-xs font-black transition-all shadow-lg transform hover:-translate-y-0.5 ${
                        isPro
                          ? "bg-gradient-to-r from-primary-500 to-indigo-600 text-white shadow-primary-500/30 hover:opacity-95"
                          : isEnterprise
                          ? "bg-slate-900 text-white hover:bg-slate-800"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {upgradingPlanId === plan.id
                        ? "جاري المعالجة..."
                        : plan.id === "free"
                        ? "الباقة الافتراضية"
                        : "ترقية الآن (تفعيل فوري) ⚡"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FAQ Section */}
      <div className="card max-w-4xl mx-auto p-8 bg-slate-50 border border-slate-200/80 rounded-3xl space-y-6">
        <h3 className="text-xl font-black text-slate-900 text-center">الأسئلة الشائعة حول الاشتراكات والفوترة 💡</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-600 leading-relaxed">
          <div className="space-y-1.5">
            <h4 className="font-bold text-slate-800 text-sm">كيف تتم معالجة عمليات الدفع؟</h4>
            <p>تتم معالجة الدفع عبر بوابات Stripe و PayPal العالمية المشفرة بأعلى معايير الأمان PCI-DSS، مع دعم كافة البطاقات البنكية.</p>
          </div>
          <div className="space-y-1.5">
            <h4 className="font-bold text-slate-800 text-sm">هل يمكنني إلغاء الاشتراك في أي وقت؟</h4>
            <p>نعم، بنقرة واحدة من لوحة التحكم يمكنك إلغاء التجديد التلقائي دون أي التزامات مع الاحتفاظ بمميزاتك حتى نهاية الدورة الحالية.</p>
          </div>
          <div className="space-y-1.5">
            <h4 className="font-bold text-slate-800 text-sm">ما هي بوابة الشركات B2B؟</h4>
            <p>باقة مخصصة لمسؤولي التوظيف تتيح نشر شواغر غير محدودة، ومطابقة وترتيب الكفاءات آلياً بحسب مهارات السير الذاتية وخبراتهم.</p>
          </div>
          <div className="space-y-1.5">
            <h4 className="font-bold text-slate-800 text-sm">هل هناك دعم للمؤسسات والجامعات؟</h4>
            <p>نوفر باقات تعليمية وتراخيص مجمعة لكليات تكنولوجيا المعلومات ومراكز التدريب المهني في المنطقة.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
