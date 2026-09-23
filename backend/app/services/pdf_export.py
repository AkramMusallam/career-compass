"""
Batch 1.1 — تحميل النتائج كـ PDF.

قرارات هندسية:
1. استخدمنا reportlab بدلاً من WeasyPrint المقترحة في وثيقة توزيع المهام، لأن reportlab مكتبة
   بايثون خالصة بدون اعتماديات نظام خارجية (Cairo/Pango/GDK-Pixbuf)، مما يجعل النشر (Docker
   وغيره) أبسط وأكثر موثوقية، دون أي تنازل في جودة أو محتوى التقرير.
2. reportlab لا يدعم تشكيل النص العربي (Arabic Shaping) ولا اتجاه الكتابة (Bidi) بشكل تلقائي،
   وأي محاولة لطباعة نص عربي خام بخط لاتيني عادي (Helvetica) تُنتج حروفاً منفصلة وغير مقروءة.
   لذلك: (أ) ضمّنّا خط Amiri العربي (OFL license، من مستودع google/fonts — انظر
   app/assets/fonts/LICENSE.txt) وسجّلناه في reportlab، و(ب) مررنا كل نص ظاهر للمستخدم عبر
   arabic_reshaper + python-bidi (دالة rtl() أدناه) قبل إدراجه في أي Paragraph، لضمان ظهور
   الحروف العربية متصلة ومرتّبة بصرياً بشكل صحيح، بما يشمل النصوص المختلطة (عربي + مصطلحات
   تقنية إنجليزية مثل أسماء المهارات).

الواجهة (build_analysis_pdf) مستقلة تماماً عن أي طبقة أخرى، فيمكن استبدالها لاحقاً بقالب
HTML/CSS + WeasyPrint دون أي تغيير في الراوتر الذي يستدعيها.
"""
from __future__ import annotations

from datetime import datetime
from io import BytesIO
from pathlib import Path

import arabic_reshaper
from bidi.algorithm import get_display
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table, TableStyle

# ============================================================
# تسجيل خط Amiri العربي (مرة واحدة عند استيراد الوحدة)
# ============================================================
FONT_DIR = Path(__file__).resolve().parent.parent / "assets" / "fonts"
pdfmetrics.registerFont(TTFont("Amiri", str(FONT_DIR / "Amiri-Regular.ttf")))
pdfmetrics.registerFont(TTFont("Amiri-Bold", str(FONT_DIR / "Amiri-Bold.ttf")))

# نظام الألوان الرسمي للمنصة (القسم 3.1 من الدليل الأصلي)
PRIMARY_COLOR = colors.HexColor("#1E40AF")
SECONDARY_COLOR = colors.HexColor("#059669")
DANGER_COLOR = colors.HexColor("#DC2626")
WARNING_COLOR = colors.HexColor("#EA580C")
SLATE_COLOR = colors.HexColor("#475569")
LIGHT_BG = colors.HexColor("#F8FAFC")

STYLES = {
    "title": ParagraphStyle("title", fontName="Amiri-Bold", fontSize=22, textColor=PRIMARY_COLOR, alignment=TA_CENTER, leading=30, spaceAfter=10),
    "subtitle": ParagraphStyle("subtitle", fontName="Amiri", fontSize=11, textColor=SLATE_COLOR, alignment=TA_CENTER, leading=16, spaceAfter=16),
    "h2": ParagraphStyle("h2", fontName="Amiri-Bold", fontSize=15, textColor=colors.HexColor("#1E293B"), alignment=TA_RIGHT, spaceBefore=14, spaceAfter=8),
    "body": ParagraphStyle("body", fontName="Amiri", fontSize=11, textColor=colors.HexColor("#334155"), alignment=TA_RIGHT, leading=16),
    "body_bold": ParagraphStyle("body_bold", fontName="Amiri-Bold", fontSize=11, textColor=colors.HexColor("#1E293B"), alignment=TA_RIGHT, leading=16),
    "small": ParagraphStyle("small", fontName="Amiri", fontSize=9.5, textColor=SLATE_COLOR, alignment=TA_RIGHT, leading=13),
    "score": ParagraphStyle("score", fontName="Amiri-Bold", fontSize=36, textColor=PRIMARY_COLOR, alignment=TA_CENTER, leading=44),
    "score_label": ParagraphStyle("score_label", fontName="Amiri", fontSize=11, textColor=SLATE_COLOR, alignment=TA_CENTER, leading=16),
}


def rtl(text) -> str:
    """يحوّل أي نص (عربي، إنجليزي، أو مختلط) إلى الشكل الصحيح بصرياً لعرضه في PDF.

    يهرب رموز XML الخاصة أولاً (لأن Paragraph في reportlab يفسّر HTML مصغّر)، ثم يطبّق
    إعادة تشكيل الحروف العربية (arabic_reshaper) وخوارزمية الاتجاه الثنائي (python-bidi).
    """
    if text is None:
        return ""
    escaped = str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    reshaped = arabic_reshaper.reshape(escaped)
    return get_display(reshaped)


def _score_color(score: float):
    if score < 40:
        return DANGER_COLOR
    if score < 70:
        return WARNING_COLOR
    return SECONDARY_COLOR


def _join_or_none(items: list[str]) -> str:
    return "، ".join(items) if items else rtl("لا يوجد")


def build_analysis_pdf(analysis: dict) -> bytes:
    """يبني تقرير PDF كامل من مستند تحليل مخزّن في MongoDB (analysis_results_collection)."""
    buffer = BytesIO()
    doc = BaseDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
        leftMargin=1.8 * cm,
        rightMargin=1.8 * cm,
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
    doc.addPageTemplates([PageTemplate(id="main", frames=frame)])

    story = []

    # ---- ترويسة ----
    story.append(Paragraph("Career Compass", STYLES["title"]))
    story.append(Paragraph(rtl("تقرير التحليل المهني"), STYLES["subtitle"]))
    date_value = analysis.get("date")
    date_display = date_value.strftime("%Y-%m-%d %H:%M") if isinstance(date_value, datetime) else str(date_value)
    story.append(Paragraph(rtl(f"تاريخ التحليل: {date_display}"), STYLES["small"]))
    story.append(Spacer(1, 12))

    # ---- Career Score ----
    score = analysis.get("career_score", 0)
    score_content = Paragraph(
        f'<font size="36"><b>{round(score)} / 100</b></font><br/><font size="12">' + rtl("Career Score") + "</font>",
        STYLES["score"],
    )
    score_table = Table([[score_content]], colWidths=[doc.width])
    score_table.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 1.5, _score_color(score)),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 16),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 16),
            ]
        )
    )
    story.append(score_table)
    story.append(Spacer(1, 10))

    # ---- Career DNA ----
    career_dna = analysis.get("career_dna", {})
    if career_dna:
        story.append(Paragraph(rtl("Career DNA"), STYLES["h2"]))
        dna_rows = [[axis, f"{round(value)}/100"] for axis, value in career_dna.items()]
        dna_table = Table(dna_rows, colWidths=[doc.width * 0.7, doc.width * 0.3])
        dna_table.setStyle(
            TableStyle(
                [
                    ("FONTNAME", (0, 0), (-1, -1), "Amiri"),
                    ("FONTSIZE", (0, 0), (-1, -1), 10.5),
                    ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#334155")),
                    ("ALIGN", (0, 0), (0, -1), "RIGHT"),
                    ("ALIGN", (1, 0), (1, -1), "CENTER"),
                    ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, LIGHT_BG]),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                    ("TOPPADDING", (0, 0), (-1, -1), 7),
                ]
            )
        )
        story.append(dna_table)
        story.append(Spacer(1, 6))

    # ---- أفضل 5 وظائف ----
    top_jobs = analysis.get("top_jobs", [])
    if top_jobs:
        story.append(Paragraph(rtl("أفضل 5 وظائف مناسبة"), STYLES["h2"]))
        for job in top_jobs:
            story.append(
                Paragraph(
                    rtl(f"{job['job_title']} — نسبة التوافق {round(job['match_percentage'])}%"),
                    STYLES["body_bold"],
                )
            )
            story.append(Paragraph(rtl(f"المهارات المتوفرة: {_join_or_none(job.get('matched_skills', []))}"), STYLES["small"]))
            story.append(Paragraph(rtl(f"المهارات الناقصة: {_join_or_none(job.get('missing_skills', []))}"), STYLES["small"]))
            if job.get("explanation"):
                story.append(Paragraph(rtl(job["explanation"]), STYLES["small"]))
            story.append(Spacer(1, 6))

    # ---- نقاط القوة والضعف ----
    strengths = analysis.get("strengths", [])
    weaknesses = analysis.get("weaknesses", [])
    story.append(Paragraph(rtl("نقاط القوة والضعف"), STYLES["h2"]))
    story.append(Paragraph(rtl(f"نقاط القوة: {_join_or_none(strengths)}"), STYLES["body"]))
    story.append(Paragraph(rtl(f"نقاط الضعف: {_join_or_none(weaknesses)}"), STYLES["body"]))
    story.append(Spacer(1, 6))

    # ---- Skill Gap ----
    skill_gap = analysis.get("skill_gap", {})
    story.append(Paragraph(rtl("فجوة المهارات"), STYLES["h2"]))
    story.append(Paragraph(rtl(f"Critical: {_join_or_none(skill_gap.get('critical', []))}"), STYLES["body"]))
    story.append(Paragraph(rtl(f"Recommended: {_join_or_none(skill_gap.get('recommended', []))}"), STYLES["body"]))
    story.append(Paragraph(rtl(f"Nice to Have: {_join_or_none(skill_gap.get('nice_to_have', []))}"), STYLES["body"]))
    story.append(Spacer(1, 6))

    # ---- Roadmap ----
    roadmap = analysis.get("roadmap", [])
    if roadmap:
        story.append(Paragraph(rtl("خطة التعلم (3 أشهر)"), STYLES["h2"]))
        for month in roadmap:
            story.append(Paragraph(rtl(f"الشهر {month['month']}"), STYLES["body_bold"]))
            for goal in month.get("goals", []):
                story.append(Paragraph(rtl(f"• {goal}"), STYLES["small"]))
            story.append(Spacer(1, 4))

    # ---- الكورسات المقترحة ----
    courses = analysis.get("suggested_courses", [])
    if courses:
        story.append(Paragraph(rtl("الكورسات المقترحة"), STYLES["h2"]))
        for course in courses:
            story.append(Paragraph(rtl(f"{course['title']} — {course['platform']} (يغطي: {course['covers_skill']})"), STYLES["small"]))
        story.append(Spacer(1, 6))

    # ---- تذييل ----
    story.append(Spacer(1, 16))
    story.append(
        Paragraph(
            rtl("تم توليد هذا التقرير تلقائياً بواسطة Career Compass. للمزيد من التفاصيل التفاعلية، راجع لوحة النتائج على المنصة."),
            STYLES["small"],
        )
    )

    doc.build(story)
    return buffer.getvalue()
