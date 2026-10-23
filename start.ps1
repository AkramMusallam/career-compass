Write-Host "Starting Career Compass AI Project..." -ForegroundColor Green

$scriptDir = $PSScriptRoot
if (-not (Test-Path (Join-Path $scriptDir "backend"))) {
    if (Test-Path (Join-Path $scriptDir "career-compass\backend")) {
        $scriptDir = Join-Path $scriptDir "career-compass"
    }
}

$backendDir = Join-Path $scriptDir "backend"
$frontendDir = Join-Path $scriptDir "frontend"

# 1. Start Ollama (in background or new window)
Write-Host "Ensuring Ollama local AI is running..." -ForegroundColor Yellow
try {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "ollama run career-model"
} catch {
    Write-Host "Ollama could not be launched directly." -ForegroundColor Yellow
}

# 2. Start Backend in a new window
Write-Host "Starting Backend..." -ForegroundColor Yellow
Start-Process powershell -WorkingDirectory $backendDir -ArgumentList "-NoExit", "-Command", "`$env:PYTHONIOENCODING='utf-8'; `$env:USE_SQLITE_FALLBACK='1'; `$env:USE_MONGOMOCK='1'; .\myenv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

# 3. Start Frontend in a new window
Write-Host "Starting Frontend..." -ForegroundColor Yellow
Start-Process powershell -WorkingDirectory $frontendDir -ArgumentList "-NoExit", "-Command", "`$env:VITE_API_BASE_URL='http://localhost:8000'; npm run dev -- --host 0.0.0.0 --port 5173"

Start-Sleep -Seconds 2
try {
    Start-Process "http://localhost:5173"
} catch {}

Write-Host "All services started! Terminal windows have been opened." -ForegroundColor Green
Write-Host "You can view the website at: http://localhost:5173" -ForegroundColor Cyan