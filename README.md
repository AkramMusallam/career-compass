# Career Compass 🚀

Career Compass is an AI-driven career guidance platform that helps users discover their optimal career paths by intelligently analyzing their resumes (CVs).

Built as a full-stack web application, it goes beyond traditional keyword matching by leveraging local Generative AI (Ollama) to deeply understand a user\'s skills, experiences, and education, matching them against industry standards to provide highly personalized 3-month learning roadmaps.

## ✨ Key Features
- **AI-Powered CV Parsing:** Integrates with local LLMs (Ollama Llama 3.2) to extract structured data from PDF resumes intelligently.
- **Dynamic Recommendation Engine:** AI-generated personalized 3-month learning roadmaps based on identified skill gaps.
- **Automated Background Jobs:** Uses Celery and Redis to handle asynchronous tasks such as weekly career updates and password reset emails.
- **Robust Security:** JWT-based authentication, secure stateless password resets, and bcrypt password hashing.
- **Code Splitting & Performance:** Optimized React frontend with Vite, lazy loading, and suspense boundaries.
- **CI/CD Pipeline:** Fully integrated GitHub Actions workflow for automated Pytest execution and frontend builds.

## 🛠️ Tech Stack
- **Frontend:** React 18, Vite, React Router, Tailwind CSS, Recharts
- **Backend:** FastAPI (Python), SQLAlchemy, Alembic
- **AI Engine:** Ollama (Llama 3.2)
- **Database:** MySQL / SQLite (fallback), MongoDB / Mongomock (fallback)
- **Background Tasks:** Celery, Redis
- **Testing & CI/CD:** Pytest, GitHub Actions

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js (v20+)
- Python (3.11+)
- Ollama installed locally (with llama3.2 model pulled)

### 1. Start the Local AI
`ash
ollama run llama3.2
`

### 2. Run the Backend (FastAPI)
`ash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\\Scripts\\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
`
*(Note: For testing without MySQL/Redis, set environment variables USE_SQLITE_FALLBACK=1 and USE_MONGOMOCK=1)*

### 3. Run the Frontend (React/Vite)
`ash
cd frontend
npm install
npm run dev
`

Visit http://localhost:5173 to explore the application!

## 🧪 Testing
The project is thoroughly tested using pytest.
`ash
cd backend
pytest tests/ -v
`
