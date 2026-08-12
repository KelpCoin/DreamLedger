# Start-MoneyMachine.ps1
# One-command local boot for the BEC autonomy loop.
# Compilation is automatic. External/public/payment actions remain approval-gated.

[CmdletBinding()]
param(
    [switch]$NoLoop
)

$ErrorActionPreference = "Stop"
$Root = "D:\BrownEyeCortex\BEC-PRIME"
$Autonomy = Join-Path $Root "autonomy"
$Controller = Join-Path $Autonomy "BEC-AUTONOMY-CONTROLLER.ps1"
$Verifier = Join-Path $Autonomy "Verify-BEC-Autonomy.ps1"
$Compiler = Join-Path $Root "scripts\Compile-All.ps1"
$Queue = Join-Path $Autonomy "QUEUE"
$LogDir = Join-Path $Autonomy "LOGS"

New-Item -ItemType Directory -Force -Path $Queue,$LogDir | Out-Null

Write-Host "=== BEC MONEY MACHINE ===" -ForegroundColor Cyan
Write-Host "Root: $Root"

if (-not (Test-Path $Controller)) { throw "Missing controller: $Controller" }
if (-not (Test-Path $Verifier)) { throw "Missing verifier: $Verifier" }
if (-not (Test-Path $Compiler)) { throw "Missing compiler: $Compiler" }

Write-Host "[1/4] Compiling DreamLedger + BEC-PRIME surfaces..." -ForegroundColor Yellow
& $Compiler
if ($LASTEXITCODE -ne 0) { throw "Compilation failed." }

Write-Host "[2/4] Verifying autonomy..." -ForegroundColor Yellow
& $Verifier
if ($LASTEXITCODE -ne 0) { throw "Autonomy verification failed." }

Write-Host "[3/4] Checking LM Studio..." -ForegroundColor Yellow
try {
    $models = Invoke-RestMethod -Uri "http://127.0.0.1:1234/v1/models" -Method Get -TimeoutSec 3
    Write-Host "LM Studio API: PASS" -ForegroundColor Green
} catch {
    throw "LM Studio is not responding at http://127.0.0.1:1234/v1/models. Start LM Studio/llmster first."
}

Write-Host "[4/4] Starting controller..." -ForegroundColor Yellow
Push-Location $Autonomy
try {
    if ($NoLoop) {
        & $Controller
    } else {
        & $Controller -Loop
    }
    if ($LASTEXITCODE -ne 0) { throw "Controller exited with code $LASTEXITCODE." }
} finally {
    Pop-Location
}

Write-Host "Money machine stopped." -ForegroundColor Cyan
