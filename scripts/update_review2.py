import re

header = '''import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { getErrorMessage } from "../api/client";
import { confirmExtraction, getAtsScore } from "../api/endpoints";
import Stepper from "../components/Stepper";
import { useAnalysisFlow } from "../context/AnalysisContext";

function AtsScoreSection({ extractionId }) {
  const [scoreData, setScoreData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    getAtsScore(extractionId)
      .then((res) => {
        if (isMounted) {
          setScoreData(res.data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) setLoading(false);
      });
    return () => { isMounted = false; };
  }, [extractionId]);

  if (loading) return <div className="card"><h2 className="mb-3 font-black text-slate-800">ATS Score</h2><p className="text-slate-500">جاري تقييم السيرة الذاتية (ATS)...</p></div>;
  if (!scoreData) return null;

  return (
    <section className="card bg-primary-50 border-primary-100">
      <h2 className="mb-3 font-black text-primary-900">مقياس توافق السيرة الذاتية (ATS Score)</h2>
      <div className="flex items-center gap-4 mb-4">
        <div className={	ext-4xl font-black }>
          {scoreData.score}%
        </div>
        <p className="text-sm text-slate-600">
          هذا التقييم يوضح مدى توافق سيرتك الذاتية مع أنظمة الفرز الآلي (ATS).
        </p>
      </div>
      {scoreData.feedback && scoreData.feedback.length > 0 && (
        <div>
          <h3 className="font-bold text-slate-700 mb-2">ملاحظات التحسين:</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
            {scoreData.feedback.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}
'''

with open('frontend/src/pages/ReviewExtractedData.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'import { useState(?:, useEffect)? } from "react";.*?import { useAnalysisFlow } from "../context/AnalysisContext";(\n\nfunction AtsScoreSection[^\n]*\n.*?\n})?', header, content, flags=re.DOTALL)

with open('frontend/src/pages/ReviewExtractedData.jsx', 'w', encoding='utf-8') as f:
    f.write(content)