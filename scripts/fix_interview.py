import os
import re

with open("backend/app/api/routes/interview.py", "r", encoding="utf-8") as f:
    content = f.read()

# Add OpenAI fallback logic directly here as it maintains conversation history which call_llm doesn't do natively unless modified.
# Actually, it's easier to modify call_llm to accept full message history. But let's just add OpenAI support inline to interview.py for now.
# Wait, let's just make it robust inline.

new_logic = '''
    try:
        from app.core.config import settings
        import openai
        
        if settings.OPENAI_API_KEY:
            client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
            resp = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=initial_messages
            )
            ai_reply = resp.choices[0].message.content
        else:
            response = ollama.chat(model='career-model', messages=initial_messages)
            ai_reply = response['message']['content']
    except Exception as e:
'''

if "openai.OpenAI" not in content:
    content = content.replace('''
    try:
        response = ollama.chat(model='career-model', messages=initial_messages)
        ai_reply = response['message']['content']
    except Exception as e:''', new_logic)

new_chat_logic = '''
    try:
        from app.core.config import settings
        import openai
        
        if settings.OPENAI_API_KEY:
            client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
            resp = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=messages
            )
            ai_reply = resp.choices[0].message.content
        else:
            response = ollama.chat(model='career-model', messages=messages)
            ai_reply = response['message']['content']
    except Exception as e:
'''

if "openai.OpenAI" in new_logic and "client = openai.OpenAI" not in content[content.find("chat_interview"):]:
    content = content.replace('''
    try:
        response = ollama.chat(model='career-model', messages=messages)
        ai_reply = response['message']['content']
    except Exception as e:''', new_chat_logic)

with open("backend/app/api/routes/interview.py", "w", encoding="utf-8") as f:
    f.write(content)
print("Interview LLM updated.")