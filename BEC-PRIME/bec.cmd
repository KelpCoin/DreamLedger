@echo off
setlocal
cd /d "%~dp0"
node bec.js %*
exit /b %ERRORLEVEL%
