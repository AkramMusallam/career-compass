import axios from "axios";

// عنوان الـ API: يدعم VITE_API_BASE_URL مع إزالة أي شرطة مائلة لاحقة (trailing slash) تلقائياً
const rawBaseURL = import.meta.env.VITE_API_BASE_URL || "https://scarce-drove-amendable.ngrok-free.dev";
const baseURL = rawBaseURL.replace(/\/+$/, "");

const apiClient = axios.create({
  baseURL,
  timeout: 30000,
  headers: {
    "ngrok-skip-browser-warning": "69420",
  },
});

apiClient.interceptors.request.use((config) => {
  // تجاوز شاشة التحذير في ngrok المجاني لكل الطلبات
  config.headers["ngrok-skip-browser-warning"] = "69420";
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export function getErrorMessage(error, fallback = "حدث خطأ غير متوقع، حاول مرة أخرى") {
  if (error?.response?.data?.detail) {
    return error.response.data.detail;
  }
  if (error?.message === "Network Error") {
    return "تعذر الاتصال بالخادم، حاول مرة أخرى";
  }
  return fallback;
}

export default apiClient;
