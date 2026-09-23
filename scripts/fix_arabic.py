import re
with open("frontend/src/App.jsx", "r", encoding="utf-8") as f:
    content = f.read()

content = re.sub(r'fallback=\{<div className="flex h-screen items-center justify-center">.*?</div>\}', 'fallback={<div className="flex h-screen items-center justify-center text-xl font-bold text-primary-600">جاري التحميل...</div>}', content)

with open("frontend/src/App.jsx", "w", encoding="utf-8") as f:
    f.write(content)