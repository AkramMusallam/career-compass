import json
import re

with open('frontend/src/pages/Results.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

if 'generateCoverLetter' not in content:
    content = content.replace('import { getErrorMessage } from "../api/client";', 'import { getErrorMessage } from "../api/client";\nimport { generateCoverLetter } from "../api/endpoints";')

modal_state_code = '''
  const [coverLetterJob, setCoverLetterJob] = useState(null);
  const [coverLetterText, setCoverLetterText] = useState("");
  const [isGeneratingCL, setIsGeneratingCL] = useState(false);

  const handleGenerateCoverLetter = async (jobTitle) => {
    setCoverLetterJob(jobTitle);
    setCoverLetterText("");
    setIsGeneratingCL(true);
    try {
      const res = await generateCoverLetter(analysisId, jobTitle);
      setCoverLetterText(res.data.cover_letter);
    } catch (err) {
      setCoverLetterText(getErrorMessage(err, "حدث خطأ أثناء توليد خطاب التغطية."));
    } finally {
      setIsGeneratingCL(false);
    }
  };

  const closeCoverLetterModal = () => {
    setCoverLetterJob(null);
    setCoverLetterText("");
  };
'''

if 'const [coverLetterJob' not in content:
    idx = content.find('export default function Results() {')
    if idx != -1:
        idx2 = content.find('\n', idx)
        content = content[:idx2+1] + modal_state_code + content[idx2+1:]

button_code = '''
                <button 
                  type="button" 
                  onClick={() => handleGenerateCoverLetter(job.job_title)}
                  className="btn-outline text-xs px-2 py-1 mt-3 w-full"
                >
                  ✉️ توليد خطاب تغطية (Cover Letter)
                </button>
'''
if 'توليد خطاب تغطية' not in content:
    content = content.replace('{job.explanation && (', button_code + '                {job.explanation && (')

modal_jsx = '''
      {/* Cover Letter Modal */}
      {coverLetterJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-black text-slate-800">خطاب تغطية: {coverLetterJob}</h2>
              <button onClick={closeCoverLetterModal} className="text-slate-400 hover:text-danger">✕</button>
            </div>
            {isGeneratingCL ? (
              <div className="py-12 text-center text-slate-500">
                <p className="animate-pulse">جاري توليد خطاب التغطية بالذكاء الاصطناعي...</p>
              </div>
            ) : (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 whitespace-pre-wrap text-slate-700 text-sm font-mono" dir="auto">
                {coverLetterText}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button type="button" className="btn-primary" onClick={() => { navigator.clipboard.writeText(coverLetterText); alert('تم النسخ!'); }}>
                📋 نسخ النص
              </button>
            </div>
          </div>
        </div>
      )}
'''
if 'Cover Letter Modal' not in content:
    last_div = content.rfind('</div>')
    if last_div != -1:
        content = content[:last_div] + modal_jsx + content[last_div:]

with open('frontend/src/pages/Results.jsx', 'w', encoding='utf-8') as f:
    f.write(content)