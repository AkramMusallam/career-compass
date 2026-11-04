import { useState, useEffect } from "react";
import {
  Crown,
  Check,
  Zap,
  HelpCircle,
  CreditCard,
  ShieldCheck,
  Lock,
  Receipt,
  X,
  Building2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { getErrorMessage } from "../../api/client";
import {
  getSubscriptionPlans,
  getCurrentSubscription,
  createCheckoutSession,
  cancelSubscription,
} from "../../api/endpoints";

function formatCardNumber(value) {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}

function formatExpiry(value) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length >= 3) {
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}`;
  }
  return digits;
}

export default function PricingPlans() {
  const { user, updateStoredUser } = useAuth();
  const { showToast } = useToast();

  const [plans, setPlans] = useState([]);
  const [currentSub, setCurrentSub] = useState(null);
  const [billingCycle, setBillingCycle] = useState("annual");
  const [isLoading, setIsLoading] = useState(true);

  // Checkout Modal State
  const [checkoutPlan, setCheckoutPlan] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("card"); // "card" | "paypal"
  const [cardholderName, setCardholderName] = useState(user?.full_name || "");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [paypalEmail, setPaypalEmail] = useState(user?.email || "");
  const [companyName, setCompanyName] = useState(user?.company_name || "");
  const [checkoutError, setCheckoutError] = useState("");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [latestReceipt, setLatestReceipt] = useState(null);

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

  const openCheckoutModal = (plan) => {
    if (!plan || plan.id === "free") return;
    setCheckoutPlan(plan);
    setPaymentMethod("card");
    setCardholderName(user?.full_name || "");
    setPaypalEmail(user?.email || "");
    setCompanyName(user?.company_name || "");
    setCheckoutError("");
    setLatestReceipt(null);
  };

  const fillTestCard = () => {
    setCardholderName(user?.full_name || "Akram Musallam");
    setCardNumber("4242 4242 4242 4242");
    setCardExpiry("12/28");
    setCardCvc("424");
    setCheckoutError("");
  };

  const validatePaymentForm = () => {
    if (checkoutPlan?.id === "enterprise" && (!companyName || companyName.trim().length < 2)) {
      return "يرجى إدخال اسم الشركة أو المؤسسة لتفعيل بوابة التوظيف B2B.";
    }

    if (paymentMethod === "card") {
      if (!cardholderName || cardholderName.trim().length < 3) {
        return "يرجى إدخال اسم حامل البطاقة كما يظهر على البطاقة البنكية.";
      }
      const rawDigits = cardNumber.replace(/\D/g, "");
      if (rawDigits.length !== 16) {
        return "يرجى إدخال رقم بطاقة بنكية صحيح مكون من 16 رقماً.";
      }
      const expParts = cardExpiry.split("/");
      if (expParts.length !== 2 || expParts[0].length !== 2 || expParts[1].length !== 2) {
        return "يرجى إدخال تاريخ انتهاء البطاقة بالصيغة الصحيحة (MM/YY).";
      }
      const month = parseInt(expParts[0], 10);
      const year = 2000 + parseInt(expParts[1], 10);
      const now = new Date();
      if (isNaN(month) || month < 1 || month > 12) {
        return "شهر انتهاء البطاقة غير صحيح (يجب أن يكون بين 01 و 12).";
      }
      if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) {
        return "البطاقة البنكية المدخلة منتهية الصلاحية.";
      }
      const cleanCvc = cardCvc.replace(/\D/g, "");
      if (cleanCvc.length < 3 || cleanCvc.length > 4) {
        return "يرجى إدخال رمز الأمان الخلفي (CVC/CVV) المكون من 3 أو 4 أرقام.";
      }
    } else if (paymentMethod === "paypal") {
      if (!paypalEmail || !paypalEmail.includes("@")) {
        return "يرجى إدخال بريد إلكتروني صحيح مرتبط بحساب PayPal.";
      }
    }
    return "";
  };

  const handleConfirmPayment = async (e) => {
    e.preventDefault();
    if (!checkoutPlan) return;

    const validationError = validatePaymentForm();
    if (validationError) {
      setCheckoutError(validationError);
      return;
    }

    try {
      setIsProcessingPayment(true);
      setCheckoutError("");

      const rawDigits = cardNumber.replace(/\D/g, "");
      const last4 = paymentMethod === "card" ? rawDigits.slice(-4) : "PAYP";

      const res = await createCheckoutSession({
        plan_id: checkoutPlan.id,
        billing_cycle: billingCycle,
        payment_method: paymentMethod,
        cardholder_name: paymentMethod === "card" ? cardholderName.trim() : paypalEmail.trim(),
        card_last4: last4,
        company_name: checkoutPlan.id === "enterprise" ? companyName.trim() : undefined,
      });

      // إذا أعاد الخادم رابط بوابة دفع Stripe خارجية حقيقية، يتم توجيه المتصفح إليها فوراً
      if (res.data?.mode === "payment" && res.data?.checkout_url) {
        window.location.href = res.data.checkout_url;
        return;
      }

      updateStoredUser({
        subscription_tier: checkoutPlan.id,
        role: checkoutPlan.id === "enterprise" ? "recruiter" : user?.role || "candidate",
        company_name:
          checkoutPlan.id === "enterprise"
            ? companyName.trim() || user?.company_name
            : user?.company_name,
      });

      setLatestReceipt(
        res.data?.invoice || {
          invoice_id: `INV-${Date.now().toString().slice(-6)}`,
          plan_name_ar: checkoutPlan.name_ar,
          billing_cycle: billingCycle,
          amount_usd:
            billingCycle === "annual"
              ? checkoutPlan.price_annual
              : checkoutPlan.price_monthly,
          payment_method: paymentMethod,
          card_last4: last4,
          created_at: new Date().toISOString(),
        }
      );

      showToast(
        `تمت عملية الدفع بنجاح وتفعيل باقة ${checkoutPlan.name_ar}`,
        "success"
      );
      await loadPlansAndSub();
    } catch (err) {
      setCheckoutError(getErrorMessage(err, "تعذر إتمام عملية الدفع، يرجى التحقق من البيانات والمحاولة مجدداً."));
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm("هل أنت متأكد من رغبتك في إلغاء التجديد التلقائي للاشتراك؟")) return;
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
  const usage = currentSub?.usage || { analyses_used: 0, interviews_used: 0 };
  const limits = currentSub?.limits || { max_analyses: 3, max_interviews: 2 };
  const invoices = currentSub?.invoices || [];

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      {/* Title & Header */}
      <div className="text-center space-y-3 max-w-2xl mx-auto pt-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-50 border border-accent-200 text-accent-700 text-xs font-bold">
          <Crown size={14} />
          <span>باقات الاشتراك وبوابة الدفع الآمن</span>
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

      {/* Current Subscription & Quota Usage Banner */}
      {currentSub && (
        <div className="card max-w-6xl mx-auto !p-5 bg-slate-900 text-white border border-slate-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-secondary-500/20 border border-secondary-500/40 text-secondary-300 text-[11px] font-bold">
                  باقتك النشطة حالياً
                </span>
                {currentSub.expires_at && activeTier !== "free" && (
                  <span className="text-[11px] text-slate-400">
                    تتجدد في: {new Date(currentSub.expires_at).toLocaleDateString("ar-EG")}
                  </span>
                )}
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white">
                {currentSub.tier_label}
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-6 bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
              <div>
                <p className="text-[11px] text-slate-400 font-semibold">تحليلات السيرة الذاتية المستهلكة</p>
                <p className="text-sm sm:text-base font-black text-white mt-0.5">
                  {usage.analyses_used}{" "}
                  <span className="text-xs font-normal text-slate-400">
                    / {limits.max_analyses > 1000 ? "غير محدود ∞" : `${limits.max_analyses} تحليلات`}
                  </span>
                </p>
              </div>
              <div className="border-r border-slate-700 pr-3 sm:pr-6">
                <p className="text-[11px] text-slate-400 font-semibold">جلسات المقابلات التقنية</p>
                <p className="text-sm sm:text-base font-black text-secondary-400 mt-0.5">
                  {usage.interviews_used}{" "}
                  <span className="text-xs font-normal text-slate-400">
                    / {limits.max_interviews > 1000 ? "غير محدود ∞" : `${limits.max_interviews} مقابلات`}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

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
                      onClick={() => openCheckoutModal(plan)}
                      disabled={plan.id === "free"}
                      className={`w-full inline-flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-bold transition-colors ${
                        isPro
                          ? "bg-primary-600 text-white hover:bg-primary-500"
                          : isEnterprise
                          ? "bg-slate-900 text-white hover:bg-slate-800"
                          : "bg-slate-100 text-slate-500 cursor-default"
                      }`}
                    >
                      {plan.id === "free" ? (
                        "الباقة الأساسية المجانية"
                      ) : (
                        <>
                          <CreditCard size={14} />
                          <span>اشترك الآن وانتقل للدفع</span>
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

      {/* Invoices & Billing History Table */}
      {invoices.length > 0 && (
        <div className="card max-w-6xl mx-auto space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Receipt size={18} className="text-primary-600" />
              <h3 className="text-base font-black text-slate-900">
                سجل الفواتير والمدفوعات السابقة
              </h3>
            </div>
            <span className="text-xs font-bold text-slate-400">
              {invoices.length} فاتورة مسجلة
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-bold">
                  <th className="py-2.5 px-3">رقم الفاتورة</th>
                  <th className="py-2.5 px-3">الباقة</th>
                  <th className="py-2.5 px-3">الدورة</th>
                  <th className="py-2.5 px-3">المبلغ المدفوع</th>
                  <th className="py-2.5 px-3">وسيلة الدفع</th>
                  <th className="py-2.5 px-3">التاريخ</th>
                  <th className="py-2.5 px-3">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {invoices.map((inv) => (
                  <tr key={inv.invoice_id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-3 font-mono font-bold text-slate-900" dir="ltr">
                      {inv.invoice_id}
                    </td>
                    <td className="py-3 px-3 font-bold">{inv.plan_name_ar}</td>
                    <td className="py-3 px-3">
                      {inv.billing_cycle === "annual" ? "سنوي" : "شهري"}
                    </td>
                    <td className="py-3 px-3 font-black text-emerald-700">
                      ${Number(inv.amount_usd || 0).toFixed(2)} USD
                    </td>
                    <td className="py-3 px-3" dir="ltr">
                      {inv.payment_method === "paypal"
                        ? "PayPal"
                        : `•••• ${inv.card_last4 || "4242"}`}
                    </td>
                    <td className="py-3 px-3">
                      {inv.created_at
                        ? new Date(inv.created_at).toLocaleDateString("ar-EG")
                        : "—"}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          inv.status === "active" || inv.status === "paid"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {inv.status === "active" || inv.status === "paid"
                          ? "مدفوعة ومفعّلة"
                          : inv.status === "canceled"
                          ? "ملغاة"
                          : "مؤرشفة"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
              تتم معالجة الدفع عبر بوابات Stripe و PayPal العالمية المشفرة بأعلى معايير الأمان PCI-DSS، مع إصدار فاتورة ضريبية فورية لكل عملية.
            </p>
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-slate-800 text-xs sm:text-sm">
              هل يمكنني إلغاء الاشتراك في أي وقت؟
            </h4>
            <p>
              نعم، بنقرة واحدة من لوحة التحكم يمكنك إلغاء التجديد التلقائي دون أي التزامات مع الاحتفاظ بسجل فواتيرك وتقاريرك.
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

      {/* SECURE CHECKOUT & PAYMENT GATEWAY MODAL */}
      {checkoutPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 sm:p-7 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                  <Lock size={18} className="text-secondary-400" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    بوابة الدفع الإلكتروني الآمن
                  </h3>
                  <p className="text-[11px] font-medium text-slate-500">
                    مشفر بتقنية SSL 256-bit ومتوافق مع معايير PCI-DSS
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCheckoutPlan(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            {latestReceipt ? (
              /* Payment Success Receipt View */
              <div className="space-y-5 py-3 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 size={30} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-lg font-black text-slate-900">
                    تمت عملية الدفع وتفعيل الباقة بنجاح!
                  </h4>
                  <p className="text-xs text-slate-500">
                    تم إصدار الفاتورة الضريبية وتحديث صلاحيات حسابك فوراً
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-right space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">رقم الفاتورة المرجعي:</span>
                    <span className="font-mono font-bold text-slate-900" dir="ltr">
                      {latestReceipt.invoice_id}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">الباقة المفعّلة:</span>
                    <span className="font-bold text-slate-900">
                      {latestReceipt.plan_name_ar}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">دورة الفوترة:</span>
                    <span className="font-bold text-slate-900">
                      {latestReceipt.billing_cycle === "annual" ? "سنوية (خصم 20%)" : "شهرية"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">وسيلة الدفع:</span>
                    <span className="font-bold text-slate-900" dir="ltr">
                      {latestReceipt.payment_method === "paypal"
                        ? "PayPal Express"
                        : `Card •••• ${latestReceipt.card_last4}`}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200 text-sm">
                    <span className="font-bold text-slate-800">الإجمالي المدفوع:</span>
                    <span className="font-black text-emerald-600">
                      ${Number(latestReceipt.amount_usd || 0).toFixed(2)} USD
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setCheckoutPlan(null)}
                  className="btn-primary w-full py-3 rounded-xl text-xs font-bold"
                >
                  العودة إلى لوحة الباقات
                </button>
              </div>
            ) : (
              /* Checkout Form View */
              <form onSubmit={handleConfirmPayment} className="space-y-4">
                {/* Order Summary Box */}
                <div className="rounded-xl bg-slate-900 text-white p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-secondary-400 uppercase tracking-wider block">
                      ملخص الاشتراك المختار
                    </span>
                    <h4 className="text-sm sm:text-base font-black mt-0.5">
                      {checkoutPlan.name_ar}
                    </h4>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      {billingCycle === "annual"
                        ? "دورة فوترة سنوية (شاملة خصم 20%)"
                        : "دورة فوترة شهرية مرنة"}
                    </p>
                  </div>
                  <div className="text-left">
                    <span className="text-2xl font-black text-white">
                      $
                      {billingCycle === "annual"
                        ? checkoutPlan.price_annual
                        : checkoutPlan.price_monthly}
                    </span>
                    <span className="block text-[10px] text-slate-400">
                      USD / {billingCycle === "annual" ? "سنوياً" : "شهرياً"}
                    </span>
                  </div>
                </div>

                {checkoutError && (
                  <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-bold text-red-700 flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{checkoutError}</span>
                  </div>
                )}

                {/* Enterprise Company Name Field */}
                {checkoutPlan.id === "enterprise" && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      اسم الشركة أو المؤسسة (لتفعيل بوابة التوظيف B2B) *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="مثال: شركة عسل للتقنيات (Asal Technologies)"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="input-field w-full text-xs"
                      />
                    </div>
                  </div>
                )}

                {/* Payment Method Selector Tabs */}
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("card")}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition ${
                      paymentMethod === "card"
                        ? "border-primary-600 bg-primary-50/70 text-primary-800"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <CreditCard size={15} />
                    <span>بطاقة بنكية (Stripe)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("paypal")}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition ${
                      paymentMethod === "paypal"
                        ? "border-primary-600 bg-primary-50/70 text-primary-800"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <ShieldCheck size={15} />
                    <span>PayPal Express</span>
                  </button>
                </div>

                {paymentMethod === "card" ? (
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500">
                        بيانات البطاقة الائتمانية (Visa / Mastercard)
                      </span>
                      <button
                        type="button"
                        onClick={fillTestCard}
                        className="text-[11px] font-bold text-primary-600 hover:text-primary-800 underline"
                      >
                        تعبئة بطاقة اختبارية قياسية (4242)
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        اسم حامل البطاقة *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="الاسم الكامل كما يظهر على البطاقة"
                        value={cardholderName}
                        onChange={(e) => setCardholderName(e.target.value)}
                        className="input-field w-full text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        رقم البطاقة البنكية (16 رقماً) *
                      </label>
                      <input
                        type="text"
                        required
                        dir="ltr"
                        placeholder="4242 •••• •••• ••••"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                        className="input-field w-full text-xs font-mono tracking-wider text-left"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          تاريخ الانتهاء (MM/YY) *
                        </label>
                        <input
                          type="text"
                          required
                          dir="ltr"
                          placeholder="12/28"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                          className="input-field w-full text-xs font-mono text-left"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          رمز الأمان (CVC) *
                        </label>
                        <input
                          type="password"
                          required
                          dir="ltr"
                          maxLength={4}
                          placeholder="•••"
                          value={cardCvc}
                          onChange={(e) =>
                            setCardCvc(e.target.value.replace(/\D/g, "").slice(0, 4))
                          }
                          className="input-field w-full text-xs font-mono text-left"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        البريد الإلكتروني لحساب PayPal *
                      </label>
                      <input
                        type="email"
                        required
                        dir="ltr"
                        placeholder="name@example.com"
                        value={paypalEmail}
                        onChange={(e) => setPaypalEmail(e.target.value)}
                        className="input-field w-full text-xs text-left"
                      />
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setCheckoutPlan(null)}
                    className="btn-outline !py-2.5 !px-4 !text-xs"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessingPayment}
                    className="btn-primary flex-1 !py-3 !px-5 !text-xs inline-flex items-center justify-center gap-2"
                  >
                    <Lock size={14} />
                    <span>
                      {isProcessingPayment
                        ? "جاري معالجة الدفع وتوثيق الفاتورة..."
                        : `تأكيد الدفع ($${
                            billingCycle === "annual"
                              ? checkoutPlan.price_annual
                              : checkoutPlan.price_monthly
                          } USD)`}
                    </span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
