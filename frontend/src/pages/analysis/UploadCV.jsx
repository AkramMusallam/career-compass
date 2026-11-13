import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  FileUp,
  FolderOpen,
  Briefcase,
  FileCheck2,
  X,
  AlertCircle,
  PenLine,
  ArrowLeft,
} from "lucide-react";

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
  const { setFileId, setExtractionId, setExtractedData, resetAnalysisFlow } =
    useAnalysisFlow();
  const inputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState("idle");

  const validateAndSetFile = (candidate) => {
    if (!candidate) return;
    const isPdf =
      candidate.type === "application/pdf" ||
      candidate.name.toLowerCase().endsWith(".pdf");
    const isWithinSize = candidate.size <= MAX_SIZE_MB * 1024 * 1024;

    if (!isPdf || !isWithinSize) {
      setValidationError(
        `يُسمح فقط بملفات PDF بحجم أقصى ${MAX_SIZE_MB} ميجابايت`
      );
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
        const percent = Math.round(
          (progressEvent.loaded * 100) / (progressEvent.total || file.size)
        );
        setUploadProgress(percent);
      });
      resetAnalysisFlow();
      setFileId(uploadRes.data.file_id);
      navigate("/analysis/loading", { state: { stage: "extract" } });
    } catch (error) {
      setStatus("error");
      setValidationError(
        getErrorMessage(error, "فشل رفع الملف، حاول مرة أخرى")
      );
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
      setValidationError(
        getErrorMessage(error, "تعذر بدء الإدخال اليدوي، حاول مرة أخرى")
      );
    }
  };

  return (
    <div className="mx-auto max-w-3xl animate-fade-in">
      <Stepper currentStep="upload" />

      <div className="card">
        <div className="mb-5">
          <span className="mb-1.5 inline-flex items-center gap-1.5 rounded-lg bg-primary-50 border border-primary-100 px-2.5 py-0.5 text-[11px] font-bold text-primary-700">
            <Sparkles size={13} />
            <span>تحليل ذكي مدعوم بالذكاء الاصطناعي</span>
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">
            رفع السيرة الذاتية
          </h1>
          <p className="mt-1 text-xs sm:text-sm font-medium text-slate-500">
            ارفع ملف سيرتك الذاتية بصيغة PDF ليقوم محركنا باستخراج مهاراتك، خبراتك، ومشاريعك تلقائياً
          </p>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !file && inputRef.current?.click()}
          className={`group relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-6 sm:p-10 text-center transition-colors duration-200 ${
            isDragging
              ? "border-primary-500 bg-primary-50/70"
              : file
              ? "border-secondary-300 bg-secondary-50/30"
              : "cursor-pointer border-slate-300 bg-slate-50/70 hover:border-primary-400 hover:bg-primary-50/20"
          }`}
        >
          {!file ? (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-secondary-400 shadow-sm">
                <FileUp size={26} />
              </div>
              <div>
                <p className="text-sm sm:text-base font-black text-slate-800">
                  اسحب وأفلت ملف السيرة الذاتية (PDF) هنا
                </p>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  أو اضغط لاختيار ملف من جهازك — الحد الأقصى {MAX_SIZE_MB} ميجابايت
                </p>
              </div>
              <button
                type="button"
                className="btn-outline mt-1 !px-4 !py-2 !text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  inputRef.current?.click();
                }}
              >
                <FolderOpen size={15} />
                <span>استعراض الملفات</span>
              </button>
              <input
                ref={inputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => validateAndSetFile(e.target.files?.[0])}
              />
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white py-1.5 px-3 text-[11px] font-bold text-slate-600">
                <Briefcase size={13} className="text-primary-600 shrink-0" />
                <span>
                  يدعم استيراد ملفات PDF المُصدَّرة مباشرة من <b>LinkedIn</b> (Save to PDF)
                </span>
              </div>
            </>
          ) : (
            <div className="flex w-full flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-secondary-200 bg-white p-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary-50 text-secondary-600 border border-secondary-100">
                  <FileCheck2 size={22} />
                </div>
                <div className="text-right min-w-0">
                  <p className="font-bold text-sm text-slate-900 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs font-bold text-secondary-600">
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
                  className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-danger transition-colors"
                  aria-label="إزالة الملف"
                >
                  <X size={14} />
                  <span>إزالة</span>
                </button>
              )}
            </div>
          )}
        </div>

        {validationError && (
          <div className="alert-banner-error mt-4" role="alert">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span>{validationError}</span>
          </div>
        )}

        {status === "uploading" && (
          <div className="mt-4 rounded-xl border border-primary-100 bg-primary-50/50 p-4">
            <div className="mb-1.5 flex items-center justify-between text-xs font-extrabold text-primary-700">
              <span>جاري رفع وتحليل الملف...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-primary-100">
              <div
                className="h-full rounded-full bg-primary-600 transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleUploadAndContinue}
          disabled={!file || status === "uploading" || status === "manual-loading"}
          className="btn-primary mt-5 w-full py-3.5 text-sm sm:text-base"
        >
          {status === "uploading" ? (
            "جاري الرفع والتحليل..."
          ) : (
            <>
              <span>رفع السيرة الذاتية ومتابعة التحليل</span>
              <ArrowLeft size={16} />
            </>
          )}
        </button>

        <div className="my-5 flex items-center gap-3 text-xs font-bold text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          <span>أو البدء بدون ملف PDF</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <button
          type="button"
          onClick={handleManualEntry}
          disabled={status === "uploading" || status === "manual-loading"}
          className="btn-outline w-full py-3"
        >
          <PenLine size={16} />
          <span>
            {status === "manual-loading"
              ? "جاري التحضير..."
              : "إدخال المهارات والخبرات يدوياً بدون ملف"}
          </span>
        </button>
        <p className="mt-2 text-center text-xs font-medium text-slate-400">
          لا تملك سيرة ذاتية جاهزة؟ يمكنك إدخال مهاراتك ومشاريعك يدوياً مباشرة في الخطوة التالية
        </p>
      </div>
    </div>
  );
}
