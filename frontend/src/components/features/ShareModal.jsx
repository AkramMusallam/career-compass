import { useState } from "react";
import { createPortal } from "react-dom";
import { Share2, Copy, Check, X } from "lucide-react";

import { getErrorMessage } from "../../api/client";
import { createShareLink, revokeShareLink } from "../../api/endpoints";
import { useToast } from "../../context/ToastContext";

export default function ShareModal({
  analysisId,
  shareToken,
  onShareTokenChange,
  onClose,
}) {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = shareToken
    ? `${window.location.origin}/shared/${shareToken}`
    : "";

  const handleGenerateLink = async () => {
    setIsLoading(true);
    try {
      const res = await createShareLink(analysisId);
      onShareTokenChange(res.data.share_token);
    } catch (error) {
      showToast(getErrorMessage(error, "تعذر إنشاء رابط المشاركة"), "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = async () => {
    setIsRevoking(true);
    try {
      await revokeShareLink(analysisId);
      onShareTokenChange(null);
      showToast("تم إلغاء رابط المشاركة");
    } catch (error) {
      showToast(getErrorMessage(error, "تعذر إلغاء المشاركة"), "error");
    } finally {
      setIsRevoking(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs px-4"
      onClick={onClose}
      role="presentation"
    >
      <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Share2 size={18} className="text-primary-600" />
            <h2 className="font-black text-slate-900">مشاركة النتائج</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        <p className="mb-4 text-xs sm:text-sm text-slate-500 leading-relaxed">
          الرابط يعرض نسخة عامة محدودة (Career Score، Career DNA، وأفضل الوظائف فقط) — بدون اسمك أو بريدك الإلكتروني أو تفاصيل مشاريعك أو خطة التعلم الشخصية.
        </p>

        {shareToken ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="input-field text-xs"
                dir="ltr"
              />
              <button
                type="button"
                className="btn-primary shrink-0"
                onClick={handleCopy}
              >
                {copied ? (
                  <>
                    <Check size={14} />
                    <span>تم النسخ</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>نسخ</span>
                  </>
                )}
              </button>
            </div>
            <button
              type="button"
              className="w-full rounded-xl border border-danger px-4 py-2.5 text-xs sm:text-sm font-bold text-danger hover:bg-danger hover:text-white transition-colors"
              onClick={handleRevoke}
              disabled={isRevoking}
            >
              {isRevoking ? "جاري الإلغاء..." : "إلغاء المشاركة"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn-primary w-full"
            onClick={handleGenerateLink}
            disabled={isLoading}
          >
            {isLoading ? "جاري الإنشاء..." : "إنشاء رابط مشاركة"}
          </button>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full text-xs sm:text-sm font-bold text-slate-400 hover:text-slate-600"
        >
          إغلاق
        </button>
      </div>
    </div>,
    document.body
  );
}
