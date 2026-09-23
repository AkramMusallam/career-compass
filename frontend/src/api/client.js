import axios from "axios";

// في التطوير المحلي: Vite يوجّه /api إلى الباك إند (انظر vite.config.js).
// في الإنتاج: يمكن ضبط VITE_API_BASE_URL لتوجيه الطلبات مباشرة لعنوان الباك إند المنشور.
const baseURL = import.meta.env.VITE_API_BASE_URL || "/api";

const apiClient = axios.create({
  baseURL,
  timeout: 30000,
});

apiClient.interceptors.request.use((config) => {
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
