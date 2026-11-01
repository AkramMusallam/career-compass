import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

const ToastContext = createContext(null);

let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const showToast = useCallback(
    (message, type = "success") => {
      const id = ++idCounter;
      setToasts((prev) => [...prev, { id, message, type }]);
      timers.current[id] = setTimeout(() => dismiss(id), 4000);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-20 lg:bottom-6 left-1/2 z-50 flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4 pointer-events-none">
        {toasts.map((t) => {
          const isError = t.type === "error";
          const isInfo = t.type === "info";
          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto animate-fade-in flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs sm:text-sm font-bold shadow-elevated ${
                isError
                  ? "border-red-200 bg-slate-900 text-red-200"
                  : isInfo
                  ? "border-slate-700 bg-slate-900 text-slate-100"
                  : "border-teal-800 bg-slate-900 text-white"
              }`}
            >
              <div className="flex items-center gap-2.5">
                {isError ? (
                  <AlertCircle size={18} className="shrink-0 text-red-400" />
                ) : isInfo ? (
                  <Info size={18} className="shrink-0 text-primary-400" />
                ) : (
                  <CheckCircle2 size={18} className="shrink-0 text-secondary-400" />
                )}
                <span>{t.message}</span>
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                aria-label="إغلاق"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
