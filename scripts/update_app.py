import re

with open('frontend/src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

if 'Interview' not in content:
    content = content.replace('const Results = lazy(() => import("./pages/Results"));', 'const Results = lazy(() => import("./pages/Results"));\nconst Interview = lazy(() => import("./pages/Interview"));')
    
    content = content.replace('<Route path="/results/:analysisId" element={<Results />} />', '<Route path="/results/:analysisId" element={<Results />} />\n          <Route path="/interview/:sessionId" element={<Interview />} />')

with open('frontend/src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)