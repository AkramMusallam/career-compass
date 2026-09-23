"""
قائمة المهارات المرجعية.
كل مهارة لها:
  - category: تُستخدم في حساب skill_diversity_score (تنوّع المهارات، القسم 6.4).
  - dna_axis: المحور التقني الذي تُسهم فيه المهارة ضمن Career DNA (القسم 5 / الواجهة 8-ب).
    المحاور التقنية الثلاثة: Programming, Data Handling, System Design.
    محورا Communication و Problem Solving يُستمدّان من أسئلة Assessment مباشرة (انظر assessment_data.py).
"""

# name -> (category, dna_axis)
SKILLS: dict[str, tuple[str, str]] = {
    # Programming languages / general
    "Python": ("Programming", "Programming"),
    "JavaScript": ("Programming", "Programming"),
    "TypeScript": ("Programming", "Programming"),
    "Java": ("Programming", "Programming"),
    "C++": ("Programming", "Programming"),
    "C#": ("Programming", "Programming"),
    "C": ("Programming", "Programming"),
    "Go": ("Programming", "Programming"),
    "Rust": ("Programming", "Programming"),
    "PHP": ("Programming", "Programming"),
    "Swift": ("Mobile", "Programming"),
    "Kotlin": ("Mobile", "Programming"),
    "Dart": ("Mobile", "Programming"),
    "Solidity": ("Programming", "Programming"),
    # Frontend
    "React": ("Frontend", "Programming"),
    "React Native": ("Mobile", "Programming"),
    "Vue.js": ("Frontend", "Programming"),
    "Angular": ("Frontend", "Programming"),
    "HTML/CSS": ("Frontend", "Programming"),
    "Tailwind CSS": ("Frontend", "Programming"),
    "Flutter": ("Mobile", "Programming"),
    "UI Design": ("Design", "System Design"),
    "UX Research": ("Design", "System Design"),
    "Figma": ("Design", "System Design"),
    "Prototyping": ("Design", "System Design"),
    "Accessibility (WCAG)": ("Design", "System Design"),
    # Backend / API
    "Node.js": ("Backend", "Programming"),
    "Django": ("Backend", "Programming"),
    "Flask": ("Backend", "Programming"),
    "FastAPI": ("Backend", "Programming"),
    "Spring Boot": ("Backend", "Programming"),
    "API Design": ("Backend", "System Design"),
    "REST": ("Backend", "System Design"),
    "GraphQL": ("Backend", "System Design"),
    "Microservices": ("Backend", "System Design"),
    "Unity": ("Backend", "Programming"),
    "Unreal Engine": ("Backend", "Programming"),
    "Game Physics": ("Backend", "System Design"),
    # Data
    "SQL": ("Data", "Data Handling"),
    "NoSQL": ("Data", "Data Handling"),
    "MySQL": ("Data", "Data Handling"),
    "PostgreSQL": ("Data", "Data Handling"),
    "MongoDB": ("Data", "Data Handling"),
    "Data Analysis": ("Data", "Data Handling"),
    "Data Visualization": ("Data", "Data Handling"),
    "Excel": ("Data", "Data Handling"),
    "Power BI": ("Data", "Data Handling"),
    "Tableau": ("Data", "Data Handling"),
    "Pandas": ("Data", "Data Handling"),
    "NumPy": ("Data", "Data Handling"),
    "Statistics": ("Data", "Data Handling"),
    "ETL Pipelines": ("Data", "Data Handling"),
    "Apache Spark": ("Data", "Data Handling"),
    "Apache Kafka": ("Data", "Data Handling"),
    "Data Warehousing": ("Data", "Data Handling"),
    "Data Modeling": ("Data", "Data Handling"),
    # AI / ML
    "Machine Learning": ("AI", "Data Handling"),
    "Deep Learning": ("AI", "Data Handling"),
    "TensorFlow": ("AI", "Data Handling"),
    "PyTorch": ("AI", "Data Handling"),
    "NLP": ("AI", "Data Handling"),
    "Computer Vision": ("AI", "Data Handling"),
    "MLOps": ("AI", "System Design"),
    "Scikit-learn": ("AI", "Data Handling"),
    # DevOps / Cloud / Infra
    "Docker": ("DevOps", "System Design"),
    "Kubernetes": ("DevOps", "System Design"),
    "CI/CD": ("DevOps", "System Design"),
    "AWS": ("DevOps", "System Design"),
    "Azure": ("DevOps", "System Design"),
    "GCP": ("DevOps", "System Design"),
    "Terraform": ("DevOps", "System Design"),
    "Linux Administration": ("DevOps", "System Design"),
    "Networking Fundamentals": ("Networking", "System Design"),
    "Network Security": ("Security", "System Design"),
    "Routing & Switching": ("Networking", "System Design"),
    "Database Administration": ("Database", "Data Handling"),
    "Backup & Recovery": ("Database", "System Design"),
    "System Monitoring": ("DevOps", "System Design"),
    "Cloud Architecture": ("DevOps", "System Design"),
    # Security
    "Cybersecurity Fundamentals": ("Security", "System Design"),
    "SIEM Tools": ("Security", "Data Handling"),
    "Incident Response": ("Security", "System Design"),
    "Penetration Testing": ("Security", "System Design"),
    "Ethical Hacking": ("Security", "System Design"),
    "Vulnerability Assessment": ("Security", "System Design"),
    "Cryptography": ("Security", "System Design"),
    "Risk Assessment": ("Security", "System Design"),
    # QA
    "Manual Testing": ("QA", "System Design"),
    "Test Automation": ("QA", "Programming"),
    "Selenium": ("QA", "Programming"),
    "Test Planning": ("QA", "System Design"),
    "Bug Tracking": ("QA", "System Design"),
    # Version control / general engineering
    "Git": ("Backend", "System Design"),
    "System Design": ("Backend", "System Design"),
    "OOP": ("Programming", "Programming"),
    "Design Patterns": ("Backend", "System Design"),
    "Agile/Scrum": ("Management", "System Design"),
    # Embedded / IoT / Emerging
    "Embedded C": ("Embedded", "Programming"),
    "Microcontrollers": ("Embedded", "System Design"),
    "RTOS": ("Embedded", "System Design"),
    "IoT Protocols (MQTT)": ("Embedded", "System Design"),
    "Sensors & Actuators": ("Embedded", "System Design"),
    "Blockchain Fundamentals": ("Embedded", "System Design"),
    "Smart Contracts": ("Embedded", "Programming"),
    "AR/VR SDKs": ("Embedded", "Programming"),
    "3D Modeling": ("Embedded", "System Design"),
    "Robotics (ROS)": ("Embedded", "System Design"),
    "Control Systems": ("Embedded", "System Design"),
    # Management / Business
    "Requirements Gathering": ("Management", "System Design"),
    "Business Process Modeling": ("Management", "System Design"),
    "Stakeholder Management": ("Management", "System Design"),
    "Product Strategy": ("Management", "System Design"),
    "Roadmap Planning": ("Management", "System Design"),
    "Solution Architecture": ("Management", "System Design"),
    "Technical Writing": ("Management", "System Design"),
    "Customer Support": ("Management", "System Design"),
    "Troubleshooting": ("Management", "System Design"),
}


# ============================================================
# Batch 5.3 — توسعة قاموس المهارات بمرادفات عربية شائعة (دعم استخراج CV باللغة العربية)
# ============================================================
# كل مفتاح هنا هو مصطلح عربي شائع الاستخدام في السير الذاتية، وقيمته هي اسم المهارة الكنسي
# (canonical) المطابق تماماً لأحد مفاتيح SKILLS أعلاه — بحيث تُعامَل نفس المهارة الواحدة
# بنفس الاسم الإنجليزي بغض النظر عن اللغة التي كُتبت بها في الـ CV الأصلي، لأن محرك التوصية
# (recommendation_engine.py) وجدول Job_Skills بقاعدة البيانات يعتمدان حصراً على المفاتيح
# الإنجليزية المعرّفة في SKILLS.
#
# ملاحظة تصميم: مقصود أن يكون هذا القاموس إضافياً (additive) بجانب SKILLS وليس بديلاً عنه —
# انظر _extract_skills في cv_extraction.py حيث تُفحص المرادفات العربية في مسار منفصل تماماً
# عن فحص أسماء SKILLS الإنجليزية الأصلي، دون أي تعديل على سلوكه القائم (لتفادي أي أثر جانبي
# على الاختبارات القائمة لمطابقة المهارات الإنجليزية).


# ============================================================
# إصلاح خلل حرج (اكتُشف أثناء مراجعة شاملة للتطبيق بعد إنجاز الدفعة 5) — تطبيع أسماء المهارات
# ============================================================
# فهرس بحث سريع غير حسّاس لحالة الأحرف: "python" أو "PYTHON" أو "Python" كلها يجب أن تُطابَق
# لنفس المفتاح الكنسي "Python" الموجود في SKILLS، وإلا فمحرك التوصية (recommendation_engine.py)
# لن يتعرّف عليها إطلاقاً في job_match/skill_diversity/Career_DNA (كلها تفحص المطابقة بحساسية
# تامة لحالة الأحرف عبر SKILLS.get(skill) أو مقارنة مباشرة مع أسماء Job_Skills من قاعدة
# البيانات). يُبنى هذا الفهرس مرة واحدة فقط عند استيراد الوحدة.
_SKILLS_CASE_INSENSITIVE_LOOKUP: dict[str, str] = {name.lower(): name for name in SKILLS}


def normalize_skill_name(raw_name: str) -> str | None:
    cleaned = raw_name.strip()
    if not cleaned:
        return None
    lower_clean = cleaned.lower()
    for canonical in SKILLS:
        if canonical.lower() == lower_clean:
            return canonical
    return cleaned


def normalize_and_dedupe_skills(skills: list[str]) -> list[str]:
    """يُطبّع قائمة مهارات كاملة (عبر normalize_skill_name) ثم يزيل التكرار الناتج عن التطبيع
    مع الحفاظ على ترتيب أول ظهور (مثال: ["Python", "PYTHON", "python"] تصبح ["Python"] فقط
    بدل ثلاث مهارات متطابقة فعلياً لكنها تبدو مختلفة نصياً)."""
    seen: set[str] = set()
    result: list[str] = []
    for raw in skills:
        canonical = normalize_skill_name(raw)
        if not canonical or canonical in seen:
            continue
        seen.add(canonical)
        result.append(canonical)
    return result
