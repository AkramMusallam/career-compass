import re
with open('backend/app/main.py', 'r', encoding='utf-8') as f:
    content = f.read()

if 'interview' not in content:
    content = content.replace('from app.routers import analyze, assessment, auth, benchmark, cv, history, profile, settings_router, shared', 'from app.routers import analyze, assessment, auth, benchmark, cv, history, profile, settings_router, shared, interview')
    content = content.replace('app.include_router(benchmark.router)', 'app.include_router(benchmark.router)\napp.include_router(interview.router)')

with open('backend/app/main.py', 'w', encoding='utf-8') as f:
    f.write(content)