@echo off
setlocal
cd /d "%~dp0..\.."
if defined STRIPE_SECRET_KEY (
  echo REFUSED: STRIPE_SECRET_KEY is not permitted for the economic cockpit.
  echo Use a restricted read-only Stripe key in STRIPE_READONLY_KEY.
  exit /b 2
)
if not defined STRIPE_READONLY_KEY (
  echo REFUSED: STRIPE_READONLY_KEY is not set.
  echo The cockpit will not inspect Stripe without a read-only key.
  exit /b 2
)
node BEC-PRIME\economic\EconomicCockpit.js
set "CODE=%ERRORLEVEL%"
echo.
if not "%CODE%"=="0" echo Economic cockpit exited with code %CODE%. No external action was performed.
echo Evidence is under D:\BrownEyeCortex\EconomicCockpit
echo.
pause
exit /b %CODE%
