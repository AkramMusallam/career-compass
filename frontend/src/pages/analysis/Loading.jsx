import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { getErrorMessage } from "../../api/client";
import {
  extractCVData,
  getCVTaskStatus,
  runAnalysis,
  startAsyncCVExtraction,
} from "../../api/endpoints";
import CompassLogo from "../../components/layout/CompassLogo";
import { useAnalysisFlow } from "../../context/AnalysisContext";

const EXTRACT_MESSAGES = [
  "جاري قراءة سيرتك الذاتية...",
  "جاري استخراج المهارات والمشاريع...",
  "جاري تنظيم بياناتك...",
];

const ANALYZE_MESSAGES = [
  "جاري تحليل مهاراتك...",
  "جاري مقارنتها بسوق العمل...",
  "جاري بناء توصياتك...",
  "جاري إعداد خطة التعلم الخاصة بك...",
];

const TIMEOUT_MS = 30000;

export default function Loading() {
  const location = useLocation();
  const navigate = useNavigate();
  const stage = location.state?.stage || "extract";
  const {
    fileId,
    setExtractionId,
    setExtractedData,
    extractionId,
    assessmentId,
    setLatestAnalysis,
  } = useAnalysisFlow();

  const [messageIndex, setMessageIndex] = useState(0);
  const [phase, setPhase] = useState("processing");
  const [waitAttempt, setWaitAttempt] = useState(0);
  const startedRef = useRef(false);
  const messages = stage === "extract" ? EXTRACT_MESSAGES : ANALYZE_MESSAGES;

  const runStep = async () => {
    setPhase("processing");
    try {
      if (stage === "extract") {
        if (!fileId) {
          navigate("/analysis/upload", { replace: true });
          return;
        }
        try {
          const asyncRes = await startAsyncCVExtraction(fileId);
          const taskId = asyncRes.data.task_id;
          let finalResult = null;

          for (let attempt = 0; attempt < 25; attempt++) {
            const statusRes = await getCVTaskStatus(taskId);
            if (statusRes.data.status === "completed" && statusRes.data.result) {
              finalResult = statusRes.data.result;
              break;
            }
            if (statusRes.data.status === "failed") {
              throw new Error(statusRes.data.error || "فشل تحليل السيرة الذاتية");
            }
            await new Promise((resolve) => setTimeout(resolve, 1200));
          }

          if (!finalResult) {
            const fallbackRes = await extractCVData(fileId);
            finalResult = fallbackRes.data;
          }

          setExtractionId(finalResult.extraction_id);
          setExtractedData(finalResult);
          navigate("/analysis/review", { replace: true });
        } catch {
          const res = await extractCVData(fileId);
          setExtractionId(res.data.extraction_id);
          setExtractedData(res.data);
          navigate("/analysis/review", { replace: true });
        }
      } else {
        if (!extractionId || !assessmentId) {
          navigate("/analysis/upload", { replace: true });
          return;
        }
        const res = await runAnalysis(extractionId, assessmentId);
        setLatestAnalysis(res.data);
        navigate(`/results/${res.data.analysis_id}`, {
          replace: true,
          state: { analysis: res.data },
        });
      }
    } catch (error) {
      setPhase("error");
      // eslint-disable-next-line no-console
      console.error(getErrorMessage(error));
    }
  };

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    runStep();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const rotateTimer = setInterval(() => {
      setMessageIndex((i) => (i + 1) % messages.length);
    }, 2500);
    const timeoutTimer = setTimeout(() => {
      setPhase((p) => (p === "processing" ? "timeout" : p));
    }, TIMEOUT_MS);
    return () => {
      clearInterval(rotateTimer);
      clearTimeout(timeoutTimer);
    };
  }, [messages.length, waitAttempt]);

  const handleRetry = () => {
    startedRef.current = false;
    runStep();
    startedRef.current = true;
  };

  return (
    <div className="flex min-h-[65vh] flex-col items-center justify-center gap-5 text-center px-4">
      <CompassLogo size={52} spinning={phase === "processing"} showText={false} />

      {phase === "processing" && (
        <div className="space-y-3">
          <p className="text-base sm:text-lg font-bold text-slate-800">
            {messages[messageIndex]}
          </p>
          <div className="h-1.5 w-56 sm:w-64 mx-auto overflow-hidden rounded-full bg-slate-200">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-primary-600" />
          </div>
        </div>
      )}

      {phase === "timeout" && (
        <div className="card max-w-md">
          <p className="mb-4 text-sm sm:text-base font-bold text-slate-700">
            العملية تستغرق وقتاً أطول من المعتاد
          </p>
          <div className="flex justify-center gap-3">
            <button
              className="btn-outline"
              onClick={() => {
                setPhase("processing");
                setWaitAttempt((n) => n + 1);
              }}
            >
              متابعة الانتظار
            </button>
            <button className="btn-primary" onClick={handleRetry}>
              إعادة المحاولة
            </button>
          </div>
        </div>
      )}

      {phase === "error" && (
        <div className="card max-w-md">
          <p className="mb-4 text-sm sm:text-base font-bold text-danger">
            حدث خطأ أثناء المعالجة
          </p>
          <div className="flex justify-center gap-3">
            <button className="btn-outline" onClick={() => navigate("/dashboard")}>
              العودة
            </button>
            <button className="btn-primary" onClick={handleRetry}>
              إعادة المحاولة
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
