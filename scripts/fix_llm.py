import os
import re

with open("backend/app/services/cv_extraction.py", "r", encoding="utf-8") as f:
    content = f.read()

# Make sure openai and settings are imported
if "import openai" not in content:
    # find import ollama
    content = content.replace("import ollama", "import ollama\nimport openai\nfrom app.core.config import settings")

# Add call_llm wrapper
call_llm_code = '''
def call_llm(prompt: str, system_prompt: str, is_json: bool = False) -> str:
    """Wrapper to call OpenAI if configured, otherwise fallback to Ollama."""
    # Try OpenAI first
    if settings.OPENAI_API_KEY:
        try:
            client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
            kwargs = {
                "model": "gpt-3.5-turbo",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.7
            }
            if is_json:
                kwargs["response_format"] = {"type": "json_object"}
            
            resp = client.chat.completions.create(**kwargs)
            return resp.choices[0].message.content
        except Exception as e:
            logger.warning(f"OpenAI fallback failed: {e}. Trying Ollama...")

    # Fallback to Ollama
    try:
        kwargs = {
            "model": "career-model",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ]
        }
        if is_json:
            kwargs["format"] = "json"
            
        response = ollama.chat(**kwargs)
        return response['message']['content']
    except Exception as e:
        logger.warning(f"Ollama local extraction failed: {e}")
        raise e
'''

if "def call_llm" not in content:
    content = content.replace("logger = logging.getLogger(__name__)", "logger = logging.getLogger(__name__)\n\n" + call_llm_code)

# Update _extract_with_ollama
ollama_extract_old = '''    try:
        # We assume the user has a fast local model like llama3.2 or qwen installed
        response = ollama.chat(model='llama3.2', messages=[
            {'role': 'system', 'content': 'You are a precise data extraction API that only outputs valid JSON.'},
            {'role': 'user', 'content': prompt}
        ], format='json')
        
        data = json.loads(response['message']['content'])'''
ollama_extract_new = '''    try:
        content = call_llm(prompt, 'You are a precise data extraction API that only outputs valid JSON.', is_json=True)
        data = json.loads(content)'''
content = content.replace(ollama_extract_old, ollama_extract_new)

# Update evaluate_ats_score
ats_old = '''    try:
        response = ollama.chat(model='llama3.2', messages=[
            {'role': 'system', 'content': 'You are a precise JSON-only ATS evaluator.'},
            {'role': 'user', 'content': prompt}
        ], format='json')
        import json
        data = json.loads(response['message']['content'])'''
ats_new = '''    try:
        content = call_llm(prompt, 'You are a precise JSON-only ATS evaluator.', is_json=True)
        import json
        data = json.loads(content)'''
content = content.replace(ats_old, ats_new)

# Update generate_cover_letter
cv_old = '''    try:
        response = ollama.chat(model='llama3.2', messages=[
            {'role': 'system', 'content': 'You are a professional cover letter writer.'},
            {'role': 'user', 'content': prompt}
        ])
        return response['message']['content'].strip()'''
cv_new = '''    try:
        content = call_llm(prompt, 'You are a professional cover letter writer.', is_json=False)
        return content.strip()'''
content = content.replace(cv_old, cv_new)

with open("backend/app/services/cv_extraction.py", "w", encoding="utf-8") as f:
    f.write(content)
print("LLM Wrapper updated.")