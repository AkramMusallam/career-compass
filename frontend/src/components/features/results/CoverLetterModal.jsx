import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FileText, X, Copy, Sparkles } from "lucide-react";

import { useToast } from "../../../context/ToastContext";

export default function CoverLetterModal({
  coverLetterJob,
  initialJobDescription = "",
  coverLetterText,
  isGeneratingCL,
  onGenerate,
  onClose,
  onCopySuccess,
}) {
  const { showToast } = useToast();
  const [jobDescription, setJobDescription] = useState(
    initialJobDescription || coverLetterJob || ""
  );

  useEffect(() => {
    if (coverLetterJob) {
      setJobDescription(initialJobDescription || coverLetterJob);
    }
  }, [coverLetterJob, initialJobDescription]);

  if (!coverLetterJob) return null;

  const trimmedDescription = jobDescription.trim();
  const canGenerate = trimmedDescription.length >= 2 && !isGeneratingCL;

  const handleCopy = async () => {
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(coverLetterText);
      if (onCopySuccess) onCopySuccess();
    } catch {
      showToast("تعذر النسخ التلقائي، حدد النص وانسخه يدوياً", "error");
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-3 sm:p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center gap-2 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={18} className="text-primary-600 shrink-0" />
            <h2 className="text-base sm:text-lg font-black text-slate-900 truncate">
              خطاب تغطية: {coverLetterJob}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 space-y-2">
          <label
            htmlFor="cover-letter-job-description"
            className="block text-xs font-bold text-slate-700"
          >
            الوصف الوظيفي المستهدف (عدّله أو الصق تفاصيل الوظيفة لتخصيص الخطاب)
          </label>
          <textarea
            id="cover-letter-job-description"
            rows={4}
            maxLength={5000}
            dir="auto"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="الصق هنا الوصف الوظيفي أو المهارات المطلوبة..."
            className="input-field resize-y text-xs leading-relaxed"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-slate-400">
              {trimmedDescription.length} / 5000 حرف
            </span>
            {onGenerate && (
              <button
                type="button"
                disabled={!canGenerate}
                onClick={() => onGenerate(coverLetterJob, trimmedDescription)}
                className="btn-outline !py-1.5 !px-3 !text-xs"
              >
                <Sparkles size={13} />
                <span>توليد بالوصف المحدّث</span>
              </button>
            )}
          </div>
        </div>

        {isGeneratingCL ? (
          <div className="py-12 text-center text-slate-500">
            <div className="inline-block h-7 w-7 animate-spin rounded-full border-2 border-solid border-primary-600 border-r-transparent mb-3" />
            <p className="text-xs sm:text-sm font-bold">
              جاري صياغة خطاب التغطية بالذكاء الاصطناعي...
            </p>
          </div>
        ) : (
          <div
            className="bg-slate-50 p-4 sm:p-5 rounded-xl border border-slate-200 whitespace-pre-wrap text-slate-700 text-xs sm:text-sm leading-relaxed"
            dir="auto"
          >
            {coverLetterText}
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>
            إغلاق
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={isGeneratingCL || !coverLetterText}
            onClick={handleCopy}
          >
            <Copy size={15} />
            <span>نسخ النص</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
