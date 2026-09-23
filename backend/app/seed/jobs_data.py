"""
قاعدة بيانات الوظائف الثلاثين المرجعية (القسم 7) مع تصنيف مهارات كل وظيفة
إلى Essential / Important / Bonus (القسم 6.3 و 7.1).
كل عنصر: (عنوان الوظيفة, المجال, essential[], important[], bonus[])
"""

JOBS: list[tuple[str, str, list[str], list[str], list[str]]] = [
    # ---------------- التطوير (Development) ----------------
    (
        "Backend Developer",
        "Development",
        ["SQL", "API Design", "Python", "OOP"],
        ["Docker", "Git", "REST"],
        ["CI/CD", "AWS", "Microservices"],
    ),
    (
        "Frontend Developer",
        "Development",
        ["JavaScript", "React", "HTML/CSS"],
        ["Git", "TypeScript", "Tailwind CSS"],
        ["Accessibility (WCAG)", "Vue.js"],
    ),
    (
        "Full Stack Developer",
        "Development",
        ["JavaScript", "React", "Node.js", "SQL"],
        ["API Design", "Git", "Docker"],
        ["TypeScript", "AWS", "CI/CD"],
    ),
    (
        "Software Engineer",
        "Development",
        ["OOP", "Design Patterns", "Git", "System Design"],
        ["SQL", "Python", "Java"],
        ["Docker", "CI/CD"],
    ),
    (
        "Mobile Developer",
        "Development",
        ["React Native", "Flutter", "OOP"],
        ["API Design", "Git", "Kotlin"],
        ["Swift", "CI/CD"],
    ),
    (
        "Game Developer",
        "Development",
        ["Unity", "C++", "Game Physics"],
        ["OOP", "3D Modeling"],
        ["Unreal Engine", "AR/VR SDKs"],
    ),
    # ---------------- الذكاء الاصطناعي والبيانات (AI & Data) ----------------
    (
        "AI Engineer",
        "AI & Data",
        ["Python", "Machine Learning", "Deep Learning"],
        ["TensorFlow", "PyTorch", "Statistics"],
        ["MLOps", "Computer Vision", "NLP"],
    ),
    (
        "Machine Learning Engineer",
        "AI & Data",
        ["Python", "Machine Learning", "Scikit-learn"],
        ["TensorFlow", "PyTorch", "SQL"],
        ["MLOps", "Docker", "AWS"],
    ),
    (
        "Data Scientist",
        "AI & Data",
        ["Python", "Statistics", "Machine Learning"],
        ["Pandas", "NumPy", "Data Visualization"],
        ["Deep Learning", "SQL"],
    ),
    (
        "Data Analyst",
        "AI & Data",
        ["SQL", "Excel", "Data Analysis"],
        ["Data Visualization", "Power BI", "Statistics"],
        ["Tableau", "Python"],
    ),
    (
        "Data Engineer",
        "AI & Data",
        ["SQL", "ETL Pipelines", "Python"],
        ["Apache Spark", "Data Warehousing", "Data Modeling"],
        ["Apache Kafka", "AWS", "Docker"],
    ),
    # ---------------- الأمن السيبراني (Cybersecurity) ----------------
    (
        "Cybersecurity Analyst",
        "Cybersecurity",
        ["Cybersecurity Fundamentals", "Network Security", "Risk Assessment"],
        ["SIEM Tools", "Incident Response"],
        ["Cryptography", "Python"],
    ),
    (
        "SOC Analyst",
        "Cybersecurity",
        ["SIEM Tools", "Incident Response", "Network Security"],
        ["Cybersecurity Fundamentals", "Vulnerability Assessment"],
        ["Python", "Cryptography"],
    ),
    (
        "Penetration Tester",
        "Cybersecurity",
        ["Ethical Hacking", "Penetration Testing", "Vulnerability Assessment"],
        ["Network Security", "Python"],
        ["Cryptography", "Cybersecurity Fundamentals"],
    ),
    # ---------------- البنية التحتية والعمليات (Infrastructure & Ops) ----------------
    (
        "Cloud Engineer",
        "Infrastructure & Ops",
        ["AWS", "Cloud Architecture", "Linux Administration"],
        ["Docker", "Kubernetes", "Terraform"],
        ["CI/CD", "Azure", "GCP"],
    ),
    (
        "DevOps Engineer",
        "Infrastructure & Ops",
        ["Docker", "Kubernetes", "CI/CD"],
        ["AWS", "Linux Administration", "Terraform"],
        ["System Monitoring", "Python"],
    ),
    (
        "Network Engineer",
        "Infrastructure & Ops",
        ["Networking Fundamentals", "Routing & Switching", "Network Security"],
        ["Linux Administration", "System Monitoring"],
        ["Cloud Architecture", "AWS"],
    ),
    (
        "System Administrator",
        "Infrastructure & Ops",
        ["Linux Administration", "Networking Fundamentals", "Troubleshooting"],
        ["System Monitoring", "Backup & Recovery"],
        ["Docker", "AWS"],
    ),
    (
        "Database Administrator",
        "Infrastructure & Ops",
        ["SQL", "Database Administration", "Backup & Recovery"],
        ["MySQL", "PostgreSQL"],
        ["MongoDB", "Cloud Architecture"],
    ),
    # ---------------- الجودة والدعم (QA & Support) ----------------
    (
        "QA Engineer",
        "QA & Support",
        ["Manual Testing", "Test Planning", "Bug Tracking"],
        ["Test Automation", "Selenium"],
        ["Git", "CI/CD"],
    ),
    (
        "Technical Support Engineer",
        "QA & Support",
        ["Troubleshooting", "Customer Support", "Networking Fundamentals"],
        ["Bug Tracking", "Technical Writing"],
        ["Linux Administration", "SQL"],
    ),
    # ---------------- التصميم وتجربة المستخدم (Design) ----------------
    (
        "UI/UX Designer",
        "Design",
        ["UI Design", "UX Research", "Figma"],
        ["Prototyping", "Accessibility (WCAG)"],
        ["HTML/CSS", "Data Visualization"],
    ),
    # ---------------- الأنظمة المدمجة والتقنيات الناشئة (Embedded & Emerging Tech) ----------------
    (
        "Embedded Systems Engineer",
        "Embedded & Emerging Tech",
        ["Embedded C", "Microcontrollers", "RTOS"],
        ["C++", "Sensors & Actuators"],
        ["IoT Protocols (MQTT)", "Control Systems"],
    ),
    (
        "IoT Engineer",
        "Embedded & Emerging Tech",
        ["IoT Protocols (MQTT)", "Embedded C", "Sensors & Actuators"],
        ["Microcontrollers", "Python"],
        ["AWS", "Data Analysis"],
    ),
    (
        "Blockchain Developer",
        "Embedded & Emerging Tech",
        ["Blockchain Fundamentals", "Smart Contracts", "Solidity"],
        ["JavaScript", "Cryptography"],
        ["Node.js", "React"],
    ),
    (
        "AR/VR Developer",
        "Embedded & Emerging Tech",
        ["AR/VR SDKs", "3D Modeling", "Unity"],
        ["C++", "Unreal Engine"],
        ["Game Physics", "OOP"],
    ),
    (
        "Robotics Engineer",
        "Embedded & Emerging Tech",
        ["Robotics (ROS)", "Control Systems", "Embedded C"],
        ["Sensors & Actuators", "Python", "C++"],
        ["Machine Learning", "Computer Vision"],
    ),
    # ---------------- الإدارة والاستشارات (Management & Strategy) ----------------
    (
        "Solutions Architect",
        "Management & Strategy",
        ["System Design", "Solution Architecture", "Cloud Architecture"],
        ["API Design", "Microservices", "Stakeholder Management"],
        ["AWS", "Docker"],
    ),
    (
        "Business Analyst",
        "Management & Strategy",
        ["Requirements Gathering", "Business Process Modeling", "Stakeholder Management"],
        ["Data Analysis", "Technical Writing"],
        ["SQL", "Excel"],
    ),
    (
        "Product Manager",
        "Management & Strategy",
        ["Product Strategy", "Stakeholder Management", "Roadmap Planning"],
        ["Requirements Gathering", "Agile/Scrum"],
        ["Data Analysis", "Technical Writing"],
    ),
]
