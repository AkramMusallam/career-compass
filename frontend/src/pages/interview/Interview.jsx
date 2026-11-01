import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Square,
  Send,
  ArrowRight,
  Sparkles,
  Headphones,
  Lightbulb,
  Check,
  CheckCircle2,
  AlertTriangle,
  Target,
  Award,
  Bot,
  User,
  Activity,
  FileText,
  Clock,
  Radio,
  RefreshCw,
} from "lucide-react";
import {
  chatInterview,
  getInterviewSession,
  evaluateInterview,
  sendVoiceInterviewAnswer,
} from "../../api/endpoints";
import { getErrorMessage } from "../../api/client";
import { useToast } from "../../context/ToastContext";

export default function Interview() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [jobTitle, setJobTitle] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [sessionStatus, setSessionStatus] = useState("in_progress"); // in_progress | completed
  const [initialLoading, setInitialLoading] = useState(true);

  // Phase 2: Voice & Audio Mock Interviews state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [latestVoiceFeedback, setLatestVoiceFeedback] = useState(null);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [mobileTab, setMobileTab] = useState("chat"); // "chat" | "report" on small screens

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
      showToast(getErrorMessage(err, "فشل إرسال الإجابة، يرجى المحاولة ثانية"), "error");
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
      showToast(
        "لم يتم التقاط صوت واضح. يرجى التأكد من تفعيل الميكروفون أو التحدث بوضوح.",
        "error"
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
      showToast(
        getErrorMessage(
          err,
          "تعذر معالجة الإجابة الصوتية، يرجى المحاولة مرة أخرى"
        ),
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFinishAndEvaluate = async () => {
    const userAnswers = messages.filter((m) => m.role === "user");
    if (userAnswers.length === 0) {
      showToast("يرجى الإجابة على سؤال واحد على الأقل قبل طلب التقييم النهائي.", "error");
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
      setMobileTab("report");
    } catch (err) {
      showToast(getErrorMessage(err, "تعذر تقييم المقابلة، يرجى المحاولة ثانية"), "error");
    } finally {
      setEvaluating(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent" />
        <p className="mt-4 text-sm font-bold text-slate-600">
          جاري إعداد استوديو المقابلة الذكية...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto flex flex-col h-[calc(100vh-8.5rem)] sm:h-[calc(100vh-9.5rem)] min-h-[580px] animate-fade-in pb-16 sm:pb-0">
      {/* Studio Header Bar */}
      <div className="mb-3.5 card p-3 sm:p-4 border-slate-200/90 shadow-sm shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center shrink-0 border border-primary-100">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  استوديو المقابلات التقنية والصوتية
                </h1>
                {sessionStatus === "completed" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                    <CheckCircle2 className="w-3 h-3" />
                    مكتملة ومقيّمة
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 border border-primary-200 px-2.5 py-0.5 text-[11px] font-bold text-primary-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    جلسة مباشرة
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                الدور المستهدف:{" "}
                <span className="font-bold text-primary-700">{jobTitle}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
            <button
              type="button"
              onClick={() => setTtsEnabled((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                ttsEnabled
                  ? "border-primary-300 bg-primary-50 text-primary-800"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
              title="تفعيل أو إيقاف قراءة أسئلة المحاور صوتياً"
            >
              {ttsEnabled ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-primary-600" />
                  <span className="hidden sm:inline">صوت المحاور: مفعل</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden sm:inline">صوت المحاور: معطل</span>
                </>
              )}
            </button>

            {sessionStatus !== "completed" && (
              <button
                onClick={handleFinishAndEvaluate}
                disabled={evaluating || loading}
                className="btn-secondary !py-1.5 !px-3.5 !text-xs inline-flex items-center gap-1.5"
              >
                {evaluating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري التقييم...</span>
                  </>
                ) : (
                  <>
                    <Award className="w-3.5 h-3.5" />
                    <span>إنهاء وإصدار التقييم</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={() => navigate(-1)}
              className="btn-outline !py-1.5 !px-3 !text-xs inline-flex items-center gap-1"
            >
              <span>العودة</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Voice Delivery Feedback Bar */}
      {latestVoiceFeedback && (
        <div className="mb-3 rounded-2xl border border-primary-200/80 bg-gradient-to-l from-primary-50/70 via-white to-teal-50/50 p-3 sm:p-3.5 shadow-xs shrink-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
            <div className="flex items-start sm:items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center shrink-0">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">
                  تحليل الذكاء الاصطناعي للأداء الصوتي (Whisper & Vocal AI)
                </p>
                <p className="text-[11px] text-slate-600">
                  {latestVoiceFeedback.feedback_summary}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="rounded-lg bg-white border border-slate-200 px-2 py-0.5 font-bold text-slate-700">
                وضوح النطق: {latestVoiceFeedback.clarity_score}/10
              </span>
              <span className="rounded-lg bg-white border border-teal-200 px-2 py-0.5 font-bold text-teal-700">
                السرعة: {latestVoiceFeedback.pace_score}/10 ({latestVoiceFeedback.words_per_minute} ك/د)
              </span>
              <span className="rounded-lg bg-white border border-primary-200 px-2 py-0.5 font-bold text-primary-700">
                الثقة الصوتية: {latestVoiceFeedback.confidence_score}/10
              </span>
            </div>
          </div>
          {latestVoiceFeedback.tips?.length > 0 && (
            <div className="mt-2 pt-2 border-t border-primary-100 flex items-center gap-1.5 text-[11px] font-semibold text-primary-800">
              <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>نصيحة الإلقاء: {latestVoiceFeedback.tips[0]}</span>
            </div>
          )}
        </div>
      )}

      {/* Mobile Tabs Switcher if Evaluation Exists */}
      {evaluation && (
        <div className="flex sm:hidden items-center gap-2 mb-2 shrink-0">
          <button
            type="button"
            onClick={() => setMobileTab("chat")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-xl border transition ${
              mobileTab === "chat"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-600 border-slate-200"
            }`}
          >
            محادثة المقابلة
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("report")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-xl border transition ${
              mobileTab === "report"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-600 border-slate-200"
            }`}
          >
            تقرير التقييم النهائي
          </button>
        </div>
      )}

      {/* Main Studio Area */}
      <div className="flex-1 flex flex-col md:flex-row gap-3 overflow-hidden min-h-0">
        {/* Chat Stream Column */}
        <div
          className={`flex-1 bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-xs overflow-y-auto flex flex-col gap-3.5 ${
            evaluation && mobileTab !== "chat" ? "hidden md:flex" : "flex"
          }`}
        >
          {messages.length === 0 && (
            <div className="text-center text-slate-400 my-auto py-12 px-4">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 mb-3">
                <Bot className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-700">
                ابدأ محاكاة المقابلة التقنية
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                أرسل رسالة ترحيبية أو تحدث صوتياً للبدء في طرح الأسئلة الفنية المناسبة لشاغر {jobTitle}.
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
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 mb-1 px-1">
                  {isUser ? (
                    <>
                      <span>أنت (المرشح)</span>
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      {msg.voice_feedback && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 text-primary-700 px-2 py-0.5 text-[10px] font-bold border border-primary-200">
                          <Mic className="w-2.5 h-2.5" />
                          إجابة صوتية
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <Bot className="w-3.5 h-3.5 text-primary-600" />
                      <span>المُحاور الذكي</span>
                    </>
                  )}
                </div>

                <div
                  className={`p-3.5 sm:p-4 rounded-2xl max-w-[90%] sm:max-w-[80%] text-xs sm:text-sm leading-relaxed whitespace-pre-line shadow-2xs ${
                    isUser
                      ? "bg-slate-900 text-white rounded-br-xs"
                      : "bg-slate-50 text-slate-800 border border-slate-200/90 rounded-bl-xs"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex flex-col items-start">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 mb-1 px-1">
                <Bot className="w-3.5 h-3.5 text-primary-600" />
                <span>المُحاور الذكي</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-500 rounded-bl-xs text-xs font-semibold flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary-600 animate-ping" />
                <span>المُحاور يحلل إجابتك ويكتب السؤال التالي...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Evaluation Report Column (if completed) */}
        {evaluation && (
          <div
            className={`w-full md:w-96 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 overflow-y-auto flex flex-col gap-4 shadow-xs ${
              mobileTab !== "report" ? "hidden md:flex" : "flex"
            }`}
          >
            {/* Header Score Card */}
            <div className="text-center pb-4 border-b border-slate-100">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                النتيجة الإجمالية للمقابلة
              </span>
              <div className="inline-flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-black text-slate-900">
                  {evaluation.final_score}
                </span>
                <span className="text-slate-400 font-bold text-base">/ 10</span>
              </div>
              <div className="mt-3 flex justify-center gap-2 text-xs">
                <span className="bg-primary-50 text-primary-800 border border-primary-100 px-3 py-1 rounded-xl font-bold">
                  التقني: {evaluation.technical_score}/10
                </span>
                <span className="bg-teal-50 text-teal-800 border border-teal-100 px-3 py-1 rounded-xl font-bold">
                  التواصل: {evaluation.communication_score}/10
                </span>
              </div>
            </div>

            {/* Overall Feedback */}
            <div>
              <h3 className="text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                <span>ملخص التقييم العام</span>
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                {evaluation.overall_feedback}
              </p>
            </div>

            {/* Strengths */}
            {evaluation.strengths && evaluation.strengths.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-emerald-700 mb-1.5 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>نقاط القوة المتميزة</span>
                </h3>
                <ul className="space-y-1.5 text-xs text-slate-600">
                  {evaluation.strengths.map((s, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Technical Gaps / Improvements */}
            {evaluation.technical_mistakes && evaluation.technical_mistakes.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-amber-700 mb-1.5 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>نقاط التحسين التقني</span>
                </h3>
                <ul className="space-y-1.5 text-xs text-slate-600">
                  {evaluation.technical_mistakes.map((m, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                      <span>{m}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Model Answers */}
            {evaluation.model_answers && evaluation.model_answers.length > 0 && (
              <div className="pt-3 border-t border-slate-100">
                <h3 className="text-xs font-bold text-primary-700 mb-2 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-primary-600" />
                  <span>الإجابات النموذجية المقترحة</span>
                </h3>
                <div className="space-y-2">
                  {evaluation.model_answers.map((ma, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-xs"
                    >
                      <p className="font-bold text-slate-800 mb-1">
                        السؤال: {ma.question}
                      </p>
                      <p className="text-slate-600 leading-relaxed text-[11px]">
                        نموذج الإجابة: {ma.model_answer}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Live Voice Recording Active Floating Bar */}
      {isRecording && (
        <div className="mt-2.5 rounded-2xl border border-rose-200 bg-rose-50/95 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0 animate-fade-in shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="h-3 w-3 rounded-full bg-rose-600 animate-ping" />
            <span className="text-xs font-bold text-rose-800">
              جاري التسجيل الصوتي ({recordingSeconds} ث)... تحدث بوضوح
            </span>
            {liveTranscript && (
              <span className="text-[11px] text-slate-600 italic truncate max-w-xs sm:max-w-md">
                &ldquo;{liveTranscript}&rdquo;
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={stopAndSubmitVoiceRecording}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-rose-700 transition"
          >
            <Square className="w-3.5 h-3.5" />
            <span>إيقاف وإرسال الإجابة الصوتية</span>
          </button>
        </div>
      )}

      {/* Input Action Bar */}
      {sessionStatus !== "completed" ? (
        <form onSubmit={sendMessage} className="flex items-center gap-2 mt-2.5 shrink-0">
          <button
            type="button"
            onClick={
              isRecording ? stopAndSubmitVoiceRecording : startVoiceRecording
            }
            disabled={loading || evaluating}
            className={`rounded-xl px-3.5 py-3 text-xs font-bold border transition shrink-0 inline-flex items-center gap-1.5 ${
              isRecording
                ? "border-rose-300 bg-rose-600 text-white animate-pulse"
                : "border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100"
            }`}
            title="الإجابة بالصوت وتحليل النطق والسرعة والثقة الصوتية"
          >
            {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span className="hidden sm:inline">
              {isRecording ? "إرسال الصوت" : "إجابة صوتية"}
            </span>
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="اكتب إجابتك هنا أو استخدم التسجيل الصوتي..."
            className="input-field flex-1 text-xs sm:text-sm py-3"
            disabled={loading || evaluating || isRecording}
            autoFocus
          />

          <button
            type="submit"
            className="btn-primary !py-3 !px-4 sm:!px-6 whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 text-xs sm:text-sm"
            disabled={loading || evaluating || isRecording || !input.trim()}
          >
            <span>إرسال</span>
            <Send className="w-3.5 h-3.5 rotate-180" />
          </button>
        </form>
      ) : (
        <div className="mt-2.5 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-center text-xs font-bold text-emerald-800 shrink-0">
          تم إنهاء وتقييم هذه المقابلة بنجاح. يمكنك مراجعة تقرير التقييم المفصل أو العودة للوحة التحكم.
        </div>
      )}
    </div>
  );
}
