import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from "react-native";
import { fetchLatestRoadmap, toggleMilestoneSkill } from "../services/api";

export default function RoadmapScreen({ onBack, token }) {
  const [analysisId, setAnalysisId] = useState(null);
  const [months, setMonths] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!token) return;
    let mounted = true;
    (async () => {
      try {
        const latest = await fetchLatestRoadmap(token);
        if (!mounted || !latest || !Array.isArray(latest.roadmap) || !latest.roadmap.length) return;
        setAnalysisId(latest.analysis_id || null);
        const completedSet = new Set(latest.completed_skills || []);
        setMonths(
          latest.roadmap.map((rm) => ({
            month: rm.month,
            title: (rm.goals && rm.goals[0]) || `الشهر ${rm.month}`,
            skills: (rm.skills_to_learn || []).map((sk) => ({
              name: sk,
              completed: completedSet.has(sk),
            })),
          }))
        );
      } catch (_err) {
        setError("تعذر تحميل خطة التطوير. تأكد من الاتصال أو أكمل تحليلك أولاً.");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [token]);

  const toggleSkill = (monthIdx, skillIdx) => {
    const currentSkill = months[monthIdx]?.skills?.[skillIdx];
    if (!token || !analysisId || !currentSkill || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    const nextCompleted = !currentSkill.completed;
    setMonths((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      next[monthIdx].skills[skillIdx].completed = nextCompleted;
      return next;
    });
    toggleMilestoneSkill(token, analysisId, currentSkill.name, nextCompleted).catch(() => {
        setMonths((prev) => prev.map((month, m) => m !== monthIdx ? month : { ...month, skills: month.skills.map((skill, i) => i !== skillIdx ? skill : { ...skill, completed: !nextCompleted }) }));
        setError("تعذر تأكيد حفظ التغيير. أعد فتح الخطة للتحقق من حالته.");
      }).finally(() => { savingRef.current = false; setSaving(false); });
  };

  const totalSkills = months.reduce((acc, m) => acc + m.skills.length, 0);
  const doneSkills = months.reduce((acc, m) => acc + m.skills.filter((s) => s.completed).length, 0);
  const progressPercent = totalSkills ? Math.round((doneSkills / totalSkills) * 100) : 0;

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← رجوع</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>🗺️ خارطة الطريق (3-Month Roadmap)</Text>
      </View>

      {/* Progress Bar Card */}
      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>معدل إنجاز المهارات التقنية</Text>
          <Text style={styles.progressNum}>{progressPercent}% ({doneSkills}/{totalSkills})</Text>
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${progressPercent}%` }]} />
        </View>
      </View>

      {!!error && <Text style={{ color: "#fca5a5", textAlign: "center" }}>{error}</Text>}
      {!error && months.length === 0 && <Text style={{ color: "#cbd5e1", textAlign: "center" }}>لا توجد خطة حتى الآن. أجرِ تحليلك أولاً.</Text>}

      {/* Months List */}
      <ScrollView style={styles.scrollList} contentContainerStyle={{ paddingBottom: 30 }}>
        {months.map((m, mIdx) => (
          <View key={m.month} style={styles.monthBox}>
            <Text style={styles.monthTitle}>{m.title}</Text>
            {m.skills.map((s, sIdx) => (
              <TouchableOpacity
                key={s.name}
                style={[styles.skillRow, s.completed && styles.skillRowDone]}
                onPress={() => toggleSkill(mIdx, sIdx)}
                disabled={saving}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: s.completed, disabled: saving }}
              >
                <View style={[styles.checkbox, s.completed && styles.checkboxDone]}>
                  {s.completed && <Text style={styles.checkMark}>✓</Text>}
                </View>
                <Text style={[styles.skillText, s.completed && styles.skillTextDone]}>
                  {s.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  topBar: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 45,
    paddingBottom: 14,
    backgroundColor: "#1e293b",
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  backBtn: { padding: 6 },
  backText: { color: "#38bdf8", fontSize: 14, fontWeight: "bold" },
  topTitle: { color: "#fff", fontSize: 15, fontWeight: "900" },
  progressCard: {
    backgroundColor: "#1e293b",
    margin: 16,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  progressHeader: { flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 8 },
  progressLabel: { color: "#cbd5e1", fontSize: 12, fontWeight: "bold" },
  progressNum: { color: "#38bdf8", fontSize: 12, fontWeight: "900" },
  barTrack: { height: 8, backgroundColor: "#0f172a", borderRadius: 4, overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: "#10b981", borderRadius: 4 },
  scrollList: { flex: 1, paddingHorizontal: 16 },
  monthBox: {
    backgroundColor: "#1e293b",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  monthTitle: { color: "#f8fafc", fontSize: 14, fontWeight: "800", marginBottom: 12, textAlign: "right" },
  skillRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "#0f172a",
    marginBottom: 8,
  },
  skillRowDone: { backgroundColor: "rgba(16, 185, 129, 0.1)" },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#64748b",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
  checkboxDone: { backgroundColor: "#10b981", borderColor: "#10b981" },
  checkMark: { color: "#fff", fontSize: 13, fontWeight: "bold" },
  skillText: { color: "#f1f5f9", fontSize: 12, fontWeight: "600", flex: 1, textAlign: "right" },
  skillTextDone: { color: "#94a3b8", textDecorationLine: "line-through" },
});
