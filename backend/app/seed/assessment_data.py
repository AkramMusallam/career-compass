"""
الأسئلة التقييمية الافتراضية (8-10 أسئلة كما هو محدد في الواجهة 6).
كل سؤال: (النص, النوع, الخيارات[], إلزامي؟, related_skill(اسم مهارة أو None), dna_axis أو None)

- أسئلة single_choice/multiple_choice المرتبطة بمهارة (related_skill) تُغذّي assessment_bonus
  لتلك المهارة تحديداً في معادلة skill_proficiency (القسم 6.2)، عبر bonus_points على كل خيار.
- أسئلة scale المرتبطة بـ dna_axis ("communication" أو "problem_solving") تُستخدم مباشرة
  كقيمة لمحوري Communication و Problem Solving في Career DNA.
"""

QUESTIONS: list[dict] = [
    {
        "text": "ما هو أسلوب العمل المفضّل لديك؟",
        "type": "single_choice",
        "options": ["العمل الفردي المركّز", "العمل الجماعي التفاعلي", "مزيج من الاثنين"],
        "required": True,
        "related_skill": None,
        "dna_axis": None,
    },
    {
        "text": "قيّم مهاراتك في التواصل والعرض أمام الآخرين (1 = ضعيف، 5 = ممتاز)",
        "type": "scale",
        "options": [],
        "required": True,
        "related_skill": None,
        "dna_axis": "communication",
    },
    {
        "text": "قيّم قدرتك على حل المشكلات التقنية المعقدة بشكل مستقل (1 = ضعيف، 5 = ممتاز)",
        "type": "scale",
        "options": [],
        "required": True,
        "related_skill": None,
        "dna_axis": "problem_solving",
    },
    {
        "text": "ما مدى إلمامك العملي بلغة Python؟",
        "type": "single_choice",
        "options": ["لا أعرفها", "مبتدئ", "متوسط", "متقدم"],
        "required": False,
        "related_skill": "Python",
        "dna_axis": None,
    },
    {
        "text": "ما مدى إلمامك العملي بقواعد البيانات (SQL)؟",
        "type": "single_choice",
        "options": ["لا أعرفها", "مبتدئ", "متوسط", "متقدم"],
        "required": False,
        "related_skill": "SQL",
        "dna_axis": None,
    },
    {
        "text": "أي من مجالات العمل التالية تجذبك أكثر؟ (يمكن اختيار أكثر من واحد)",
        "type": "multiple_choice",
        "options": [
            "بناء واجهات المستخدم",
            "بناء الخدمات والأنظمة الخلفية",
            "تحليل البيانات والذكاء الاصطناعي",
            "البنية التحتية والسحابة",
            "الأمن السيبراني",
        ],
        "required": True,
        "related_skill": None,
        "dna_axis": None,
    },
    {
        "text": "كم عدد ساعات التعلم الذاتي التي تخصصها أسبوعياً لتطوير مهاراتك التقنية؟",
        "type": "single_choice",
        "options": ["أقل من ساعتين", "2-5 ساعات", "6-10 ساعات", "أكثر من 10 ساعات"],
        "required": True,
        "related_skill": None,
        "dna_axis": None,
    },
    {
        "text": "هل شاركت في مسابقات برمجية أو مشاريع مفتوحة المصدر؟",
        "type": "single_choice",
        "options": ["لا، لم أشارك", "شاركت مرة أو مرتين", "أشارك بشكل منتظم"],
        "required": False,
        "related_skill": None,
        "dna_axis": None,
    },
    {
        "text": "ما هو حجم الفريق الذي تفضل العمل ضمنه؟",
        "type": "single_choice",
        "options": ["فريق صغير (2-4 أشخاص)", "فريق متوسط (5-10 أشخاص)", "فريق كبير (أكثر من 10)"],
        "required": False,
        "related_skill": None,
        "dna_axis": None,
    },
    {
        "text": "قيّم مدى راحتك في تصميم بنية نظام (System Design) من الصفر (1 = ضعيف، 5 = ممتاز)",
        "type": "scale",
        "options": [],
        "required": False,
        "related_skill": None,
        "dna_axis": None,
    },
]

# نقاط bonus_points لكل خيار من أسئلة single_choice المرتبطة بمهارة — تُستخدم في assessment_bonus
SKILL_QUESTION_OPTION_BONUS = {
    "لا أعرفها": 0,
    "مبتدئ": 3,
    "متوسط": 6,
    "متقدم": 10,
}
