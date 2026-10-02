#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

<#
DreamLedger local autonomous runtime launcher.

This is a thin machine bootstrap, not a new queue/orchestrator.
It starts the existing LM Studio headless service/server and then hands
continuous work to the existing economic-local-worker.

Local credentials may be loaded from the Windows-user DPAPI store created by
Set-DreamLedgerLocalCredentials.ps1. No secret is committed to the repository.

Optional:
  LMSTUDIO_BASE_URL   default http://127.0.0.1:1234/v1
  LMSTUDIO_MODEL      preferred downloaded LM Studio model
  LM_API_TOKEN        only if LM Studio API authentication is enabled
#>

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = (Resolve-Path (Join-Path $ScriptRoot '..\..')).Path
$Worker = Join-Path $RepoRoot 'BEC-PRIME\scripts\economic-local-worker.js'
$CredentialPath = Join-Path $env:LOCALAPPDATA 'DreamLedger\local-secrets.json'

function Convert-SecureStringToPlainText {
    param([Parameter(Mandatory=$true)][Security.SecureString]$SecureString)
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureString)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}

function Import-DreamLedgerLocalCredentials {
    if ($env:SUPABASE_URL -and ($env:SUPABASE_SERVICE_ROLE_KEY -or $env:SUPABASE_SECRET_KEY)) {
        return
    }
    if (-not (Test-Path $CredentialPath)) {
        throw 'LOCAL_CREDENTIALS_NOT_CONFIGURED: run BEC-PRIME\scripts\Set-DreamLedgerLocalCredentials.ps1 once'
    }
    $doc = Get-Content -LiteralPath $CredentialPath -Raw | ConvertFrom-Json
    if (-not $doc.supabase_url -or -not $doc.supabase_service_role_key_dpapi) {
        throw 'LOCAL_CREDENTIALS_INVALID'
    }
    $secure = ConvertTo-SecureString -String ([string]$doc.supabase_service_role_key_dpapi)
    $env:SUPABASE_URL = [string]$doc.supabase_url
    $env:SUPABASE_SERVICE_ROLE_KEY = Convert-SecureStringToPlainText $secure
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'NODE_NOT_FOUND'
}
if (-not (Get-Command lms -ErrorAction SilentlyContinue)) {
    throw 'LM_STUDIO_CLI_NOT_FOUND'
}
Import-DreamLedgerLocalCredentials
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

# Discover the actual server port. LM Studio may restore a previously selected port.
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

# /v1/models can list downloaded models while JIT loading is enabled.
# Explicitly load one model, then verify residency with lms ps --json.
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
