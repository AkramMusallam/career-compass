Write-Host "Starting Career Compass AI Project..." -ForegroundColor Green

# Start Backend in a new window
Write-Host "Starting Backend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; `$env:USE_SQLITE_FALLBACK='1'; `$env:USE_MONGOMOCK='1'; ..\..\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000"

# Start Frontend in a new window
Write-Host "Starting Frontend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

Write-Host "Project is starting! Please ensure Ollama is running in your Windows tray." -ForegroundColor Green
Write-Host "You can view the website at: http://localhost:5173" -ForegroundColor Cyan
