@echo off
setlocal
set "SCRIPT=%~dp0Start-BECPrimeOrchestra.ps1"
if not exist "%SCRIPT%" (
  echo ERROR: Start-BECPrimeOrchestra.ps1 was not found beside this launcher.
  pause
  exit /b 2
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%SCRIPT%" -Install
exit /b %errorlevel%
