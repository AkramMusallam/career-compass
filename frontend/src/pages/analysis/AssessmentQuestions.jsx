import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ArrowLeft, AlertCircle } from "lucide-react";

import { getErrorMessage } from "../../api/client";
import { getAssessmentQuestions, submitAssessment } from "../../api/endpoints";
import Stepper from "../../components/ui/Stepper";
import Spinner from "../../components/ui/Spinner";
import { useAnalysisFlow } from "../../context/AnalysisContext";

function QuestionInput({ question, value, onChange }) {
  if (question.type === "single_choice") {
    return (
      <div className="space-y-2">
        {question.options.map((option) => (
          <label
            key={option}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 text-xs sm:text-sm transition-colors ${
              value === option
                ? "border-primary-500 bg-primary-50/80 text-primary-900"
                : "border-slate-200 hover:border-slate-300 bg-white"
            }`}
          >
            <input
              type="radio"
              name={question.id}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500"
              checked={value === option}
              onChange={() => onChange(option)}
            />
            <span className="font-bold text-slate-800">{option}</span>
          </label>
        ))}
      </div>
    );
  }

  if (question.type === "multiple_choice") {
    const selected = Array.isArray(value) ? value : [];
    const toggle = (option) => {
      if (selected.includes(option)) {
        onChange(selected.filter((o) => o !== option));
      } else {
        onChange([...selected, option]);
      }
    };
    return (
      <div className="space-y-2">
        {question.options.map((option) => (
          <label
            key={option}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 text-xs sm:text-sm transition-colors ${
              selected.includes(option)
                ? "border-primary-500 bg-primary-50/80 text-primary-900"
                : "border-slate-200 hover:border-slate-300 bg-white"
            }`}
          >
            <input
              type="checkbox"
              className="h-4 w-4 rounded text-primary-600 focus:ring-primary-500"
              checked={selected.includes(option)}
              onChange={() => toggle(option)}
            />
            <span className="font-bold text-slate-800">{option}</span>
          </label>
        ))}
      </div>
    );
  }

  // scale
  const scaleValue = value ?? 3;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={scaleValue}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary-600"
      />
      <div className="mt-2 flex items-center justify-between text-xs font-bold text-slate-500">
        <span>1 - ضعيف</span>
        <span className="rounded-lg bg-primary-600 px-2.5 py-0.5 text-sm font-black text-white">
          {scaleValue}
        </span>
        <span>5 - ممتاز</span>
      </div>
    </div>
  );
}

export default function AssessmentQuestions() {
  const navigate = useNavigate();
  const { setAssessmentId } = useAnalysisFlow();

  const [status, setStatus] = useState("loading");
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showRequiredError, setShowRequiredError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    getAssessmentQuestions()
      .then((res) => {
        if (!mounted) return;
        const qs = res.data.questions || [];
        setQuestions(qs);
        const initialScaleAnswers = {};
        for (const q of qs) {
          if (q.type === "scale") {
            initialScaleAnswers[q.id] = 3;
          }
        }
        setAnswers((prev) => ({ ...initialScaleAnswers, ...prev }));
        setStatus("ready");
      })
      .catch(() => mounted && setStatus("error"));
    return () => {
      mounted = false;
    };
  }, []);

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-2xl">
        <Stepper currentStep="assessment" />
        <div className="card animate-pulse space-y-4">
          <div className="h-4 w-1/4 rounded bg-slate-200" />
          <div className="h-6 w-3/4 rounded bg-slate-200" />
          <div className="h-24 w-full rounded bg-slate-100" />
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="card mx-auto max-w-md text-center">
        <p className="mb-4 font-bold text-slate-700">تعذر تحميل الأسئلة</p>
        <button className="btn-primary" onClick={() => window.location.reload()}>
          إعادة المحاولة
        </button>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;
  const currentAnswer = answers[currentQuestion.id];
  const isAnswered =
    currentQuestion.type === "multiple_choice"
      ? Array.isArray(currentAnswer) && currentAnswer.length > 0
      : currentAnswer !== undefined &&
        currentAnswer !== null &&
        currentAnswer !== "";

  const setAnswer = (value) =>
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));

  const goNext = async () => {
    if (currentQuestion.required && !isAnswered) {
      setShowRequiredError(true);
      return;
    }
    setShowRequiredError(false);

    if (!isLast) {
      setCurrentIndex((i) => i + 1);
      return;
    }

    const firstMissingIndex = questions.findIndex((q) => {
      const a = answers[q.id];
      if (!q.required) return false;
      if (q.type === "multiple_choice")
        return !Array.isArray(a) || a.length === 0;
      return a === undefined || a === null || a === "";
    });
    if (firstMissingIndex !== -1) {
      setCurrentIndex(firstMissingIndex);
      setShowRequiredError(true);
      return;
    }

    setStatus("submitting");
    setErrorMessage("");
    try {
      const payload = Object.entries(answers).map(([question_id, value]) => ({
        question_id,
        value,
      }));
      const res = await submitAssessment(payload);
      setAssessmentId(res.data.assessment_id);
      navigate("/analysis/loading", { state: { stage: "analyze" } });
    } catch (error) {
      setStatus("ready");
      setErrorMessage(getErrorMessage(error, "حدث خطأ أثناء إرسال إجاباتك"));
    }
  };

  const goPrevious = () => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  };

  const skip = () => {
    if (!isLast) setCurrentIndex((i) => i + 1);
  };

  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      <Stepper currentStep="assessment" />

      <div className="card">
        <div className="mb-5">
          <div className="mb-1.5 flex justify-between text-xs font-bold text-slate-500">
            <span>
              السؤال {currentIndex + 1} من {questions.length}
            </span>
            <span>{Math.round(((currentIndex + 1) / questions.length) * 100)}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-primary-600 transition-all"
              style={{
                width: `${((currentIndex + 1) / questions.length) * 100}%`,
              }}
            />
          </div>
        </div>

        <h2 className="mb-4 text-base sm:text-lg font-black text-slate-900">
          {currentQuestion.text}
        </h2>

        <QuestionInput
          question={currentQuestion}
          value={currentAnswer}
          onChange={setAnswer}
        />

        {showRequiredError && (
          <p className="error-text mt-3">هذا السؤال إلزامي</p>
        )}
        {errorMessage && (
          <div className="alert-banner-error mt-3" role="alert">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            className="btn-outline"
            onClick={goPrevious}
            disabled={currentIndex === 0}
          >
            <ArrowRight size={15} />
            <span>السابق</span>
          </button>

          <div className="flex items-center gap-3">
            {!currentQuestion.required && !isLast && (
              <button
                type="button"
                onClick={skip}
                className="text-xs sm:text-sm font-bold text-slate-400 hover:text-slate-600"
              >
                تخطي
              </button>
            )}
            <button
              type="button"
              className="btn-primary"
              onClick={goNext}
              disabled={status === "submitting"}
            >
              {status === "submitting" ? (
                <Spinner />
              ) : (
                <>
                  <span>{isLast ? "إنهاء" : "التالي"}</span>
                  <ArrowLeft size={15} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
