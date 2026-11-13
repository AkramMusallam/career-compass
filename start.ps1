param(
    [switch]$Lan
)

Write-Host "Starting Career Compass AI Project..." -ForegroundColor Green

$scriptDir = $PSScriptRoot
if (-not (Test-Path (Join-Path $scriptDir "backend"))) {
    if (Test-Path (Join-Path $scriptDir "career-compass\backend")) {
        $scriptDir = Join-Path $scriptDir "career-compass"
    }
}

$backendDir = Join-Path $scriptDir "backend"
$frontendDir = Join-Path $scriptDir "frontend"
$bindHost = if ($Lan) { "0.0.0.0" } else { "127.0.0.1" }
$ollamaModel = if ($env:OLLAMA_MODEL) { $env:OLLAMA_MODEL } else { "llama3.2" }

$pythonCandidates = @(
    (Join-Path $backendDir "myenv\Scripts\python.exe"),
    (Join-Path $backendDir ".venv\Scripts\python.exe"),
    (Join-Path $backendDir "venv\Scripts\python.exe"),
    (Join-Path $scriptDir ".venv\Scripts\python.exe"),
    (Join-Path $scriptDir "venv\Scripts\python.exe")
)
$pythonExe = $pythonCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $pythonExe) {
    Write-Error "No Python virtual environment found. Create one in backend\myenv or .\venv first."
    exit 1
}

# 1. Start Ollama (in background or new window)
Write-Host "Ensuring Ollama local AI ($ollamaModel) is running..." -ForegroundColor Yellow
try {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "ollama run $ollamaModel"
} catch {
    Write-Host "Ollama could not be launched directly." -ForegroundColor Yellow
}

# 2. Start Backend in a new window
Write-Host "Starting Backend on http://${bindHost}:8000 ..." -ForegroundColor Yellow
$backendCmd = "`$env:PYTHONIOENCODING='utf-8'; `$env:USE_SQLITE_FALLBACK='1'; `$env:USE_MONGOMOCK='1'; if (-not `$env:OLLAMA_MODEL) { `$env:OLLAMA_MODEL='$ollamaModel' }; & '$pythonExe' -m uvicorn app.main:app --host $bindHost --port 8000 --reload"
Start-Process powershell -WorkingDirectory $backendDir -ArgumentList "-NoExit", "-Command", $backendCmd

# 3. Start Frontend in a new window
Write-Host "Starting Frontend on http://${bindHost}:5173 ..." -ForegroundColor Yellow
Start-Process powershell -WorkingDirectory $frontendDir -ArgumentList "-NoExit", "-Command", "npm run dev -- --host $bindHost --port 5173"

Start-Sleep -Seconds 2
try {
    Start-Process "http://localhost:5173"
} catch {}

Write-Host "All services started! Terminal windows have been opened." -ForegroundColor Green
Write-Host "You can view the website at: http://localhost:5173" -ForegroundColor Cyan
