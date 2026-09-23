import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { loginUser, registerUser } from "../api/endpoints";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // عند تحميل التطبيق أول مرة: تحقق من وجود توكن مخزّن مسبقاً لاستعادة الجلسة
    const token = localStorage.getItem("access_token");
    if (!token) {
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
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    setUser(null);
  }, []);

  const updateStoredUser = useCallback((patch) => {
    setUser((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem("user", JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user && localStorage.getItem("access_token")),
      isLoading,
      login,
      register,
      logout,
      updateStoredUser,
    }),
    [user, isLoading, login, register, logout, updateStoredUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
