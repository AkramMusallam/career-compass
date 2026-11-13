import axios from "axios";

// عنوان الـ API: يدعم VITE_API_BASE_URL مع استخدام "/api" افتراضياً (عبر Nginx في الإنتاج أو Vite proxy محلياً)
const rawBaseURL = import.meta.env.VITE_API_BASE_URL || "/api";
const baseURL = rawBaseURL.replace(/\/+$/, "");

function isNgrokHost(url) {
  try {
    const parsed = new URL(url, "http://localhost");
    return parsed.hostname.toLowerCase().includes("ngrok");
  } catch {
    return false;
  }
}

const useNgrokHeader = isNgrokHost(baseURL);

const apiClient = axios.create({
  baseURL,
  timeout: 180000,
});

apiClient.interceptors.request.use((config) => {
  // إرسال ترويسة تجاوز تحذير ngrok فقط عندما يستهدف الطلب مضيف ngrok
  if (useNgrokHeader) {
    config.headers["ngrok-skip-browser-warning"] = "69420";
  }
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const companyId = localStorage.getItem("active_company_id");
  if (companyId && config.url?.startsWith("/recruiter/")) config.headers["X-Company-Id"] = companyId;
  return config;
});

const PUBLIC_AUTH_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/shared",
];

function isPublicOrAuthPath(pathname) {
  return PUBLIC_AUTH_PATHS.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.data instanceof Blob) {
      const blobType = error.response.data.type || "";
      if (!blobType || blobType.includes("json") || blobType.includes("text")) {
        try {
          const text = await error.response.data.text();
          error.response.data = JSON.parse(text);
        } catch {
          // Retain original Blob if payload is not JSON
        }
      }
    }

    if (error.response && error.response.status === 401) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user");
      localStorage.removeItem("active_company_id");
      if (!isPublicOrAuthPath(window.location.pathname)) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export function getErrorMessage(error, fallback = "حدث خطأ غير متوقع، حاول مرة أخرى") {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }
  if (Array.isArray(detail) && detail.length > 0) {
    const joined = detail
      .map((item) => (typeof item === "string" ? item : item?.msg))
      .filter(Boolean)
      .join("، ");
    if (joined) return joined;
  }
  if (error?.message === "Network Error") {
    return "تعذر الاتصال بالخادم، حاول مرة أخرى";
  }
  return fallback;
}

export default apiClient;
