import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { chatInterview, getInterviewSession, evaluateInterview } from "../../api/endpoints";
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

  // Fetch session details on mount
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

    if (!window.confirm("هل تريد إنهاء المقابلة وطلب تقييم الذكاء الاصطناعي الشامل لإجاباتك؟")) {
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
      <div className="max-w-3xl mx-auto py-12 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent" />
        <p className="mt-3 text-sm font-bold text-slate-500">جاري تحميل جلسة المقابلة...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-[85vh]">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-800">محاكي المقابلات التقنية (AI Mock Interview)</h1>
            {sessionStatus === "completed" ? (
              <span className="bg-green-100 text-green-700 text-xs px-2.5 py-1 rounded-full font-bold">
                ✓ مكتملة ومقيّمة
              </span>
            ) : (
              <span className="bg-blue-100 text-blue-700 text-xs px-2.5 py-1 rounded-full font-bold">
                ● جارية الآن
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            الموقع المستهدف: <span className="font-bold text-slate-700">{jobTitle}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {sessionStatus !== "completed" && (
            <button
              onClick={handleFinishAndEvaluate}
              disabled={evaluating || loading}
              className="btn-primary bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-4 py-2"
            >
              {evaluating ? "جاري التقييم..." : "🏁 إنهاء المقابلة والحصول على التقييم"}
            </button>
          )}
          <button onClick={() => navigate(-1)} className="btn-outline text-xs px-3 py-2">
            العودة
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden">
        {/* Chat Stream */}
        <div className="flex-1 bg-slate-50 p-4 rounded-2xl border border-slate-200 overflow-y-auto flex flex-col gap-3">
          {messages.length === 0 && (
            <div className="text-center text-slate-400 my-auto py-10">
              <span className="text-3xl block mb-2">💬</span>
              أرسل رسالة ترحيب لبدء محاكاة المقابلة التقنية...
            </div>
          )}

          {messages.map((msg, i) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={i}
                className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
              >
                <span className="text-[10px] font-bold text-slate-400 mb-1 px-1">
                  {isUser ? "أنت (المرشح)" : "المُحاور الذكي"}
                </span>
                <div
                  className={`p-3.5 rounded-2xl max-w-[85%] text-sm leading-relaxed whitespace-pre-line shadow-sm ${
                    isUser
                      ? "bg-primary text-white rounded-br-none"
                      : "bg-white text-slate-800 border border-slate-200 rounded-bl-none"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex flex-col items-start">
              <span className="text-[10px] font-bold text-slate-400 mb-1 px-1">المُحاور الذكي</span>
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 text-slate-500 rounded-bl-none animate-pulse text-sm">
                المُحاور يكتب سؤاله التالي...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Evaluation Panel (if completed) */}
        {evaluation && (
          <div className="w-full md:w-96 bg-white p-5 rounded-2xl border border-slate-200 overflow-y-auto flex flex-col gap-4 shadow-sm">
            <div className="text-center pb-3 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                النتيجة الإجمالية للمقابلة
              </span>
              <div className="inline-flex items-baseline gap-1">
                <span className="text-4xl font-black text-primary">{evaluation.final_score}</span>
                <span className="text-slate-400 font-bold">/ 10</span>
              </div>
              <div className="mt-2 flex justify-center gap-3 text-xs">
                <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium">
                  الجانب التقني: <b>{evaluation.technical_score}/10</b>
                </span>
                <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium">
                  التواصل: <b>{evaluation.communication_score}/10</b>
                </span>
              </div>
            </div>

            {/* Overall Feedback */}
            <div>
              <h3 className="text-xs font-black text-slate-700 mb-1.5 flex items-center gap-1">
                <span>💡</span> ملخص التقييم العام
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                {evaluation.overall_feedback}
              </p>
            </div>

            {/* Strengths */}
            {evaluation.strengths && evaluation.strengths.length > 0 && (
              <div>
                <h3 className="text-xs font-black text-emerald-700 mb-1.5 flex items-center gap-1">
                  <span>✨</span> نقاط القوة
                </h3>
                <ul className="space-y-1 text-xs text-slate-600">
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
            {evaluation.technical_mistakes && evaluation.technical_mistakes.length > 0 && (
              <div>
                <h3 className="text-xs font-black text-amber-700 mb-1.5 flex items-center gap-1">
                  <span>⚠️</span> نقاط التحسين التقني
                </h3>
                <ul className="space-y-1 text-xs text-slate-600">
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
              <div className="pt-2 border-t border-slate-100">
                <h3 className="text-xs font-black text-primary mb-2 flex items-center gap-1">
                  <span>🎯</span> الإجابات النموذجية المقترحة
                </h3>
                <div className="space-y-2">
                  {evaluation.model_answers.map((ma, idx) => (
                    <div key={idx} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                      <p className="font-bold text-slate-700 mb-1">س: {ma.question}</p>
                      <p className="text-slate-600 leading-normal">ج: {ma.model_answer}</p>
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
        <form onSubmit={sendMessage} className="flex gap-2 mt-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="اكتب إجابتك هنا بوضوح واضغط إرسال..."
            className="input-field flex-1 text-sm py-2.5"
            disabled={loading || evaluating}
            autoFocus
          />
          <button
            type="submit"
            className="btn-primary whitespace-nowrap px-6"
            disabled={loading || evaluating || !input.trim()}
          >
            إرسال الإجابة
          </button>
        </form>
      ) : (
        <div className="mt-3 p-3 bg-slate-100 rounded-xl text-center text-xs font-bold text-slate-500">
          تم إنهاء وتقييم هذه المقابلة بنجاح. يمكنك العودة لصفحة النتائج أو بدء مقابلة جديدة.
        </div>
      )}
    </div>
  );
}