import re

with open('frontend/src/pages/Results.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

if 'startInterview' not in content:
    content = content.replace('import { generateCoverLetter } from "../api/endpoints";', 'import { generateCoverLetter, startInterview } from "../api/endpoints";')

handler_code = '''
  const [isStartingInterview, setIsStartingInterview] = useState(false);

  const handleStartInterview = async (jobTitle) => {
    setIsStartingInterview(true);
    try {
      const res = await startInterview(analysisId, jobTitle);
      navigate(/interview/);
    } catch (err) {
      showToast(getErrorMessage(err, "حدث خطأ أثناء بدء المقابلة."), "error");
    } finally {
      setIsStartingInterview(false);
    }
  };
'''

if 'handleStartInterview' not in content:
    idx = content.find('const [coverLetterJob')
    content = content[:idx] + handler_code + content[idx:]

button_code = '''
                <button 
                  type="button" 
                  onClick={() => handleStartInterview(job.job_title)}
                  disabled={isStartingInterview}
                  className="btn-outline text-xs px-2 py-1 mt-2 w-full"
                >
                  🎤 محاكاة مقابلة عمل (AI Interview)
                </button>
'''
if 'محاكاة مقابلة عمل' not in content:
    content = content.replace('✉️ توليد خطاب تغطية (Cover Letter)\n                </button>', '✉️ توليد خطاب تغطية (Cover Letter)\n                </button>\n' + button_code)

with open('frontend/src/pages/Results.jsx', 'w', encoding='utf-8') as f:
    f.write(content)