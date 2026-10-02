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

# Discover the actual server port. Do not assume 1234 because LM Studio
# can restore a previously selected port.
$serverStatus = $null
try {
    $serverStatus = (& lms server status --json --quiet 2>$null | ConvertFrom-Json)
} catch {}

if ($serverStatus -and $serverStatus.running -and $serverStatus.port) {
    $env:LMSTUDIO_BASE_URL = 'http://127.0.0.1:' + [int]$serverStatus.port + '/v1'
    Write-Host ('LM Studio discovered at ' + $env:LMSTUDIO_BASE_URL)
} else {
    Write-Host ('LM Studio using configured endpoint ' + $env:LMSTUDIO_BASE_URL)
}

# IMPORTANT: /v1/models can list downloaded models while JIT loading is enabled.
# That does not prove a model is actually resident in memory. Explicitly load
# one model, then verify with lms ps --json.
$downloadedRaw = & lms ls --llm --json 2>$null
if (-not $downloadedRaw) {
    throw 'LM_STUDIO_NO_DOWNLOADED_LLM_MODELS'
}
$downloaded = @($downloadedRaw | ConvertFrom-Json)
if ($downloaded.Count -eq 0) {
    throw 'LM_STUDIO_NO_DOWNLOADED_LLM_MODELS'
}

$modelKey = $env:LMSTUDIO_MODEL
if ($modelKey) {
    $match = $downloaded | Where-Object { $_.modelKey -eq $modelKey } | Select-Object -First 1
    if (-not $match) {
        throw 'LMSTUDIO_MODEL_NOT_DOWNLOADED:' + $modelKey
    }
} else {
    # Prefer the known tool-capable Qwen 2.5 7B class, then a small Phi model,
    # then fall back to the first downloaded LLM. The environment variable
    # remains the authoritative override.
    $match = $downloaded | Where-Object { $_.modelKey -match 'qwen2\.5-7b-instruct' } | Select-Object -First 1
    if (-not $match) {
        $match = $downloaded | Where-Object { $_.modelKey -match 'phi-3-mini' } | Select-Object -First 1
    }
    if (-not $match) {
        $match = $downloaded | Select-Object -First 1
    }
    $modelKey = [string]$match.modelKey
}

Write-Host ('Selected LM Studio model: ' + $modelKey)

$loadedRaw = & lms ps --json 2>$null
$loaded = @()
if ($loadedRaw) {
    try { $loaded = @($loadedRaw | ConvertFrom-Json) } catch {}
}
$isLoaded = $loaded | Where-Object {
    ([string]$_.modelKey -eq $modelKey) -or
    ([string]$_.path -like ('*' + $modelKey + '*')) -or
    ([string]$_.identifier -eq $modelKey)
} | Select-Object -First 1

if (-not $isLoaded) {
    Write-Host 'Loading selected model into memory...'
    & lms load $modelKey --gpu auto --context-length 8192 --yes | Out-Host
}

$verifyDeadline = (Get-Date).AddMinutes(2)
do {
    $loadedRaw = & lms ps --json 2>$null
    if ($loadedRaw) {
        try {
            $loaded = @($loadedRaw | ConvertFrom-Json)
            $isLoaded = $loaded | Where-Object {
                ([string]$_.modelKey -eq $modelKey) -or
                ([string]$_.path -like ('*' + $modelKey + '*')) -or
                ([string]$_.identifier -eq $modelKey)
            } | Select-Object -First 1
            if ($isLoaded) { break }
        } catch {}
    }
    Start-Sleep -Seconds 2
} while ((Get-Date) -lt $verifyDeadline)

if (-not $isLoaded) {
    throw 'LM_STUDIO_MODEL_LOAD_NOT_CONFIRMED'
}

Write-Host ('LM Studio model loaded and verified: ' + $modelKey)
Write-Host 'Starting existing DreamLedger economic local worker in continuous mode.'
Write-Host 'No new queue, ledger, scheduler, or external-action authority is created by this launcher.'

Push-Location $RepoRoot
try {
    & node $Worker --loop
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
