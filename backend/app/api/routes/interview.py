from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List
import uuid
import ollama
from datetime import datetime, timezone

from app.core.security import get_current_user
from app.models.mysql_models import User
from app.core.mongo import analysis_results_collection, mongo_db

router = APIRouter(tags=["Mock Interview"])

interviews_collection = mongo_db["interviews"]

class InterviewStartRequest(BaseModel):
    analysis_id: str
    job_title: str

class InterviewMessage(BaseModel):
    role: str
    content: str

class InterviewStartResponse(BaseModel):
    session_id: str
    messages: List[InterviewMessage]

class InterviewChatRequest(BaseModel):
    session_id: str
    message: str

class InterviewChatResponse(BaseModel):
    messages: List[InterviewMessage]

@router.post("/interview/start", response_model=InterviewStartResponse)
def start_interview(payload: InterviewStartRequest, current_user: User = Depends(get_current_user)):
    analysis = analysis_results_collection.find_one({"analysis_id": payload.analysis_id, "user_id": current_user.id})
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    cv_summary = f"Skills: {analysis.get('skills', [])}"
    
    system_prompt = f"You are an expert technical interviewer hiring for the position of {payload.job_title}. The candidate's background: {cv_summary}. Ask one interview question at a time. Start by introducing yourself briefly and asking the first question."
    
    session_id = str(uuid.uuid4())
    initial_messages = [{"role": "system", "content": system_prompt}]
    
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
            response = ollama.chat(model='llama3.2', messages=initial_messages)
            ai_reply = response['message']['content']
    except Exception as e:

        ai_reply = "Hello! I will be your interviewer today. Unfortunately, my AI engine is currently down, but let's pretend I asked you about your past experience. What is your greatest strength?"
        
    messages_to_save = [
        {"role": "system", "content": system_prompt},
        {"role": "assistant", "content": ai_reply}
    ]
    
    interviews_collection.insert_one({
        "session_id": session_id,
        "user_id": current_user.id,
        "analysis_id": payload.analysis_id,
        "job_title": payload.job_title,
        "messages": messages_to_save,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Exclude system prompt from response to user
    return InterviewStartResponse(
        session_id=session_id,
        messages=[InterviewMessage(**m) for m in messages_to_save if m["role"] != "system"]
    )

@router.post("/interview/chat", response_model=InterviewChatResponse)
def chat_interview(payload: InterviewChatRequest, current_user: User = Depends(get_current_user)):
    session = interviews_collection.find_one({"session_id": payload.session_id, "user_id": current_user.id})
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")
        
    messages = session["messages"]
    messages.append({"role": "user", "content": payload.message})
    
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
            response = ollama.chat(model='llama3.2', messages=messages)
            ai_reply = response['message']['content']
    except Exception as e:

        ai_reply = "I'm having trouble processing that right now."
        
    messages.append({"role": "assistant", "content": ai_reply})
    
    interviews_collection.update_one(
        {"session_id": payload.session_id},
        {"$set": {"messages": messages, "updated_at": datetime.now(timezone.utc)}}
    )
    
    return InterviewChatResponse(
        messages=[InterviewMessage(**m) for m in messages if m["role"] != "system"]
    )
