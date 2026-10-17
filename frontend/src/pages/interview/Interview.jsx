import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  chatInterview,
  getInterviewSession,
  evaluateInterview,
} from "../../api/endpoints";
import { getErrorMessage } from "../../api/client";

export default function Interview() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [jobTitle, setJobTitle] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [sessionStatus, setSessionStatus] = useState("in_progress"); // in_progress | completed
  const [initialLoading, setInitialLoading] = useState(true);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    getInterviewSession(sessionId)
      .then((res) => {
        if (!isMounted) return;
        setJobTitle(res.data.job_title || "الوظيفة المستهدفة");
        setSessionStatus(res.data.status || "in_progress");
        setMessages(res.data.messages || []);
        if (res.data.evaluation) {
          setEvaluation(res.data.evaluation);
        }
      })
      .catch((err) => {
        console.error("Failed to load interview session:", err);
      })
      .finally(() => {
        if (isMounted) setInitialLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading || sessionStatus === "completed") return;

    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const res = await chatInterview(sessionId, userMsg);
      setMessages(res.data.messages);
      setSessionStatus(res.data.status || "in_progress");
    } catch (err) {
      alert(getErrorMessage(err, "فشل إرسال الإجابة، يرجى المحاولة ثانية"));
    } finally {
      setLoading(false);
    }
  };

  const handleFinishAndEvaluate = async () => {
    const userAnswers = messages.filter((m) => m.role === "user");
    if (userAnswers.length === 0) {
      alert("يرجى الإجابة على سؤال واحد على الأقل قبل طلب التقييم النهائي.");
      return;
    }

    if (
      !window.confirm(
        "هل تريد إنهاء المقابلة وطلب تقييم الذكاء الاصطناعي الشامل لإجاباتك؟"
      )
    ) {
      return;
    }

    setEvaluating(true);
    try {
      const res = await evaluateInterview(sessionId);
      setEvaluation(res.data);
      setSessionStatus("completed");
    } catch (err) {
      alert(getErrorMessage(err, "تعذر تقييم المقابلة، يرجى المحاولة ثانية"));
    } finally {
      setEvaluating(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center">
        <div className="inline-block h-9 w-9 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent" />
        <p className="mt-3 text-sm font-bold text-slate-500">
          جاري تجهيز استوديو المقابلة الذكية...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto flex flex-col h-[84vh] animate-fade-in-up">
      {/* Studio Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-gradient-to-l from-indigo-50/95 via-white/95 to-emerald-50/85 px-6 py-4 shadow-md shadow-indigo-500/5 border border-indigo-100/90 backdrop-blur-xl">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xl">🎙️</span>
            <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-900">
              استوديو المقابلات التقنية الذكي
            </h1>
            {sessionStatus === "completed" ? (
              <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-0.5 text-xs font-extrabold text-emerald-700">
                ✓ مكتملة ومقيّمة
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200 px-3 py-0.5 text-xs font-extrabold text-indigo-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>جلسة مباشرة</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            الدور الوظيفي المستهدف:{" "}
            <span className="font-extrabold text-indigo-700">{jobTitle}</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {sessionStatus !== "completed" && (
            <button
              onClick={handleFinishAndEvaluate}
              disabled={evaluating || loading}
              className="btn-secondary !py-2 !px-4 !text-xs"
            >
              {evaluating
                ? "جاري إصدار التقييم..."
                : "🏁 إنهاء المقابلة وإصدار التقييم"}
            </button>
          )}
          <button
            onClick={() => navigate(-1)}
            className="btn-outline !py-2 !px-3.5 !text-xs"
          >
            العودة ←
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden">
        {/* Chat Stream */}
        <div className="flex-1 bg-white/85 backdrop-blur-xl p-5 rounded-3xl border border-slate-200/80 shadow-sm overflow-y-auto flex flex-col gap-4">
          {messages.length === 0 && (
            <div className="text-center text-slate-400 my-auto py-12">
              <span className="text-4xl block mb-3">💬</span>
              <p className="font-bold text-slate-600">
                أرسل رسالة ترحيب لبدء محاكاة المقابلة التقنية...
              </p>
            </div>
          )}

          {messages.map((msg, i) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={i}
                className={`flex flex-col ${
                  isUser ? "items-end" : "items-start"
                }`}
              >
                <span className="text-[11px] font-extrabold text-slate-400 mb-1 px-1.5">
                  {isUser ? "👤 أنت (المرشح)" : "🤖 المُحاور الذكي"}
                </span>
                <div
                  className={`p-4 rounded-2xl max-w-[85%] text-sm leading-relaxed whitespace-pre-line shadow-sm ${
                    isUser
                      ? "bg-gradient-to-l from-indigo-600 to-violet-600 text-white rounded-br-none shadow-indigo-500/15"
                      : "bg-slate-50 text-slate-800 border border-slate-200/90 rounded-bl-none"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex flex-col items-start">
              <span className="text-[11px] font-extrabold text-slate-400 mb-1 px-1.5">
                🤖 المُحاور الذكي
              </span>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-500 rounded-bl-none animate-pulse text-sm font-semibold">
                المُحاور يحلل إجابتك ويكتب السؤال التالي...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Evaluation Panel (if completed) */}
        {evaluation && (
          <div className="w-full md:w-96 bg-white/95 backdrop-blur-xl p-6 rounded-3xl border border-slate-200/90 overflow-y-auto flex flex-col gap-4 shadow-md">
            <div className="text-center pb-4 border-b border-slate-100">
              <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                النتيجة الإجمالية للمقابلة
              </span>
              <div className="inline-flex items-baseline gap-1">
                <span className="text-4xl font-black text-indigo-600">
                  {evaluation.final_score}
                </span>
                <span className="text-slate-400 font-bold">/ 10</span>
              </div>
              <div className="mt-3 flex justify-center gap-2.5 text-xs">
                <span className="bg-indigo-50 text-indigo-800 border border-indigo-100 px-3 py-1 rounded-xl font-bold">
                  التقني: <b>{evaluation.technical_score}/10</b>
                </span>
                <span className="bg-emerald-50 text-emerald-800 border border-emerald-100 px-3 py-1 rounded-xl font-bold">
                  التواصل: <b>{evaluation.communication_score}/10</b>
                </span>
              </div>
            </div>

            {/* Overall Feedback */}
            <div>
              <h3 className="text-xs font-black text-slate-800 mb-1.5 flex items-center gap-1">
                <span>💡</span> ملخص التقييم العام
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                {evaluation.overall_feedback}
              </p>
            </div>

            {/* Strengths */}
            {evaluation.strengths && evaluation.strengths.length > 0 && (
              <div>
                <h3 className="text-xs font-black text-emerald-700 mb-1.5 flex items-center gap-1">
                  <span>✨</span> نقاط القوة
                </h3>
                <ul className="space-y-1.5 text-xs text-slate-600">
                  {evaluation.strengths.map((s, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-emerald-500 font-bold">✓</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Technical Mistakes / Gaps */}
            {evaluation.technical_mistakes &&
              evaluation.technical_mistakes.length > 0 && (
                <div>
                  <h3 className="text-xs font-black text-amber-700 mb-1.5 flex items-center gap-1">
                    <span>⚠️</span> نقاط التحسين التقني
                  </h3>
                  <ul className="space-y-1.5 text-xs text-slate-600">
                    {evaluation.technical_mistakes.map((m, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-amber-500 font-bold">•</span>
                        <span>{m}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {/* Model Answers */}
            {evaluation.model_answers && evaluation.model_answers.length > 0 && (
              <div className="pt-3 border-t border-slate-100">
                <h3 className="text-xs font-black text-indigo-700 mb-2 flex items-center gap-1">
                  <span>🎯</span> الإجابات النموذجية المقترحة
                </h3>
                <div className="space-y-2.5">
                  {evaluation.model_answers.map((ma, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 text-xs"
                    >
                      <p className="font-bold text-slate-800 mb-1">
                        س: {ma.question}
                      </p>
                      <p className="text-slate-600 leading-relaxed">
                        ج: {ma.model_answer}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input Form */}
      {sessionStatus !== "completed" ? (
        <form onSubmit={sendMessage} className="flex gap-2.5 mt-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="اكتب إجابتك التقنية هنا بوضوح واضغط إرسال..."
            className="input-field flex-1 text-sm py-3.5"
            disabled={loading || evaluating}
            autoFocus
          />
          <button
            type="submit"
            className="btn-primary whitespace-nowrap px-7"
            disabled={loading || evaluating || !input.trim()}
          >
            إرسال الإجابة ←
          </button>
        </form>
      ) : (
        <div className="mt-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-center text-xs font-extrabold text-emerald-800">
          تم إنهاء وتقييم هذه المقابلة بنجاح. يمكنك مراجعة التقرير الجانبي أو العودة لصفحة النتائج.
        </div>
      )}
    </div>
  );
}