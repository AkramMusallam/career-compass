# Deploy Career Compass - one‑click start script
# -------------------------------------------------
# 1️⃣ Start Ollama (AI model server)
Start-Process -FilePath "ollama" -ArgumentList "serve" -NoNewWindow -PassThru | Out-Null
Write-Host "Ollama server started (listening on 127.0.0.1:11434)"

# 2️⃣ Start FastAPI backend (use the virtual‑env created in backend\myenv)
$backendDir = "C:\Users\msi\Downloads\career-compass\career-compass\backend"
Set-Location $backendDir
Start-Process -FilePath "$backendDir\myenv\Scripts\python.exe" -ArgumentList "-m uvicorn app.main:app --host 0.0.0.0 --port 8000" -NoNewWindow -PassThru | Out-Null
Write-Host "Backend started at http://0.0.0.0:8000"

# 3️⃣ Start frontend dev server (Vite/React)
$frontendDir = "C:\Users\msi\Downloads\career-compass\career-compass\frontend"
Set-Location $frontendDir
# Ensure node_modules are present – install if missing
if (-not (Test-Path "node_modules")) {
    npm install
}
Start-Process -FilePath "npm" -ArgumentList "run dev -- --host 0.0.0.0 --port 5173" -NoNewWindow -PassThru | Out-Null
Write-Host "Frontend dev server started at http://0.0.0.0:5173"

Write-Host "All services launched. Access the UI via http://<your‑host>:5173"
