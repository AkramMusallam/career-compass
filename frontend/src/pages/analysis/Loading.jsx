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
  const [errorDetail, setErrorDetail] = useState("");
  const [isQuotaError, setIsQuotaError] = useState(false);
  const [waitAttempt, setWaitAttempt] = useState(0);
  const mountedRef = useRef(true);
  const runIdRef = useRef(0);
  const activeTaskIdRef = useRef(null);
  const messages = stage === "extract" ? EXTRACT_MESSAGES : ANALYZE_MESSAGES;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const runStep = async ({ resumeTaskId = null } = {}) => {
    const myRunId = ++runIdRef.current;
    const isStale = () => !mountedRef.current || myRunId !== runIdRef.current;

    setPhase("processing");
    setErrorDetail("");
    setIsQuotaError(false);

    try {
      if (stage === "extract") {
        if (!fileId) {
          navigate("/analysis/upload", { replace: true });
          return;
        }

        let taskId = resumeTaskId;
        let finalResult = null;

        if (!taskId) {
          try {
            const asyncRes = await startAsyncCVExtraction(fileId);
            if (isStale()) return;
            taskId = asyncRes.data?.task_id || null;
            activeTaskIdRef.current = taskId;
          } catch (asyncErr) {
            if (isStale()) return;
            if (asyncErr?.response?.status === 403) {
              throw asyncErr;
            }
            const res = await extractCVData(fileId);
            if (isStale()) return;
            finalResult = res.data;
          }
        }

        if (taskId && !finalResult) {
          for (let attempt = 0; attempt < 25; attempt++) {
            if (isStale()) return;
            const statusRes = await getCVTaskStatus(taskId);
            if (isStale()) return;
            if (statusRes.data.status === "completed" && statusRes.data.result) {
              finalResult = statusRes.data.result;
              break;
            }
            if (statusRes.data.status === "failed") {
              const taskError = new Error(
                statusRes.data.error || "فشل تحليل السيرة الذاتية"
              );
              taskError.isTaskFailure = true;
              throw taskError;
            }
            await sleep(1200);
          }

          if (isStale()) return;
          if (!finalResult) {
            throw new Error("انتهى وقت استخراج السيرة الذاتية، حاول مرة أخرى");
          }
        }

        if (isStale() || !finalResult) return;
        activeTaskIdRef.current = null;
        setExtractionId(finalResult.extraction_id);
        setExtractedData(finalResult);
        navigate("/analysis/review", { replace: true });
      } else {
        if (!extractionId || !assessmentId) {
          navigate("/analysis/upload", { replace: true });
          return;
        }
        const res = await runAnalysis(extractionId, assessmentId);
        if (isStale()) return;
        setLatestAnalysis(res.data);
        navigate(`/results/${res.data.analysis_id}`, {
          replace: true,
          state: { analysis: res.data, justCreated: true },
        });
      }
    } catch (error) {
      if (isStale()) return;
      activeTaskIdRef.current = null;
      setPhase("error");
      setErrorDetail(
        error?.isTaskFailure
          ? error.message
          : getErrorMessage(error, "حدث خطأ أثناء المعالجة")
      );
      setIsQuotaError(error?.response?.status === 403);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    runStep();
    return () => {
      mountedRef.current = false;
      runIdRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const rotateTimer = setInterval(() => {
      setMessageIndex((i) => (i + 1) % messages.length);
    }, 2500);
    const timeoutTimer = setTimeout(() => {
      setPhase((p) => {
        if (p === "processing") {
          runIdRef.current += 1;
          return "timeout";
        }
        return p;
      });
    }, TIMEOUT_MS);
    return () => {
      clearInterval(rotateTimer);
      clearTimeout(timeoutTimer);
    };
  }, [messages.length, waitAttempt]);

  const handleRetry = () => {
    activeTaskIdRef.current = null;
    setWaitAttempt((n) => n + 1);
    runStep();
  };

  const handleContinueWaiting = () => {
    setWaitAttempt((n) => n + 1);
    runStep({ resumeTaskId: activeTaskIdRef.current });
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
              onClick={handleContinueWaiting}
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
        <div className="card max-w-md space-y-4">
          <p className="text-sm sm:text-base font-bold text-danger leading-relaxed">
            {errorDetail || "حدث خطأ أثناء المعالجة"}
          </p>
          {isQuotaError && (
            <p className="text-xs font-medium text-slate-600 leading-relaxed">
              لقد وصلت إلى الحد الأقصى المسموح به للتحليلات في باقتك الحالية.
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-3">
            <button className="btn-primary" onClick={() => navigate("/dashboard")}>
              العودة للوحة التحكم
            </button>
            {!isQuotaError && (
              <button className="btn-outline" onClick={handleRetry}>
                إعادة المحاولة
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
