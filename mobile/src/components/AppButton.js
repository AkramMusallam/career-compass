import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";

export default function AppButton({ title, onPress, disabled = false, color }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, color && { backgroundColor: color }, disabled && styles.disabled, pressed && styles.pressed]}>
    <Text style={styles.label}>{title}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({ button: { backgroundColor: "#1d4ed8", borderRadius: 12, minHeight: 48, paddingHorizontal: 16, paddingVertical: 11, alignItems: "center", justifyContent: "center" }, label: { color: "#fff", fontSize: 15, fontWeight: "700", textAlign: "center" }, disabled: { opacity: 0.45 }, pressed: { opacity: 0.8 } });
