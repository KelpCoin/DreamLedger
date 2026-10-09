@echo off
setlocal
set "SCRIPT=%~dp0Start-BECPrimeOrchestra.ps1"
if not exist "%SCRIPT%" (
  echo ERROR: Start-BECPrimeOrchestra.ps1 was not found beside this launcher.
  pause
  exit /b 2
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" -Install
if errorlevel 1 (
  echo Startup did not pass. The recovery task was installed first; inspect the log and proof under BrownEyeCortex\Runtime.
  pause
  exit /b 1
)
echo Startup completed. The local runtime will retry at your next Windows logon.
exit /b 0
