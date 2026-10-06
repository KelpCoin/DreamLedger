# Start-MoneyMachine.ps1
# One-command local boot for the BEC autonomy loop.
# Compilation is automatic. External/public/payment actions remain approval-gated.

[CmdletBinding()]
param(
    [switch]$NoLoop
)

$ErrorActionPreference = "Stop"
$Root = "D:\BrownEyeCortex\BEC-PRIME"
$RepoRoot = Split-Path -Parent $Root
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

Write-Host "[3/4] Booting LM Studio/llmster dynamically..." -ForegroundColor Yellow
$lms = Get-Command lms -ErrorAction SilentlyContinue
if (-not $lms) { throw "LM Studio CLI 'lms' is not discoverable." }
$status = $null
try { $status = (& $lms.Source server status --json --quiet 2>$null | Out-String | ConvertFrom-Json) } catch {}
if (-not $status -or -not $status.running) {
    & $lms.Source server start | Out-Null
    for ($i=0; $i -lt 20 -and (-not $status); $i++) {
        Start-Sleep -Seconds 1
        try { $status = (& $lms.Source server status --json --quiet 2>$null | Out-String | ConvertFrom-Json) } catch {}
        if ($status -and $status.running) { break }
    }
}
if (-not $status -or -not $status.running -or -not $status.port) { throw "LM Studio server did not become ready." }
$Port = [int]$status.port
$inventory = (& $lms.Source ls --llm --json 2>$null | Out-String | ConvertFrom-Json)
$items = @()
if ($inventory.models) { $items = @($inventory.models) } elseif ($inventory.data) { $items = @($inventory.data) } else { $items = @($inventory) }
if ($items.Count -eq 0) { throw "LM Studio is running but no local LLM is installed." }
$preferred = $env:DREAMLEDGER_LM_MODEL
if (-not $preferred) { $preferred = $env:BECK_LM_MODEL }
$model = $null
if ($preferred) {
    $model = $items | Where-Object {
        ([string]$_.modelKey -eq $preferred) -or ([string]$_.model_key -eq $preferred) -or ([string]$_.key -eq $preferred) -or ([string]$_.id -eq $preferred) -or ([string]$_.path -eq $preferred)
    } | Select-Object -First 1
}
if (-not $model) { $model = $items | Select-Object -First 1 }
$modelKey = [string]$model.modelKey
if (-not $modelKey) { $modelKey = [string]$model.model_key }
if (-not $modelKey) { $modelKey = [string]$model.key }
if (-not $modelKey) { $modelKey = [string]$model.id }
if (-not $modelKey) { throw "No usable LM Studio model key found." }
$loaded = (& $lms.Source ps --json 2>$null | Out-String | ConvertFrom-Json)
$loadedItems = @()
if ($loaded) {
    if ($loaded.models) { $loadedItems = @($loaded.models) } elseif ($loaded.data) { $loadedItems = @($loaded.data) } else { $loadedItems = @($loaded) }
}
$already = $loadedItems | Where-Object { ([string]$_.modelKey -eq $modelKey) -or ([string]$_.model_key -eq $modelKey) -or ([string]$_.key -eq $modelKey) -or ([string]$_.id -eq $modelKey) -or ([string]$_.model -eq $modelKey) } | Select-Object -First 1
if (-not $already) { & $lms.Source load $modelKey -y --gpu max | Out-Null }
$Endpoint = "http://127.0.0.1:$Port/v1/chat/completions"
Write-Host ("LM Studio API: PASS port={0} model={1}" -f $Port,$modelKey) -ForegroundColor Green

Write-Host "[4/4] Starting controller..." -ForegroundColor Yellow
Push-Location $Autonomy
try {
    $args = @("-LmStudioEndpoint",$Endpoint,"-Model",$modelKey)
    if (-not $NoLoop) { $args += "-Loop" }
    & $Controller @args
    if ($LASTEXITCODE -ne 0) { throw "Controller exited with code $LASTEXITCODE." }
} finally {
    Pop-Location
}

Write-Host "Money machine stopped." -ForegroundColor Cyan
