import { useState } from "react";

import { getErrorMessage } from "../api/client";
import { submitAnalysisFeedback } from "../api/endpoints";

export default function FeedbackWidget({ analysisId }) {
  const [status, setStatus] = useState("idle"); // idle | submitting | done
  const [selected, setSelected] = useState(null); // true | false
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [comment, setComment] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const sendFeedback = async (useful, commentText) => {
    setStatus("submitting");
    setErrorMessage("");
    try {
      await submitAnalysisFeedback(analysisId, { useful, comment: commentText || undefined });
      setSelected(useful);
      setStatus("done");
    } catch (error) {
      setStatus("idle");
      setErrorMessage(getErrorMessage(error, "تعذر إرسال تقييمك"));
    }
  };

  const handleThumbsUp = () => sendFeedback(true);
  const handleThumbsDown = () => {
    // نعطي فرصة لإضافة تعليق اختياري قبل إرسال تقييم سلبي
    setShowCommentBox(true);
  };

  if (status === "done") {
    return (
      <div className="card flex flex-col items-center gap-1 text-center">
        <span className="text-2xl" aria-hidden="true">
          {selected ? "🙌" : "🙏"}
        </span>
        <p className="font-bold text-slate-700">شكراً على ملاحظتك!</p>
        <p className="text-sm text-slate-500">تقييمك يساعدنا على تحسين دقة التوصيات مستقبلاً</p>
      </div>
    );
  }

  return (
    <div className="card flex flex-col items-center gap-3 text-center">
      <p className="font-bold text-slate-700">هل هذه التوصية منطقية إلك؟</p>

      {errorMessage && <p className="error-text">{errorMessage}</p>}

      {!showCommentBox ? (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleThumbsUp}
            disabled={status === "submitting"}
            className="rounded-xl border-2 border-slate-200 px-5 py-2.5 text-2xl transition hover:border-secondary hover:bg-secondary-50"
            aria-label="مفيدة"
          >
            👍
          </button>
          <button
            type="button"
            onClick={handleThumbsDown}
            disabled={status === "submitting"}
            className="rounded-xl border-2 border-slate-200 px-5 py-2.5 text-2xl transition hover:border-danger hover:bg-danger-50"
            aria-label="غير مفيدة"
          >
            👎
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
          <div className="flex justify-center gap-3">
            <button type="button" className="btn-outline" onClick={() => setShowCommentBox(false)}>
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
