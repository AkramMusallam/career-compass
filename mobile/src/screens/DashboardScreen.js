import React, { useState, useEffect } from "react";
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from "react-native";
import { fetchLatestRoadmap, fetchProfile } from "../services/api";

export default function DashboardScreen({ onNavigate, token }) {
  const [stats, setStats] = useState({
    careerScore: 84,
    targetRole: "Full Stack Developer",
    completedRoadmapSkills: 5,
    totalRoadmapSkills: 12,
  });

  useEffect(() => {
    if (!token) return;
    let mounted = true;
    (async () => {
      try {
        const [profile, latest] = await Promise.all([
          fetchProfile(token).catch(() => null),
          fetchLatestRoadmap(token).catch(() => null),
        ]);
        if (!mounted) return;
        if (latest || profile) {
          const totalSkills = (latest?.roadmap || []).reduce(
            (acc, m) => acc + ((m.skills_to_learn || []).length),
            0
          );
          setStats((prev) => ({
            careerScore: Math.round(latest?.career_score ?? profile?.highest_career_score ?? prev.careerScore),
            targetRole: latest?.top_jobs?.[0]?.job_title || prev.targetRole,
            completedRoadmapSkills: (latest?.completed_skills || []).length || prev.completedRoadmapSkills,
            totalRoadmapSkills: totalSkills || prev.totalRoadmapSkills,
          }));
        }
      } catch (_err) {
        // Fallback to local offline snapshot when backend is unreachable
      }
    })();
    return () => {
      mounted = false;
    };
  }, [token]);

  return (
    <ScrollView style={styles.container}>
      {/* Header Profile Card */}
      <View style={styles.cardHeader}>
        <Text style={styles.badge}>🧭 Career Compass Mobile</Text>
        <Text style={styles.greeting}>مرحباً بك مجدداً 👋</Text>
        <Text style={styles.roleSub}>{stats.targetRole}</Text>
      </View>

      {/* Career Score Gauge */}
      <View style={styles.scoreBox}>
        <View style={styles.circleGauge}>
          <Text style={styles.scoreText}>{stats.careerScore}%</Text>
          <Text style={styles.scoreSub}>درجة الجاهزية</Text>
        </View>
        <View style={styles.scoreDetails}>
          <Text style={styles.scoreTitle}>المستوى التنافسي: متقدم ⭐</Text>
          <Text style={styles.scoreDesc}>
            أنت في أعلى 15% من المتقدمين لنفس المسار التقني في السوق الإقليمي.
          </Text>
        </View>
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionHeader}>إجراءات سريعة وممارسة</Text>

      <TouchableOpacity
        style={[styles.actionBtn, styles.actionPrimary]}
        onPress={() => onNavigate("interview")}
      >
        <Text style={styles.actionIcon}>🎙️</Text>
        <View style={styles.actionTextCol}>
          <Text style={styles.actionBtnTitle}>بدء محاكاة المقابلة التقنية (Voice AI)</Text>
          <Text style={styles.actionBtnSub}>تمرن على أسئلة مدير التوظيف بالصوت والنص</Text>
        </View>
        <Text style={styles.actionArrow}>←</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionBtn, styles.actionSecondary]}
        onPress={() => onNavigate("roadmap")}
      >
        <Text style={styles.actionIcon}>🗺️</Text>
        <View style={styles.actionTextCol}>
          <Text style={styles.actionBtnTitle}>متابعة الـ 3-Month Roadmap</Text>
          <Text style={styles.actionBtnSub}>
            أنجزت {stats.completedRoadmapSkills} من أصل {stats.totalRoadmapSkills} مهارات
          </Text>
        </View>
        <Text style={styles.actionArrow}>←</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", padding: 18 },
  cardHeader: { marginBottom: 20 },
  badge: { color: "#38bdf8", fontSize: 12, fontWeight: "bold", marginBottom: 6 },
  greeting: { fontSize: 24, fontWeight: "900", color: "#f8fafc" },
  roleSub: { fontSize: 14, color: "#94a3b8", marginTop: 4 },
  scoreBox: {
    backgroundColor: "#1e293b",
    borderRadius: 18,
    padding: 16,
    flexDirection: "row-reverse",
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  circleGauge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 14,
  },
  scoreText: { color: "#fff", fontSize: 20, fontWeight: "900" },
  scoreSub: { color: "#ecfdf5", fontSize: 9 },
  scoreDetails: { flex: 1 },
  scoreTitle: { color: "#34d399", fontSize: 14, fontWeight: "bold", marginBottom: 4 },
  scoreDesc: { color: "#94a3b8", fontSize: 11, lineHeight: 16 },
  sectionHeader: { color: "#cbd5e1", fontSize: 15, fontWeight: "800", marginBottom: 12 },
  actionBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
  },
  actionPrimary: { backgroundColor: "#4f46e5" },
  actionSecondary: { backgroundColor: "#1e293b", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  actionIcon: { fontSize: 26, marginLeft: 12 },
  actionTextCol: { flex: 1 },
  actionBtnTitle: { color: "#fff", fontSize: 14, fontWeight: "bold" },
  actionBtnSub: { color: "#cbd5e1", fontSize: 11, marginTop: 2 },
  actionArrow: { color: "#fff", fontSize: 18, fontWeight: "bold", marginRight: 8 },
});
