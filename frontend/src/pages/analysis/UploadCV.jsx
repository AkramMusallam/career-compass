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

  // Batch 5.1 (F5.1) — خيار "إدخال يدوي" بديل عن رفع ملف PDF: يُنشئ سجل استخراج فارغ فوراً
  // عبر /extract/manual (بدون أي ملف)، ثم يُوجَّه المستخدم مباشرة لنفس صفحة مراجعة البيانات
  // المستخدمة أصلاً لمسار رفع الملف (ReviewExtractedData.jsx)، دون أي مكوّن جديد مكرَّر —
  // تلك الصفحة تتعامل أصلاً بشكل سليم مع حالة عدم وجود أي بيانات مستخرجة مسبقاً.
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
    <div className="mx-auto max-w-2xl">
      <Stepper currentStep="upload" />

      <div className="card">
        <h1 className="mb-1 text-xl font-black text-slate-800">رفع السيرة الذاتية</h1>
        <p className="mb-6 text-sm text-slate-500">
          ارفع ملف سيرتك الذاتية بصيغة PDF ليقوم محركنا باستخراج مهاراتك ومشاريعك تلقائياً
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition ${
            isDragging ? "border-primary bg-primary-50" : "border-slate-300 bg-slate-50"
          }`}
        >
          {!file ? (
            <>
              <span className="text-4xl" aria-hidden="true">
                📄
              </span>
              <p className="font-bold text-slate-700">اسحب ملف PDF هنا أو اضغط للاختيار</p>
              <button type="button" className="btn-outline" onClick={() => inputRef.current?.click()}>
                اختيار ملف
              </button>
              <input
                ref={inputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => validateAndSetFile(e.target.files?.[0])}
              />
              <p className="text-xs text-slate-400">الحد الأقصى لحجم الملف: {MAX_SIZE_MB} ميجابايت. صيغة PDF فقط.</p>
              <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 py-1 px-3 rounded-full border border-blue-200 font-medium">
                <span>💼</span>
                <span>يدعم استيراد ملفات PDF المُصدَّرة من <b>LinkedIn</b> (Save to PDF)</span>
              </div>
            </>
          ) : (
            <div className="flex w-full items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="text-2xl" aria-hidden="true">
                  📎
                </span>
                <div className="text-right">
                  <p className="font-bold text-slate-800">{file.name}</p>
                  <p className="text-xs text-slate-400">{formatBytes(file.size)}</p>
                </div>
              </div>
              {status !== "uploading" && (
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-danger"
                  aria-label="إزالة الملف"
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>

        {validationError && (
          <p className="error-text mt-3" role="alert">
            {validationError}
          </p>
        )}

        {status === "uploading" && (
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="mt-1 text-xs font-bold text-slate-500">جاري الرفع... {uploadProgress}%</p>
          </div>
        )}

        <button
          type="button"
          onClick={handleUploadAndContinue}
          disabled={!file || status === "uploading" || status === "manual-loading"}
          className="btn-primary mt-6 w-full"
        >
          {status === "uploading" ? "جاري الرفع..." : "رفع ومتابعة"}
        </button>

        <div className="my-4 flex items-center gap-3 text-xs font-bold text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          أو
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <button
          type="button"
          onClick={handleManualEntry}
          disabled={status === "uploading" || status === "manual-loading"}
          className="btn-outline w-full"
        >
          {status === "manual-loading" ? "جاري التحضير..." : "✍️ إدخال يدوي بدون ملف"}
        </button>
        <p className="mt-2 text-center text-xs text-slate-400">
          لا تملك سيرة ذاتية جاهزة؟ أدخل مهاراتك ومشاريعك يدوياً في الخطوة التالية
        </p>
      </div>
    </div>
  );
}
