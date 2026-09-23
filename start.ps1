Write-Host "Starting Career Compass AI Project..." -ForegroundColor Green

# 1. Start Ollama (in background or new window)
Write-Host "Ensuring Ollama local AI is running..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "ollama run llama3.2"

# 2. Start Backend in a new window
Write-Host "Starting Backend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; `$env:USE_SQLITE_FALLBACK='1'; `$env:USE_MONGOMOCK='1'; myenv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000"

# 3. Start Frontend in a new window
Write-Host "Starting Frontend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

Write-Host "All services started! 3 windows have been opened." -ForegroundColor Green
Write-Host "You can view the website at: http://localhost:5173" -ForegroundColor Cyan