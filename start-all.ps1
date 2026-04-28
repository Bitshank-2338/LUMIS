# LUMIS — start all services on Windows
# Each service launches in its own PowerShell window.

$ROOT = $PSScriptRoot

Write-Host "[LUMIS] Starting Audit backend (port 5002)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ROOT\backend'; python run.py"

Write-Host "[LUMIS] Starting mock biased model (port 6001)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ROOT\backend'; python -m demo.mock_biased_model"

Write-Host "[LUMIS] Starting Crisis backend (port 5003)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ROOT\crisis\backend'; python run.py"

Write-Host "[LUMIS] Starting frontend (port 3001)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ROOT\frontend'; npm run dev"

Write-Host ""
Write-Host "===========================================================" -ForegroundColor Green
Write-Host " LUMIS up and running" -ForegroundColor Green
Write-Host "===========================================================" -ForegroundColor Green
Write-Host " Frontend:        http://localhost:3001"
Write-Host " Audit Dashboard: http://localhost:3001/dashboard"
Write-Host " Crisis Center:   http://localhost:3001/crisis"
Write-Host " Audit API:       http://localhost:5002"
Write-Host " Crisis API:      http://localhost:5003"
Write-Host " Mock model:      http://localhost:6001"
Write-Host "===========================================================" -ForegroundColor Green
