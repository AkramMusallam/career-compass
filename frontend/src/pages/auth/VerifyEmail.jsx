import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, MailCheck, ArrowRight } from "lucide-react";

import { getErrorMessage } from "../../api/client";
import { resendVerification, verifyEmail } from "../../api/endpoints";
import CompassLogo from "../../components/layout/CompassLogo";
import Spinner from "../../components/ui/Spinner";
import { readFragmentToken } from "../../utils/fragmentToken";

const inflightVerifications = new Map();

function verifyOnce(token) {
  if (!inflightVerifications.has(token)) {
    const req = verifyEmail(token).finally(() => {
      setTimeout(() => inflightVerifications.delete(token), 5000);
    });
    inflightVerifications.set(token, req);
  }
  return inflightVerifications.get(token);
}

export default function VerifyEmail() {
  const { token: routeToken } = useParams();
  const [token] = useState(() =>
    readFragmentToken({ paramToken: routeToken, cleanPath: "/verify-email" })
  );
  const [status, setStatus] = useState(token ? "verifying" : "missing");
  const [message, setMessage] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resendNotice, setResendNotice] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("missing");
      return;
    }
    let mounted = true;
    verifyOnce(token)
      .then(() => {
        if (mounted) {
          setStatus("success");
          setMessage("تم تأكيد بريدك الإلكتروني بنجاح! يمكنك الآن تسجيل الدخول واستخدام جميع الميزات.");
        }
      })
      .catch((error) => {
        if (mounted) {
          setStatus("error");
          setMessage(
            getErrorMessage(error, "رابط التأكيد غير صالح أو منتهي الصلاحية.")
          );
        }
      });
    return () => {
      mounted = false;
    };
  }, [token]);

  const handleResend = async (e) => {
    e.preventDefault();
    if (!resendEmail.trim() || resending) return;
    setResending(true);
    setResendNotice("");
    try {
      await resendVerification(resendEmail.trim());
      setResendNotice(
        "إذا كان البريد مسجلاً وغير مؤكد، تم إرسال رابط تأكيد جديد."
      );
    } catch (error) {
      setResendNotice(
        getErrorMessage(error, "تعذر إعادة إرسال رابط التأكيد.")
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F8FA] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Link to="/login">
            <CompassLogo size={42} />
          </Link>
        </div>

        <div className="card !p-6 sm:!p-8 text-center space-y-4">
          {status === "verifying" && (
            <>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600 border border-primary-100">
                <MailCheck size={22} />
              </div>
              <h1 className="text-xl font-black text-slate-900">
                جاري تأكيد البريد الإلكتروني...
              </h1>
              <div className="flex justify-center py-2">
                <Spinner size={28} />
              </div>
            </>
          )}

          {status === "success" && (
            <>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-secondary-50 text-secondary-600 border border-secondary-100">
                <CheckCircle2 size={24} />
              </div>
              <h1 className="text-xl font-black text-slate-900">
                تم تأكيد البريد الإلكتروني
              </h1>
              <p className="text-sm font-medium text-slate-600 leading-relaxed">
                {message}
              </p>
              <Link to="/login" className="btn-primary w-full py-3 inline-flex justify-center">
                الانتقال إلى تسجيل الدخول
              </Link>
            </>
          )}

          {(status === "error" || status === "missing") && (
            <>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-danger border border-red-100">
                <AlertCircle size={24} />
              </div>
              <h1 className="text-xl font-black text-slate-900">
                تعذر تأكيد البريد الإلكتروني
              </h1>
              <p className="text-sm font-medium text-slate-600 leading-relaxed">
                {message || "لم يتم العثور على رمز التأكيد في الرابط."}
              </p>

              <form onSubmit={handleResend} className="space-y-3 pt-2 text-start">
                <label htmlFor="resend-email" className="label-text">
                  إعادة إرسال رابط التأكيد
                </label>
                <input
                  id="resend-email"
                  type="email"
                  required
                  className="input-field"
                  dir="ltr"
                  placeholder="you@example.com"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                />
                {resendNotice && (
                  <p role="status" className="text-xs font-bold text-primary-700">
                    {resendNotice}
                  </p>
                )}
                <button
                  type="submit"
                  className="btn-secondary w-full py-2.5"
                  disabled={resending || !resendEmail.trim()}
                >
                  {resending ? "جاري الإرسال..." : "إرسال رابط تأكيد جديد"}
                </button>
              </form>

              <div className="pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-600 hover:text-primary-600"
                >
                  <ArrowRight size={15} />
                  <span>العودة لتسجيل الدخول</span>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
