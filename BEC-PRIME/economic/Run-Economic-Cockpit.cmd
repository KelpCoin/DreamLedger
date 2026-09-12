@echo off
setlocal
cd /d "%~dp0..\.."
node BEC-PRIME\economic\EconomicCockpit.js
set "CODE=%ERRORLEVEL%"
if not "%CODE%"=="0" (
  echo.
  echo Economic cockpit exited with code %CODE%.
  echo No external action was performed.
)
echo.
pause
exit /b %CODE%
