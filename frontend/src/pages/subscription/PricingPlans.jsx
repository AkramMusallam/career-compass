import { useState, useEffect } from "react";
import { Crown, Check, Zap, HelpCircle } from "lucide-react";
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
  const [billingCycle, setBillingCycle] = useState("annual");
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
      await createCheckoutSession({
        plan_id: planId,
        billing_cycle: billingCycle,
        test_token: "sandbox_upgrade",
      });

      updateStoredUser({
        subscription_tier: planId,
        role: planId === "enterprise" ? "recruiter" : user?.role || "candidate",
      });

      showToast(
        `تمت الترقية إلى باقة ${
          planId === "enterprise" ? "الشركات (Enterprise)" : "المحترف (AI Pro)"
        } بنجاح`,
        "success"
      );
      await loadPlansAndSub();
    } catch {
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
    } catch {
      showToast("تعذر إلغاء الاشتراك", "error");
    }
  };

  const activeTier = currentSub?.tier || user?.subscription_tier || "free";

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      {/* Title & Header */}
      <div className="text-center space-y-3 max-w-2xl mx-auto pt-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-50 border border-accent-200 text-accent-700 text-xs font-bold">
          <Crown size={14} />
          <span>باقات الاشتراك والترقية المرنة</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
          استثمر في مستقبلك التقني بالذكاء الاصطناعي
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          اختر الباقة المناسبة لاحتياجاتك؛ من فحص السيرة الذاتية المجاني وحتى المقابلات الصوتية غير المحدودة وبوابة اكتشاف الكفاءات للشركات.
        </p>

        {/* Billing Cycle Switcher */}
        <div className="flex items-center justify-center gap-3 pt-3">
          <span
            className={`text-xs font-bold ${
              billingCycle === "monthly" ? "text-slate-900" : "text-slate-400"
            }`}
          >
            فاتورة شهرية
          </span>
          <button
            type="button"
            onClick={() =>
              setBillingCycle(billingCycle === "monthly" ? "annual" : "monthly")
            }
            className="w-12 h-7 bg-slate-900 rounded-full p-1 relative transition-colors"
            aria-label="تبديل دورة الفوترة"
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                billingCycle === "annual"
                  ? "transform -translate-x-5 bg-secondary-400"
                  : ""
              }`}
            />
          </button>
          <span
            className={`text-xs font-bold flex items-center gap-1.5 ${
              billingCycle === "annual" ? "text-slate-900" : "text-slate-400"
            }`}
          >
            <span>فاتورة سنوية</span>
            <span className="px-2 py-0.5 rounded-md bg-secondary-50 border border-secondary-200 text-secondary-700 text-[10px] font-black">
              وفر 20%
            </span>
          </span>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      {isLoading ? (
        <div className="py-20 text-center text-slate-500 font-bold text-sm">
          جاري تحميل الباقات والأسعار...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-6xl mx-auto items-stretch">
          {plans.map((plan) => {
            const isCurrent = activeTier === plan.id;
            const price =
              billingCycle === "annual"
                ? Math.round(plan.price_annual / 12)
                : plan.price_monthly;
            const isPro = plan.id === "pro";
            const isEnterprise = plan.id === "enterprise";

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-6 sm:p-7 flex flex-col justify-between transition-colors ${
                  isPro
                    ? "bg-slate-900 text-white shadow-elevated border-2 border-primary-500"
                    : "bg-white text-slate-900 border border-slate-200/90 shadow-card"
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span
                      className={`px-3 py-0.5 rounded-full text-[11px] font-bold shadow-xs ${
                        isPro
                          ? "bg-primary-600 text-white"
                          : "bg-slate-100 text-slate-700 border border-slate-200"
                      }`}
                    >
                      {plan.badge}
                    </span>
                  </div>
                )}

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

                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-black">${price}</span>
                    <span
                      className={`text-xs font-semibold ${
                        isPro ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      / شهرياً{" "}
                      {billingCycle === "annual" &&
                        plan.price_annual > 0 &&
                        `(يُدفع $${plan.price_annual} سنوياً)`}
                    </span>
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
                  {isCurrent ? (
                    <div className="space-y-2 text-center">
                      <span
                        className={`w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-xs border ${
                          isPro
                            ? "bg-secondary-500/20 text-secondary-300 border-secondary-500/30"
                            : "bg-secondary-50 text-secondary-700 border-secondary-200"
                        }`}
                      >
                        <Check size={14} />
                        <span>هذه باقتك الحالية</span>
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
                      className={`w-full inline-flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-bold transition-colors ${
                        isPro
                          ? "bg-primary-600 text-white hover:bg-primary-500"
                          : isEnterprise
                          ? "bg-slate-900 text-white hover:bg-slate-800"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {upgradingPlanId === plan.id ? (
                        "جاري المعالجة..."
                      ) : plan.id === "free" ? (
                        "الباقة الافتراضية"
                      ) : (
                        <>
                          <Zap size={14} />
                          <span>ترقية الآن (تفعيل فوري)</span>
                        </>
                      )}
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
            الأسئلة الشائعة حول الاشتراكات والفوترة
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs text-slate-600 leading-relaxed">
          <div className="space-y-1">
            <h4 className="font-bold text-slate-800 text-xs sm:text-sm">
              كيف تتم معالجة عمليات الدفع؟
            </h4>
            <p>
              تتم معالجة الدفع عبر بوابات Stripe و PayPal العالمية المشفرة بأعلى معايير الأمان PCI-DSS، مع دعم كافة البطاقات البنكية.
            </p>
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-slate-800 text-xs sm:text-sm">
              هل يمكنني إلغاء الاشتراك في أي وقت؟
            </h4>
            <p>
              نعم، بنقرة واحدة من لوحة التحكم يمكنك إلغاء التجديد التلقائي دون أي التزامات مع الاحتفاظ بمميزاتك حتى نهاية الدورة الحالية.
            </p>
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-slate-800 text-xs sm:text-sm">
              ما هي بوابة الشركات B2B؟
            </h4>
            <p>
              باقة مخصصة لمسؤولي التوظيف تتيح نشر شواغر غير محدودة، ومطابقة وترتيب الكفاءات آلياً بحسب مهارات السير الذاتية وخبراتهم.
            </p>
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-slate-800 text-xs sm:text-sm">
              هل هناك دعم للمؤسسات والجامعات؟
            </h4>
            <p>
              نوفر باقات تعليمية وتراخيص مجمعة لكليات تكنولوجيا المعلومات ومراكز التدريب المهني في المنطقة.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
