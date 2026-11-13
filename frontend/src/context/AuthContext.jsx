import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { loginUser, registerUser } from "../api/endpoints";

const AuthContext = createContext(null);

export function parseJwtExp(token) {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    return typeof payload?.exp === "number" && Number.isFinite(payload.exp)
      ? payload.exp
      : null;
  } catch {
    return null;
  }
}

function isTokenExpired(token) {
  const exp = parseJwtExp(token);
  return exp !== null && Date.now() >= exp * 1000;
}

function clearStoredAuth() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("user");
  localStorage.removeItem("active_company_id");
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem("access_token");
    const stored = localStorage.getItem("user");
    if (!token || !stored || isTokenExpired(token)) {
      clearStoredAuth();
      return null;
    }
    try {
      return JSON.parse(stored);
    } catch {
      clearStoredAuth();
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // عند تحميل التطبيق أول مرة: تحقق من وجود توكن مخزّن صالح لاستعادة الجلسة
    const token = localStorage.getItem("access_token");
    if (!token || isTokenExpired(token)) {
      clearStoredAuth();
      setUser(null);
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email, password) => {
    const response = await loginUser({ email, password });
    const { access_token: accessToken, user: userData } = response.data;
    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
    return userData;
  }, []);

  const register = useCallback(async (fullName, email, password) => {
    const response = await registerUser({ full_name: fullName, email, password });
    return response.data;
  }, []);

  const logout = useCallback(() => {
    clearStoredAuth();
    setUser(null);
  }, []);

  const updateStoredUser = useCallback((patch) => {
    setUser((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem("user", JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo(() => {
    const token = localStorage.getItem("access_token");
    return {
      user,
      isAuthenticated: Boolean(user && token && !isTokenExpired(token)),
      isLoading,
      login,
      register,
      logout,
      updateStoredUser,
    };
  }, [user, isLoading, login, register, logout, updateStoredUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
