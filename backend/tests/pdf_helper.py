from io import BytesIO

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

# استيراد هذه الوحدة له أثر جانبي مهم: يسجّل خطي Amiri/Amiri-Bold (الداعمين لليونيكود العربي)
# في reportlab عند أول استيراد (انظر أعلى backend/app/services/pdf_export.py). دون هذا،
# محاولة رسم نص عربي بخط Helvetica الافتراضي (Type1/WinAnsi) تفشل لأنه لا يحتوي أصلاً على
# محارف عربية في ترميزه.
import app.services.pdf_export  # noqa: F401  (side effect: font registration)


def build_sample_cv_pdf() -> bytes:
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y = height - 50

    def write_line(text: str, size: int = 11):
        nonlocal y
        c.setFont("Helvetica", size)
        c.drawString(50, y, text)
        y -= 18

    write_line("Sami Developer", 16)
    write_line("sami.developer@example.com | Nablus, Palestine")
    y -= 10
    write_line("Skills", 13)
    write_line("Python, SQL, React, Docker, Git, API Design")
    y -= 10
    write_line("Projects", 13)
    write_line("Career Portal Backend")
    write_line("Built a REST API using Python and SQL for a student portal, containerized with Docker.")
    write_line("E-commerce React Storefront")
    write_line("Developed a storefront using React and integrated it with a Node.js API via Git workflows.")
    y -= 10
    write_line("Experience", 13)
    write_line("Backend Developer Intern - Tech Solutions Co, 2022-2024")
    write_line("Worked on Python microservices and SQL database design for two years.")
    y -= 10
    write_line("Education", 13)
    write_line("Bachelor of Computer Science, An-Najah National University, 2024")

    c.showPage()
    c.save()
    return buffer.getvalue()


def build_sample_arabic_cv_pdf() -> bytes:
    """Batch 5.2/5.3 — سيرة ذاتية عربية اصطناعية لاختبار محرك الاستخراج بالعربية.

    قرار هندسي مهم ومقصود: النص يُرسم هنا *بترتيبه المنطقي الخام* عبر drawString مباشرة، دون
    تمريره عبر arabic_reshaper/python-bidi (rtl() في pdf_export.py). هذان الأخيران مخصصان
    لإعادة *تشكيل* الحروف العربية وترتيبها *بصرياً* لغرض العرض الصحيح في عارض PDF (اتجاه الكتابة
    من اليمين لليسار) — وهذا مناسب تماماً عند *توليد* تقرير للعرض (كما في pdf_export.py)، لكنه
    غير مناسب هنا لأننا نبني ملف *مدخل* (input fixture) الهدف منه اختبار أن extract_cv_data
    يستخرج نفس النص المنطقي الصحيح الذي كتبناه بايثون.

    بما أن drawString يضع الحروف بترتيب السلسلة النصية المُعطاة له مباشرة على ترتيب X تصاعدي على
    الصفحة (بدون أي خوارزمية bidi خاصة به)، فإن استخراج pdfplumber لاحقاً (الذي يرتّب المحارف
    حسب موضعها على الصفحة) يُعيد بالضبط نفس الترتيب المنطقي الذي كتبناه — يُحاكي هذا بدقة حالة
    ملفات PDF "سليمة" مُصدَّرة من Word/LibreOffice/Google Docs بترميز Unicode قياسي (الحالة
    الموثّقة والمدعومة في docstring أعلى cv_extraction.py)، وهي الحالة الواقعية الأشيع لسير
    ذاتية حقيقية يرفعها المستخدمون.
    """
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y = height - 50

    def write_line(text: str, size: int = 12, bold: bool = False):
        nonlocal y
        c.setFont("Amiri-Bold" if bold else "Amiri", size)
        c.drawString(50, y, text)
        y -= 22

    write_line("سامي المطور", 16, bold=True)
    write_line("sami.developer@example.com | نابلس، فلسطين")
    y -= 10
    write_line("المهارات التقنية", 13, bold=True)
    write_line("بايثون، SQL، React، دوكر، جيت، تصميم واجهات برمجية")
    y -= 10
    write_line("المشاريع", 13, bold=True)
    write_line("بوابة التوظيف الذكية")
    write_line("بُنيت باستخدام بايثون ولغة SQL لخدمة الطلاب، تم نشرها عبر دوكر و Kubernetes للتوسع التلقائي.")
    y -= 10
    write_line("الخبرة العملية", 13, bold=True)
    write_line("مطور واجهات خلفية - شركة الحلول التقنية، ٢٠٢٢ حتى الآن")
    write_line("عمل على تطوير خدمات مصغّرة باستخدام بايثون وقواعد بيانات SQL.")
    y -= 10
    write_line("المؤهلات العلمية", 13, bold=True)
    write_line("بكالوريوس علوم حاسوب، جامعة النجاح الوطنية، ٢٠٢٣")

    c.showPage()
    c.save()
    return buffer.getvalue()
