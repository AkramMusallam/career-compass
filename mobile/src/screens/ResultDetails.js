import React from "react";
import Button from "../components/AppButton";
import { Alert, Linking, StyleSheet, Text, View } from "react-native";

export default function ResultDetails({ result }) {
  async function openCourse(url) {
    if (!/^https?:\/\//i.test(url)) { Alert.alert("رابط غير متاح"); return; }
    try { await Linking.openURL(url); } catch { Alert.alert("تعذر فتح الرابط"); }
  }
  const sections = [["نقاط القوة", result.strengths], ["نقاط التحسين", result.weaknesses], ["مهارات مهمة", result.skill_gap?.critical], ["مهارات مقترحة", result.skill_gap?.recommended], ["مهارات إضافية", result.skill_gap?.nice_to_have]];
  return <>
    <Text style={styles.heading}>درجة الجاهزية: {Math.round(result.career_score)}%</Text>
    <Text style={styles.heading}>الوظائف المقترحة</Text>
    {(result.top_jobs || []).map((job, i) => <View style={styles.card} key={i}><Text style={styles.heading}>{job.job_title} — {Math.round(job.match_percentage)}%</Text><Text style={styles.text}>{job.explanation}</Text><Text style={styles.text}>المهارات المتوفرة: {(job.matched_skills || []).join("، ") || "لا يوجد"}</Text><Text style={styles.text}>المهارات الناقصة: {(job.missing_skills || []).join("، ") || "لا يوجد"}</Text></View>)}
    {sections.map(([title, items]) => <View key={title}><Text style={styles.heading}>{title}</Text><Text style={styles.text}>{(items || []).join("، ") || "لا يوجد"}</Text></View>)}
    <Text style={styles.heading}>خطة التعلم</Text>{(result.roadmap || []).map((month, i) => <View key={i}><Text style={styles.text}>الشهر {month.month}: {(month.goals || []).join("، ")}</Text><Text style={styles.text}>المهارات: {(month.skills_to_learn || []).join("، ") || "لا توجد"}</Text></View>)}
    <Text style={styles.heading}>الدورات المقترحة</Text>{(result.suggested_courses || []).map((course, i) => <View key={i} style={styles.card}><Text style={styles.text}>{course.title} · {course.platform}</Text><Text style={styles.text}>المهارة: {course.covers_skill}</Text><Button title="فتح الدورة" onPress={() => openCourse(course.url)} /></View>)}
  </>;
}

const styles = StyleSheet.create({ heading: { color: "#e2e8f0", fontSize: 17, fontWeight: "bold", textAlign: "right", marginVertical: 5 }, text: { color: "#cbd5e1", fontSize: 15, textAlign: "right", marginVertical: 4 }, card: { padding: 14, backgroundColor: "#1e293b", borderRadius: 10, gap: 8 } });
