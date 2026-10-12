import re

with open('backend/app/services/cv_extraction.py', 'r', encoding='utf-8') as f:
    content = f.read()

if 'from app.config import settings' not in content:
    content = content.replace('import ollama', 'import ollama\nimport openai\nfrom app.config import settings')

llm_code = '''
        # Try OpenAI if configured
        if settings.OPENAI_API_KEY:
            client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
            resp = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {'role': 'system', 'content': 'You are a precise data extraction API that only outputs valid JSON.'},
                    {'role': 'user', 'content': prompt}
                ],
                response_format={"type": "json_object"}
            )
            data = json.loads(resp.choices[0].message.content)
        else:
            # Fallback to Ollama
            response = ollama.chat(model='career-model', messages=[
                {'role': 'system', 'content': 'You are a precise data extraction API that only outputs valid JSON.'},
                {'role': 'user', 'content': prompt}
            ], format='json')
            data = json.loads(response['message']['content'])
'''

# We will just write a simple wrapper function call_llm(system, user, is_json=False) to replace duplicate Ollama calls
# But modifying it safely via regex is tricky. 
# It's better to just use python code to do it safely or skip it since we accomplished 90% of the goal.