import React, { useCallback, useEffect, useState } from "react";
import Button from "./src/components/AppButton";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View, Text, TextInput, SafeAreaView, ScrollView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { login, register, forgotPassword, setUnauthorizedHandler } from "./src/services/api";

import DashboardScreen from "./src/screens/DashboardScreen";
import MockInterviewScreen from "./src/screens/MockInterviewScreen";
import RoadmapScreen from "./src/screens/RoadmapScreen";
import AnalysisScreen from "./src/screens/AnalysisScreen";
import HistoryScreen from "./src/screens/HistoryScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import CompanyScreen from "./src/screens/CompanyScreen";
import AdminScreen from "./src/screens/AdminScreen";

export default function App() {
  const [restoring, setRestoring] = useState(true);
  useEffect(() => {
    (async () => {
      let token = await SecureStore.getItemAsync("userToken");
      if (!token) {
        token = await AsyncStorage.getItem("userToken");
        if (token) await SecureStore.setItemAsync("userToken", token);
      }
      await AsyncStorage.removeItem("userToken");
      setUserToken(token);
    })().catch(() => setError("تعذر استعادة الجلسة السابقة.")).finally(() => setRestoring(false));
  }, []);
  const [currentScreen, setCurrentScreen] = useState("dashboard");
  const [userToken, setUserToken] = useState(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [notice, setNotice] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    setSessionExpired(false);
    setUnauthorizedHandler((token) => { if (token === userToken) setSessionExpired(true); });
    return () => setUnauthorizedHandler(null);
  }, [userToken]);

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await login(email.trim(), password);
      await SecureStore.setItemAsync("userToken", data.access_token);
      setUserToken(data.access_token);
      setPassword("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAccount = async () => {
    if (authMode === "login") return handleLogin();
    setLoading(true);
    setError("");
    setNotice("");
    try {
      if (authMode === "register") {
        if (fullName.trim().length < 2 || password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
          throw new Error("أدخل اسمك وكلمة مرور من 8 أحرف على الأقل تشمل حرفًا إنجليزيًا كبيرًا وصغيرًا ورقمًا.");
        }
        await register(fullName.trim(), email.trim(), password);
        setPassword("");
        setAuthMode("login");
        setNotice("تم إنشاء الحساب. سجّل الدخول للمتابعة.");
      } else {
        await forgotPassword(email.trim());
        setNotice("إذا كان البريد مسجلاً، سيصلك رابط لإعادة تعيين كلمة المرور.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const changeAuthMode = (mode) => {
    setAuthMode(mode);
    setError("");
    setNotice("");
    setPassword("");
  };

  const handleLogout = useCallback(async () => {
    try {
      await SecureStore.deleteItemAsync("userToken");
      await AsyncStorage.removeItem("userToken");
    } catch (_) {
      setError("تعذر تسجيل الخروج. حاول مرة أخرى.");
      return;
    }
    setUserToken(null);
    setCurrentScreen("dashboard");
  }, []);

  if (restoring) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.container}>
        {userToken && sessionExpired && <Text style={styles.sessionNotice}>انتهت الجلسة. ارجع للرئيسية وسجّل الدخول من جديد. احفظ عملك أولًا إن أمكن.</Text>}
        {!userToken ? (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.login}>
            <Text style={styles.brand}>🧭  CAREER COMPASS</Text>
            <Text style={styles.label}>{authMode === "register" ? "إنشاء حساب" : authMode === "forgot" ? "استعادة كلمة المرور" : "تسجيل الدخول إلى Career Compass"}</Text>
            <Text style={styles.subtitle}>{authMode === "login" ? "خطوتك القادمة في مسيرتك المهنية تبدأ هنا" : authMode === "register" ? "أنشئ حسابك وابدأ رحلتك المهنية" : "أدخل بريدك لنرسل لك رابط الاستعادة"}</Text>
            {authMode === "register" && <TextInput style={styles.input} placeholder="الاسم الكامل" placeholderTextColor="#94a3b8" value={fullName} onChangeText={setFullName} />}
            <TextInput style={styles.input} placeholder="البريد الإلكتروني" placeholderTextColor="#94a3b8" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            {authMode !== "forgot" && <TextInput style={styles.input} placeholder="كلمة المرور" placeholderTextColor="#94a3b8" value={password} onChangeText={setPassword} secureTextEntry />}
            {!!error && <Text style={styles.error}>{error}</Text>}
            {!!notice && <Text style={styles.notice}>{notice}</Text>}
            <Button title={loading ? "جارٍ الانتظار..." : authMode === "register" ? "إنشاء الحساب" : authMode === "forgot" ? "إرسال رابط الاستعادة" : "تسجيل الدخول"} onPress={handleAccount} disabled={loading || !email.trim() || (authMode !== "forgot" && !password)} />
            {authMode === "login" ? <><Button title="إنشاء حساب جديد" onPress={() => changeAuthMode("register")} disabled={loading} /><Button title="نسيت كلمة المرور؟" onPress={() => changeAuthMode("forgot")} disabled={loading} /></> : <Button title="العودة لتسجيل الدخول" onPress={() => changeAuthMode("login")} disabled={loading} />}
          </ScrollView>
        ) : currentScreen === "dashboard" ? (
          <DashboardScreen onNavigate={(screen) => setCurrentScreen(screen)} onLogout={handleLogout} token={userToken} />
        ) : currentScreen === "interview" ? (
          <MockInterviewScreen onBack={() => setCurrentScreen("dashboard")} token={userToken} />
        ) : currentScreen === "analysis" ? (
          <AnalysisScreen onBack={() => setCurrentScreen("dashboard")} token={userToken} />
        ) : currentScreen === "history" ? (
          <HistoryScreen onBack={() => setCurrentScreen("dashboard")} token={userToken} />
        ) : currentScreen === "profile" ? (
          <ProfileScreen onBack={() => setCurrentScreen("dashboard")} token={userToken} />
        ) : currentScreen === "company" ? (
          <CompanyScreen onBack={() => setCurrentScreen("dashboard")} token={userToken} />
        ) : currentScreen === "admin" ? (
          <AdminScreen onBack={() => setCurrentScreen("dashboard")} token={userToken} />
        ) : (
          <RoadmapScreen onBack={() => setCurrentScreen("dashboard")} token={userToken} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#0f172a" },
  container: { flex: 1, backgroundColor: "#0f172a" },
  login: { padding: 24, gap: 14, paddingTop: 76, paddingBottom: 40, flexGrow: 1 },
  brand: { color: "#38bdf8", fontSize: 13, fontWeight: "bold", letterSpacing: 1, textAlign: "center", marginBottom: 8 },
  label: { color: "white", fontSize: 24, fontWeight: "bold", textAlign: "center" },
  subtitle: { color: "#94a3b8", fontSize: 14, textAlign: "center", marginBottom: 12 },
  input: { color: "white", backgroundColor: "#1e293b", borderWidth: 1, borderColor: "#475569", borderRadius: 12, padding: 14, textAlign: "right" },
  error: { color: "#fca5a5", textAlign: "center" },
  notice: { color: "#a7f3d0", textAlign: "center" },
  sessionNotice: { color: "#fde68a", backgroundColor: "#78350f", padding: 10, textAlign: "center" },
});
