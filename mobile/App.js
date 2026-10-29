import React, { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View, SafeAreaView } from "react-native";

import DashboardScreen from "./src/screens/DashboardScreen";
import MockInterviewScreen from "./src/screens/MockInterviewScreen";
import RoadmapScreen from "./src/screens/RoadmapScreen";

export default function App() {
  const [currentScreen, setCurrentScreen] = useState("dashboard");
  const [userToken, setUserToken] = useState("mock_mobile_token_123");

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.container}>
        {currentScreen === "dashboard" && (
          <DashboardScreen onNavigate={(screen) => setCurrentScreen(screen)} token={userToken} />
        )}
        {currentScreen === "interview" && (
          <MockInterviewScreen onBack={() => setCurrentScreen("dashboard")} token={userToken} />
        )}
        {currentScreen === "roadmap" && (
          <RoadmapScreen onBack={() => setCurrentScreen("dashboard")} token={userToken} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#0f172a" },
  container: { flex: 1, backgroundColor: "#0f172a" },
});
