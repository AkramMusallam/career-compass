import re

with open('backend/app/config.py', 'r', encoding='utf-8') as f:
    content = f.read()

if 'OPENAI_API_KEY' not in content:
    content = content.replace('MONGO_DB: str = "career_compass"', 'MONGO_DB: str = "career_compass"\n    OPENAI_API_KEY: str = ""')

with open('backend/app/config.py', 'w', encoding='utf-8') as f:
    f.write(content)