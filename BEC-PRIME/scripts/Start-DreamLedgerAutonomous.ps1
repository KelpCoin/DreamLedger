#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

<#
DreamLedger local autonomous runtime launcher.

This is a thin machine bootstrap, not a new queue/orchestrator.
It starts the existing LM Studio headless service/server and then hands
continuous work to the existing economic-local-worker.

Required:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY

Optional:
  LMSTUDIO_BASE_URL   default http://127.0.0.1:1234/v1
  LMSTUDIO_MODEL      preferred downloaded LM Studio model
  LM_API_TOKEN        only if LM Studio API authentication is enabled

LM Studio JIT loading is intentionally used. Models load when inference
arrives and can be auto-unloaded by LM Studio, reducing idle GPU/RAM use.
#>

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = (Resolve-Path (Join-Path $ScriptRoot '..\..')).Path
$Worker = Join-Path $RepoRoot 'BEC-PRIME\scripts\economic-local-worker.js'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'NODE_NOT_FOUND'
}
if (-not (Get-Command lms -ErrorAction SilentlyContinue)) {
    throw 'LM_STUDIO_CLI_NOT_FOUND'
}
if (-not $env:SUPABASE_URL) {
    throw 'MISSING_ENV:SUPABASE_URL'
}
if (-not ($env:SUPABASE_SERVICE_ROLE_KEY -or $env:SUPABASE_SECRET_KEY)) {
    throw 'MISSING_ENV:SUPABASE_SERVICE_ROLE_KEY_OR_SUPABASE_SECRET_KEY'
}
if (-not (Test-Path $Worker)) {
    throw "WORKER_NOT_FOUND:$Worker"
}

if (-not $env:LMSTUDIO_BASE_URL) {
    $env:LMSTUDIO_BASE_URL = 'http://127.0.0.1:1234/v1'
}

Write-Host 'DREAMLEDGER LOCAL AUTONOMOUS RUNTIME'
Write-Host ('REPO=' + $RepoRoot)
Write-Host ('LM=' + $env:LMSTUDIO_BASE_URL)
Write-Host 'Starting LM Studio headless daemon...'
& lms daemon up | Out-Host

Write-Host 'Starting LM Studio local server...'
& lms server start | Out-Host

$deadline = (Get-Date).AddSeconds(15)
$modelsUrl = $env:LMSTUDIO_BASE_URL.TrimEnd('/') + '/models'
do {
    try {
        $headers = @{}
        if ($env:LM_API_TOKEN) { $headers.Authorization = 'Bearer ' + $env:LM_API_TOKEN }
        $models = Invoke-RestMethod -Uri $modelsUrl -Headers $headers -TimeoutSec 3
        if (@($models.data).Count -gt 0) { break }
    } catch {}
    Start-Sleep -Milliseconds 750
} while ((Get-Date) -lt $deadline)

if ((Get-Date) -ge $deadline) {
    throw 'LM_STUDIO_UNAVAILABLE_OR_NO_DOWNLOADED_MODELS'
}

Write-Host ('LM Studio models visible: ' + @($models.data).Count)
Write-Host 'Starting existing DreamLedger economic local worker in continuous mode.'
Write-Host 'No new queue, ledger, scheduler, or external-action authority is created by this launcher.'

Push-Location $RepoRoot
try {
    & node $Worker --loop
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
