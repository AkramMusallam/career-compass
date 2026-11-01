import { useState } from "react";
import { ThumbsUp, ThumbsDown, CheckCircle2 } from "lucide-react";

import { getErrorMessage } from "../../api/client";
import { submitAnalysisFeedback } from "../../api/endpoints";

export default function FeedbackWidget({ analysisId }) {
  const [status, setStatus] = useState("idle");
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [comment, setComment] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const sendFeedback = async (useful, commentText) => {
    setStatus("submitting");
    setErrorMessage("");
    try {
      await submitAnalysisFeedback(analysisId, {
        useful,
        comment: commentText || undefined,
      });
      setStatus("done");
    } catch (error) {
      setStatus("idle");
      setErrorMessage(getErrorMessage(error, "تعذر إرسال تقييمك"));
    }
  };

  const handleThumbsUp = () => sendFeedback(true);
  const handleThumbsDown = () => {
    setShowCommentBox(true);
  };

  if (status === "done") {
    return (
      <div className="card flex flex-col items-center gap-1.5 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary-50 text-secondary-600 border border-secondary-100">
          <CheckCircle2 size={20} />
        </div>
        <p className="font-bold text-slate-800 text-sm">شكراً على ملاحظتك</p>
        <p className="text-xs text-slate-500">
          تقييمك يساعدنا على تحسين دقة التوصيات مستقبلاً
        </p>
      </div>
    );
  }

  return (
    <div className="card flex flex-col items-center gap-3 text-center">
      <p className="font-bold text-slate-800 text-sm">هل هذه التوصية منطقية لك؟</p>

      {errorMessage && <p className="error-text">{errorMessage}</p>}

      {!showCommentBox ? (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleThumbsUp}
            disabled={status === "submitting"}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:border-secondary-300 hover:bg-secondary-50 hover:text-secondary-700"
            aria-label="مفيدة"
          >
            <ThumbsUp size={16} />
            <span>نعم، مفيدة</span>
          </button>
          <button
            type="button"
            onClick={handleThumbsDown}
            disabled={status === "submitting"}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-danger"
            aria-label="غير مفيدة"
          >
            <ThumbsDown size={16} />
            <span>تحتاج تحسين</span>
          </button>
        </div>
      ) : (
        <div className="w-full max-w-md space-y-3">
          <textarea
            className="input-field"
            rows={2}
            placeholder="ما الذي لم يكن منطقياً؟ (اختياري)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="flex justify-center gap-2.5">
            <button
              type="button"
              className="btn-outline"
              onClick={() => setShowCommentBox(false)}
            >
              رجوع
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={status === "submitting"}
              onClick={() => sendFeedback(false, comment)}
            >
              {status === "submitting" ? "جاري الإرسال..." : "إرسال"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
