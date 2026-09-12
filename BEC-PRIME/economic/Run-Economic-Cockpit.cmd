@echo off
REM Run-Economic-Cockpit.cmd
REM Launches the economic cockpit from the repo root regardless of
REM where the double-click happened. Fails loudly if node is missing.

setlocal

set "SCRIPT_DIR=%~dp0"
set "REPO_ROOT=%SCRIPT_DIR%..\.."

pushd "%REPO_ROOT%"

where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: node not found on PATH.
    echo Install Node.js or add it to PATH, then retry.
    popd
    exit /b 2
)

echo Running economic cockpit from %CD%
echo.

node "BEC-PRIME\economic\EconomicCockpit.js" %*
set "EXIT_CODE=%ERRORLEVEL%"

popd

if not "%EXIT_CODE%"=="0" (
    echo.
    echo Cockpit exited with code %EXIT_CODE%.
    echo Scroll up for the failure. Do not treat partial output as a run.
)

exit /b %EXIT_CODE%
