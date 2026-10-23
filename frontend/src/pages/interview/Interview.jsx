import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  chatInterview,
  getInterviewSession,
  evaluateInterview,
  sendVoiceInterviewAnswer,
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

  // Phase 2 (Section 7.1): Voice & Audio Mock Interviews state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [latestVoiceFeedback, setLatestVoiceFeedback] = useState(null);
  const [ttsEnabled, setTtsEnabled] = useState(false);

  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const recordingStartRef = useRef(0);

  useEffect(() => {
    let isMounted = true;
    getInterviewSession(sessionId)
      .then((res) => {
        if (!isMounted) return;
        setJobTitle(res.data.job_title || "الوظيفة المستهدفة");
        setSessionStatus(res.data.status || "in_progress");
        const loadedMessages = res.data.messages || [];
        setMessages(loadedMessages);
        const lastWithVoice = [...loadedMessages]
          .reverse()
          .find((m) => m.voice_feedback);
        if (lastWithVoice?.voice_feedback) {
          setLatestVoiceFeedback(lastWithVoice.voice_feedback);
        }
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
      if (timerRef.current) clearInterval(timerRef.current);
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, [sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Optional Text-to-Speech for AI interviewer questions
  const speakText = (text) => {
    if (!ttsEnabled || !window.speechSynthesis || !text) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const hasArabic = /[\u0600-\u06FF]/.test(text);
      utterance.lang = hasArabic ? "ar-SA" : "en-US";
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Ignore TTS errors on unsupported browsers
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading || sessionStatus === "completed") return;

    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const res = await chatInterview(sessionId, userMsg);
      const updated = res.data.messages || [];
      setMessages(updated);
      setSessionStatus(res.data.status || "in_progress");
      const lastMsg = updated[updated.length - 1];
      if (lastMsg?.role === "assistant") {
        speakText(lastMsg.content);
      }
    } catch (err) {
      alert(getErrorMessage(err, "فشل إرسال الإجابة، يرجى المحاولة ثانية"));
    } finally {
      setLoading(false);
    }
  };

  const startVoiceRecording = async () => {
    if (loading || evaluating || sessionStatus === "completed") return;
    setLiveTranscript("");
    setRecordingSeconds(0);
    audioChunksRef.current = [];
    recordingStartRef.current = Date.now();

    // 1. Start Web Speech API live transcription if supported by browser
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "ar-SA";
        recognition.onresult = (event) => {
          let combined = "";
          for (let i = 0; i < event.results.length; i++) {
            combined += event.results[i][0].transcript + " ";
          }
          setLiveTranscript(combined.trim());
        };
        recognition.start();
        recognitionRef.current = recognition;
      } catch {
        recognitionRef.current = null;
      }
    }

    // 2. Start MediaRecorder for Whisper audio capture
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) {
            audioChunksRef.current.push(ev.data);
          }
        };
        mediaRecorder.start();
        mediaRecorderRef.current = mediaRecorder;
      } catch {
        mediaRecorderRef.current = null;
      }
    }

    setIsRecording(true);
    timerRef.current = setInterval(() => {
      setRecordingSeconds(
        Math.max(1, Math.round((Date.now() - recordingStartRef.current) / 1000))
      );
    }, 500);
  };

  const stopAndSubmitVoiceRecording = async () => {
    if (!isRecording) return;
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const durationSec = Math.max(
      2,
      Math.round((Date.now() - recordingStartRef.current) / 1000)
    );

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    let audioBlob = null;
    if (mediaRecorderRef.current) {
      await new Promise((resolve) => {
        mediaRecorderRef.current.onstop = () => {
          if (audioChunksRef.current.length > 0) {
            audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          }
          mediaRecorderRef.current.stream
            ?.getTracks()
            .forEach((t) => t.stop());
          resolve();
        };
        try {
          mediaRecorderRef.current.stop();
        } catch {
          resolve();
        }
      });
      mediaRecorderRef.current = null;
    }

    const transcriptHint = (liveTranscript || input).trim();
    if (!audioBlob && !transcriptHint) {
      alert(
        "لم يتم التقاط صوت واضح. يرجى التأكد من تفعيل الميكروفون أو التحدث بوضوح."
      );
      return;
    }

    setLoading(true);
    try {
      const res = await sendVoiceInterviewAnswer(
        sessionId,
        audioBlob,
        durationSec,
        transcriptHint
      );
      const updated = res.data.messages || [];
      setMessages(updated);
      setSessionStatus(res.data.status || "in_progress");
      if (res.data.voice_feedback) {
        setLatestVoiceFeedback(res.data.voice_feedback);
      }
      setLiveTranscript("");
      setInput("");
      const lastMsg = updated[updated.length - 1];
      if (lastMsg?.role === "assistant") {
        speakText(lastMsg.content);
      }
    } catch (err) {
      alert(
        getErrorMessage(
          err,
          "تعذر معالجة الإجابة الصوتية، يرجى المحاولة مرة أخرى"
        )
      );
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
              استوديو المقابلات التقنية والصوتية الذكي
            </h1>
            {sessionStatus === "completed" ? (
              <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-0.5 text-xs font-extrabold text-emerald-700">
                ✓ مكتملة ومقيّمة
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200 px-3 py-0.5 text-xs font-extrabold text-indigo-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>جلسة مباشرة (نص + صوت AI)</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            الدور الوظيفي المستهدف:{" "}
            <span className="font-extrabold text-indigo-700">{jobTitle}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTtsEnabled((v) => !v)}
            className={`rounded-xl border px-3 py-2 text-xs font-extrabold transition ${
              ttsEnabled
                ? "border-indigo-300 bg-indigo-100 text-indigo-800"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
            title="تفعيل أو إيقاف قراءة أسئلة المحاور صوتياً"
          >
            {ttsEnabled ? "🔊 القراءة الصوتية مفعّلة" : "🔇 قراءة الأسئلة صوتياً"}
          </button>

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

      {/* Latest Voice Delivery AI Feedback Banner */}
      {latestVoiceFeedback && (
        <div className="mb-3 rounded-2xl border border-indigo-200/80 bg-gradient-to-l from-indigo-50/90 via-white to-violet-50/80 px-5 py-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎧</span>
              <div>
                <p className="text-xs font-black text-indigo-950">
                  تحليل الذكاء الاصطناعي للأداء الصوتي (Whisper & Vocal AI)
                </p>
                <p className="text-[11px] font-medium text-slate-600">
                  {latestVoiceFeedback.feedback_summary}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-xl bg-white border border-indigo-200 px-2.5 py-1 font-extrabold text-indigo-700">
                وضوح النطق: {latestVoiceFeedback.clarity_score}/10
              </span>
              <span className="rounded-xl bg-white border border-emerald-200 px-2.5 py-1 font-extrabold text-emerald-700">
                السرعة: {latestVoiceFeedback.pace_score}/10 ({latestVoiceFeedback.words_per_minute} كلمة/د)
              </span>
              <span className="rounded-xl bg-white border border-violet-200 px-2.5 py-1 font-extrabold text-violet-700">
                الثقة الصوتية: {latestVoiceFeedback.confidence_score}/10
              </span>
            </div>
          </div>
          {latestVoiceFeedback.tips?.length > 0 && (
            <p className="mt-1.5 text-[11px] font-bold text-indigo-700">
              💡 نصيحة الإلقاء: {latestVoiceFeedback.tips[0]}
            </p>
          )}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden">
        {/* Chat Stream */}
        <div className="flex-1 bg-white/85 backdrop-blur-xl p-5 rounded-3xl border border-slate-200/80 shadow-sm overflow-y-auto flex flex-col gap-4">
          {messages.length === 0 && (
            <div className="text-center text-slate-400 my-auto py-12">
              <span className="text-4xl block mb-3">💬</span>
              <p className="font-bold text-slate-600">
                أرسل رسالة ترحيب أو سجّل إجابتك صوتياً لبدء محاكاة المقابلة التقنية...
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
                <span className="text-[11px] font-extrabold text-slate-400 mb-1 px-1.5 flex items-center gap-1">
                  {isUser ? (
                    <>
                      <span>👤 أنت (المرشح)</span>
                      {msg.voice_feedback && (
                        <span className="rounded-full bg-indigo-100 text-indigo-700 px-2 py-0.2 text-[10px]">
                          🎙️ إجابة صوتية
                        </span>
                      )}
                    </>
                  ) : (
                    "🤖 المُحاور الذكي"
                  )}
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

      {/* Live Voice Recording Banner */}
      {isRecording && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="h-3 w-3 rounded-full bg-rose-600 animate-ping" />
            <span className="font-black text-rose-800">
              جاري التسجيل الصوتي ({recordingSeconds} ثانية)... تحدث بوضوح
            </span>
            {liveTranscript && (
              <span className="text-slate-600 italic truncate max-w-md">
                &ldquo;{liveTranscript}&rdquo;
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={stopAndSubmitVoiceRecording}
            className="rounded-xl bg-rose-600 px-4 py-1.5 text-xs font-extrabold text-white shadow-sm hover:bg-rose-700"
          >
            ⏹️ إيقاف وإرسال الإجابة الصوتية
          </button>
        </div>
      )}

      {/* Input Form */}
      {sessionStatus !== "completed" ? (
        <form onSubmit={sendMessage} className="flex gap-2.5 mt-3">
          <button
            type="button"
            onClick={
              isRecording ? stopAndSubmitVoiceRecording : startVoiceRecording
            }
            disabled={loading || evaluating}
            className={`rounded-2xl px-4 py-3.5 text-xs font-extrabold border transition shrink-0 flex items-center gap-1.5 ${
              isRecording
                ? "border-rose-300 bg-rose-600 text-white animate-pulse"
                : "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
            }`}
            title="الإجابة بالصوت وتحليل النطق والسرعة والثقة الصوتية"
          >
            <span>🎙️</span>
            <span className="hidden sm:inline">
              {isRecording ? "إرسال الصوت" : "إجابة صوتية"}
            </span>
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="اكتب إجابتك التقنية هنا أو اضغط (🎙️ إجابة صوتية) للتحدث مباشرة..."
            className="input-field flex-1 text-sm py-3.5"
            disabled={loading || evaluating || isRecording}
            autoFocus
          />
          <button
            type="submit"
            className="btn-primary whitespace-nowrap px-7"
            disabled={loading || evaluating || isRecording || !input.trim()}
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
