import React, { useCallback, useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View, Text, TextInput, Button, SafeAreaView, ScrollView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { login, register, forgotPassword } from "./src/services/api";

import DashboardScreen from "./src/screens/DashboardScreen";
import MockInterviewScreen from "./src/screens/MockInterviewScreen";
import RoadmapScreen from "./src/screens/RoadmapScreen";
import AnalysisScreen from "./src/screens/AnalysisScreen";

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
        {!userToken ? (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.login}>
            <Text style={styles.label}>{authMode === "register" ? "إنشاء حساب" : authMode === "forgot" ? "استعادة كلمة المرور" : "تسجيل الدخول إلى Career Compass"}</Text>
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
  login: { padding: 24, gap: 12, marginTop: 60 },
  label: { color: "white", fontSize: 20, fontWeight: "bold", textAlign: "center" },
  input: { color: "white", borderWidth: 1, borderColor: "#64748b", borderRadius: 8, padding: 12 },
  error: { color: "#fca5a5", textAlign: "center" },
  notice: { color: "#a7f3d0", textAlign: "center" },
});
