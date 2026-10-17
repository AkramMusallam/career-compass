import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getErrorMessage } from "../../api/client";
import { extractManualData, uploadCV } from "../../api/endpoints";
import Stepper from "../../components/ui/Stepper";
import { useAnalysisFlow } from "../../context/AnalysisContext";

const MAX_SIZE_MB = 5;

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} كيلوبايت`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} ميجابايت`;
}

export default function UploadCV() {
  const navigate = useNavigate();
  const { setFileId, setExtractionId, setExtractedData, resetAnalysisFlow } = useAnalysisFlow();
  const inputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState("idle"); // idle | uploading | manual-loading | error

  const validateAndSetFile = (candidate) => {
    if (!candidate) return;
    const isPdf = candidate.type === "application/pdf" || candidate.name.toLowerCase().endsWith(".pdf");
    const isWithinSize = candidate.size <= MAX_SIZE_MB * 1024 * 1024;

    if (!isPdf || !isWithinSize) {
      setValidationError(`يُسمح فقط بملفات PDF بحجم أقصى ${MAX_SIZE_MB} ميجابايت`);
      setFile(null);
      return;
    }
    setValidationError("");
    setFile(candidate);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    validateAndSetFile(e.dataTransfer.files?.[0]);
  };

  const handleUploadAndContinue = async () => {
    if (!file) return;
    setStatus("uploading");
    setUploadProgress(0);
    try {
      const uploadRes = await uploadCV(file, (progressEvent) => {
        const percent = Math.round((progressEvent.loaded * 100) / (progressEvent.total || file.size));
        setUploadProgress(percent);
      });
      resetAnalysisFlow();
      setFileId(uploadRes.data.file_id);
      navigate("/analysis/loading", { state: { stage: "extract" } });
    } catch (error) {
      setStatus("error");
      setValidationError(getErrorMessage(error, "فشل رفع الملف، حاول مرة أخرى"));
    }
  };

  const handleManualEntry = async () => {
    setStatus("manual-loading");
    setValidationError("");
    try {
      const manualRes = await extractManualData({});
      resetAnalysisFlow();
      setExtractionId(manualRes.data.extraction_id);
      setExtractedData(manualRes.data);
      navigate("/analysis/review");
    } catch (error) {
      setStatus("idle");
      setValidationError(getErrorMessage(error, "تعذر بدء الإدخال اليدوي، حاول مرة أخرى"));
    }
  };

  return (
    <div className="mx-auto max-w-3xl animate-fade-in-up">
      <Stepper currentStep="upload" />

      <div className="card p-8 sm:p-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200/80 px-3 py-1 text-xs font-extrabold text-indigo-700">
              <span>🤖</span>
              <span>تحليل ذكي مدعوم بالذكاء الاصطناعي</span>
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
              رفع السيرة الذاتية
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              ارفع ملف سيرتك الذاتية بصيغة PDF ليقوم محركنا باستخراج مهاراتك، خبراتك، ومشاريعك تلقائياً
            </p>
          </div>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !file && inputRef.current?.click()}
          className={`group relative flex flex-col items-center justify-center gap-3.5 rounded-3xl border-2 border-dashed p-10 sm:p-12 text-center transition-all duration-300 ${
            isDragging
              ? "border-primary-500 bg-primary-50/70 scale-[1.01] shadow-lg shadow-primary-500/10"
              : file
              ? "border-emerald-300 bg-emerald-50/30"
              : "cursor-pointer border-slate-300/90 bg-slate-50/70 hover:border-primary-400 hover:bg-primary-50/30"
          }`}
        >
          {!file ? (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-3xl text-white shadow-lg shadow-indigo-500/25 group-hover:scale-110 transition-transform">
                📄
              </div>
              <div>
                <p className="text-base font-black text-slate-800">
                  اسحب وأفلت ملف السيرة الذاتية (PDF) هنا
                </p>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  أو اضغط لاختيار ملف من جهازك — الحد الأقصى {MAX_SIZE_MB} ميجابايت
                </p>
              </div>
              <button
                type="button"
                className="btn-outline mt-1 !px-5 !py-2.5 !text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  inputRef.current?.click();
                }}
              >
                📂 استعراض الملفات
              </button>
              <input
                ref={inputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => validateAndSetFile(e.target.files?.[0])}
              />
              <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-indigo-200/80 bg-white/90 py-1.5 px-4 text-xs font-bold text-indigo-700 shadow-sm">
                <span>💼</span>
                <span>
                  يدعم استيراد ملفات PDF المُصدَّرة مباشرة من <b>LinkedIn</b> (Save to PDF)
                </span>
              </div>
            </>
          ) : (
            <div className="flex w-full items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-2xl text-emerald-700">
                  📎
                </div>
                <div className="text-right">
                  <p className="font-black text-slate-900">{file.name}</p>
                  <p className="text-xs font-bold text-emerald-600">
                    {formatBytes(file.size)} • جاهز للتحليل الذكي
                  </p>
                </div>
              </div>
              {status !== "uploading" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-danger transition-colors"
                  aria-label="إزالة الملف"
                >
                  ✕ إزالة
                </button>
              )}
            </div>
          )}
        </div>

        {validationError && (
          <div className="alert-banner-error mt-4" role="alert">
            <span>⚠️</span>
            <span>{validationError}</span>
          </div>
        )}

        {status === "uploading" && (
          <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
            <div className="mb-1.5 flex items-center justify-between text-xs font-extrabold text-indigo-700">
              <span>جاري رفع وتحليل الملف...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-indigo-100">
              <div
                className="h-full rounded-full bg-gradient-to-l from-indigo-600 to-violet-600 transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleUploadAndContinue}
          disabled={!file || status === "uploading" || status === "manual-loading"}
          className="btn-primary mt-6 w-full py-4 text-base"
        >
          {status === "uploading" ? "جاري الرفع والتحليل..." : "🚀 رفع السيرة الذاتية ومتابعة التحليل"}
        </button>

        <div className="my-6 flex items-center gap-3 text-xs font-bold text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          <span>أو البدء بدون ملف PDF</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <button
          type="button"
          onClick={handleManualEntry}
          disabled={status === "uploading" || status === "manual-loading"}
          className="btn-outline w-full py-3.5"
        >
          {status === "manual-loading" ? "جاري التحضير..." : "✍️ إدخال المهارات والخبرات يدوياً بدون ملف"}
        </button>
        <p className="mt-2.5 text-center text-xs font-medium text-slate-400">
          لا تملك سيرة ذاتية جاهزة؟ يمكنك إدخال مهاراتك ومشاريعك يدوياً مباشرة في الخطوة التالية
        </p>
      </div>
    </div>
  );
}
