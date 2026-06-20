@echo off
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "C:\BrownEyeCortex\modules\Foundation\bin\Verify-FoundationalEngines.ps1"
echo VERIFY_EXIT=%ERRORLEVEL%
pause
