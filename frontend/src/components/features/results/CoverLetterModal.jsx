import { createPortal } from "react-dom";
import { FileText, X, Copy } from "lucide-react";

export default function CoverLetterModal({
  coverLetterJob,
  coverLetterText,
  isGeneratingCL,
  onClose,
  onCopySuccess,
}) {
  if (!coverLetterJob) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-3 sm:p-4 backdrop-blur-xs"
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
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="إغلاق"
          >
            <X size={18} />
          </button>
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
            onClick={() => {
              navigator.clipboard.writeText(coverLetterText);
              if (onCopySuccess) onCopySuccess();
            }}
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
