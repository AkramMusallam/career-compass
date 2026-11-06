import React, { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View, Text, TextInput, Button, SafeAreaView } from "react-native";
import { login } from "./src/services/api";

import DashboardScreen from "./src/screens/DashboardScreen";
import MockInterviewScreen from "./src/screens/MockInterviewScreen";
import RoadmapScreen from "./src/screens/RoadmapScreen";

export default function App() {
  const [currentScreen, setCurrentScreen] = useState("dashboard");
  const [userToken, setUserToken] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await login(email.trim(), password);
      setUserToken(data.access_token);
      setPassword("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.container}>
        {!userToken ? (
          <View style={styles.login}>
            <Text style={styles.label}>تسجيل الدخول إلى Career Compass</Text>
            <TextInput style={styles.input} placeholder="البريد الإلكتروني" placeholderTextColor="#94a3b8" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            <TextInput style={styles.input} placeholder="كلمة المرور" placeholderTextColor="#94a3b8" value={password} onChangeText={setPassword} secureTextEntry />
            {!!error && <Text style={styles.error}>{error}</Text>}
            <Button title={loading ? "جاري الدخول..." : "تسجيل الدخول"} onPress={handleLogin} disabled={loading || !email || !password} />
          </View>
        ) : currentScreen === "dashboard" ? (
          <DashboardScreen onNavigate={(screen) => setCurrentScreen(screen)} token={userToken} />
        ) : currentScreen === "interview" ? (
          <MockInterviewScreen onBack={() => setCurrentScreen("dashboard")} token={userToken} />
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
});
