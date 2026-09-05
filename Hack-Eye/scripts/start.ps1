# SAHAYI — One-Click Start Script for Windows PowerShell
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  SAHAYI - AI Construction Safety Intelligence Platform" -ForegroundColor Green
Write-Host "  Starting Backend & Frontend Servers..." -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# 1. Add NVM / Node to PATH if needed
if (Test-Path "C:\Users\rohan\AppData\Local\nvm\v20.15.1") {
    $env:PATH = "C:\Users\rohan\AppData\Local\nvm\v20.15.1;" + $env:PATH
}

# 2. Set Python Path
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SahayiRoot = Split-Path -Parent $ScriptDir
$BackendDir = Join-Path $SahayiRoot "backend"
$FrontendDir = Join-Path $SahayiRoot "frontend"

$env:PYTHONPATH = $BackendDir

Write-Host "[1/3] Initializing Database & Seed Data..." -ForegroundColor Yellow
python -c "from app.database.database import init_db; from app.database.seed import seed_database; init_db(); seed_database()"

Write-Host "[2/3] Launching FastAPI Backend on http://localhost:8001..." -ForegroundColor Green
$BackendJob = Start-Process -FilePath "python" -ArgumentList "-m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload" -WorkingDirectory $BackendDir -PassThru

Write-Host "[3/3] Launching React Vite Frontend on http://localhost:3000..." -ForegroundColor Green
$FrontendJob = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev" -WorkingDirectory $FrontendDir -PassThru

Write-Host "`n>>> SAHAYI SYSTEM IS ONLINE! <<<" -ForegroundColor Green
Write-Host "Dashboard:         http://localhost:3000/" -ForegroundColor Cyan
Write-Host "Worker Kiosk:      http://localhost:3000/kiosk" -ForegroundColor Cyan
Write-Host "Supervisor Mobile: http://localhost:3000/mobile" -ForegroundColor Cyan
Write-Host "Demo Controller:   http://localhost:3000/demo" -ForegroundColor Cyan
Write-Host "Backend API Docs:  http://localhost:8001/docs" -ForegroundColor Cyan
Write-Host "`nPress Ctrl+C or close this window to exit." -ForegroundColor Yellow

try {
    Wait-Process -Id $BackendJob.Id, $FrontendJob.Id
} finally {
    Stop-Process -Id $BackendJob.Id -ErrorAction SilentlyContinue
    Stop-Process -Id $FrontendJob.Id -ErrorAction SilentlyContinue
}
