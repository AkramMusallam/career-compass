import { createPortal } from "react-dom";

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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-black text-slate-900">
            📝 خطاب تغطية: {coverLetterJob}
          </h2>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-danger"
          >
            ✕
          </button>
        </div>
        {isGeneratingCL ? (
          <div className="py-12 text-center text-slate-500">
            <div className="inline-block h-7 w-7 animate-spin rounded-full border-2 border-solid border-primary border-r-transparent mb-3" />
            <p className="animate-pulse font-bold">
              جاري صياغة خطاب التغطية بالذكاء الاصطناعي...
            </p>
          </div>
        ) : (
          <div
            className="bg-slate-50 p-5 rounded-2xl border border-slate-200 whitespace-pre-wrap text-slate-700 text-sm leading-relaxed"
            dir="auto"
          >
            {coverLetterText}
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="btn-outline"
            onClick={onClose}
          >
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
            📋 نسخ النص
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
