@echo off
cd /d "%~dp0"
where pwsh >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:3100
  pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
) else (
  start "" http://localhost:3100
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
)
