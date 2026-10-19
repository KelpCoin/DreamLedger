<#
.SYNOPSIS
  Installs the supported per-user BECK local worker on Windows PowerShell 5.1.
.DESCRIPTION
  Idempotently registers a 30-minute task. The cloud remains primary; this worker
  only uses loopback LM Studio and the repository's existing local orchestrator.
  It never contacts payment APIs, writes production state, or claims revenue.
#>
[CmdletBinding(PositionalBinding=$false)]
param(
    [string]$RepoPath = '',
    [string]$WorkRoot = 'D:\BrownEyeCortexData',
    [string]$LMStudioUrl = 'http://127.0.0.1:1234/v1',
    [string]$TaskName = 'BECK-FigureEight-Local-Worker',
    [int]$IntervalMinutes = 30
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Write-Utf8NoBom {
    param([string]$Path, [string]$Text)
    $directory = Split-Path -Parent $Path
    if ($directory) { New-Item -ItemType Directory -Force -Path $directory | Out-Null }
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Text, $encoding)
}

function Find-RepoRoot {
    param([string]$Start)
    $current = (Resolve-Path -LiteralPath $Start).Path
    while ($current) {
        if ((Test-Path -LiteralPath (Join-Path $current '.git')) -or
            (Test-Path -LiteralPath (Join-Path $current 'ops\local\money_orchestrator.py'))) {
            return $current
        }
        $parent = Split-Path -Parent $current
        if (-not $parent -or $parent -eq $current) { break }
        $current = $parent
    }
    return $null
}

if (-not $RepoPath) {
    $RepoPath = Find-RepoRoot -Start $PSScriptRoot
    if (-not $RepoPath) { $RepoPath = Find-RepoRoot -Start (Get-Location).Path }
}
if (-not $RepoPath -or -not (Test-Path -LiteralPath (Join-Path $RepoPath 'ops\local\money_orchestrator.py'))) {
    throw 'Repository root not found. Run this installer from a DreamLedger checkout or pass -RepoPath.'
}
$RepoPath = (Resolve-Path -LiteralPath $RepoPath).Path

if ($LMStudioUrl -notmatch '^http://(127\.0\.0\.1|localhost):\d+/v1/?$') {
    throw 'LMStudioUrl must point to a loopback-only OpenAI-compatible endpoint.'
}
if ($IntervalMinutes -lt 15 -or $IntervalMinutes -gt 240) {
    throw 'IntervalMinutes must be between 15 and 240.'
}

$resolvedWorkRoot = $WorkRoot
try {
    New-Item -ItemType Directory -Force -Path $resolvedWorkRoot | Out-Null
    $probe = Join-Path $resolvedWorkRoot ('.beck-write-test-' + [guid]::NewGuid().ToString('N'))
    Write-Utf8NoBom -Path $probe -Text 'ok'
    Remove-Item -LiteralPath $probe -Force
} catch {
    $resolvedWorkRoot = Join-Path $env:LOCALAPPDATA 'BrownEyeCortexData'
    New-Item -ItemType Directory -Force -Path $resolvedWorkRoot | Out-Null
}
$workRoot = Join-Path $resolvedWorkRoot 'local-fleet'
$logs = Join-Path $workRoot 'logs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null
$workerPath = Join-Path $workRoot 'Run-BECKLocalWorker.ps1'
$installerProof = Join-Path $workRoot 'installer-proof.json'

$workerTemplate = @'
[CmdletBinding(PositionalBinding=$false)]
param(
    [Parameter(Mandatory=$true)][string]$RepoPath,
    [Parameter(Mandatory=$true)][string]$WorkRoot,
    [string]$LMStudioUrl = 'http://127.0.0.1:1234/v1'
)
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$stamp = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
$outDir = Join-Path $WorkRoot 'local-fleet'
$logDir = Join-Path $outDir 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$runId = (Get-Date).ToUniversalTime().ToString('yyyyMMddHHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,6)
$proofPath = Join-Path $outDir 'last-run.json'
$logPath = Join-Path $logDir ($runId + '.log')
$status = 'BLOCKED_CONFIGURATION'
$detail = 'worker_not_started'
$exitCode = 0
$models = @()
$httpStatus = 0
$elapsed = 0

try {
    $u = [uri]$LMStudioUrl
    if ($u.Scheme -ne 'http' -or $u.Host -notin @('127.0.0.1','localhost') -or $u.AbsolutePath.TrimEnd('/') -ne '/v1') {
        throw 'LM Studio endpoint must remain loopback-only.'
    }
    $sw = [Diagnostics.Stopwatch]::StartNew()
    $resp = Invoke-RestMethod -Uri ($LMStudioUrl.TrimEnd('/') + '/models') -Method Get -TimeoutSec 8
    $sw.Stop(); $elapsed = $sw.ElapsedMilliseconds; $httpStatus = 200
    foreach ($m in @($resp.data)) { if ($m.id) { $models += [string]$m.id } }
    if ($models.Count -eq 0) { throw 'LM Studio is reachable but no model is loaded.' }

    $entry = Join-Path $RepoPath 'ops\local\money_orchestrator.py'
    $python = Get-Command python -ErrorAction SilentlyContinue
    if (-not $python) { throw 'Python is unavailable on this PC.' }
    $env:LMSTUDIO_BASE_URL = $LMStudioUrl.TrimEnd('/')
    $env:PYTHONUTF8 = '1'
    $run = & $python.Source $entry 2>&1
    $exitCode = $LASTEXITCODE
    ($run | Out-String) | Set-Content -LiteralPath $logPath -Encoding utf8
    if ($exitCode -eq 0) {
        $status = 'WORKER_RAN_UNVERIFIED'
        $detail = 'Local orchestrator ran. Its recommendations are not revenue proof.'
    } else {
        $status = 'WORKER_FAILED'
        $detail = 'Local orchestrator returned a non-zero exit code.'
    }
} catch {
    $detail = [string]$_.Exception.Message
    if ($detail -match 'Unable to connect|actively refused|timed out|No connection could be made') {
        $status = 'LOCAL_BECK_UNAVAILABLE'
    } else {
        $status = 'BLOCKED_CONFIGURATION'
    }
    Add-Content -LiteralPath $logPath -Value ($stamp + ' ' + $detail) -Encoding utf8
}

$proof = [ordered]@{
    schema = 'dreamledger.beck-local-fleet-proof/v1'
    run_id = $runId
    observed_at_utc = $stamp
    status = $status
    repo_path = $RepoPath
    lmstudio_url = $LMStudioUrl
    lmstudio_http_status = $httpStatus
    loaded_model_count = $models.Count
    elapsed_ms = $elapsed
    worker_exit_code = $exitCode
    detail = $detail
    cloud_required = $false
    network_exposure = 'loopback_only_for_lm_studio'
    production_mutation = $false
    verified_revenue_nzd = 0
    log_path = $logPath
}
$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($proofPath, ($proof | ConvertTo-Json -Depth 6), $enc)
Write-Output ($proof | ConvertTo-Json -Depth 5)
'@

Write-Utf8NoBom -Path $workerPath -Text $workerTemplate

$powerShellExe = Join-Path $PSHOME 'powershell.exe'
$arguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + $workerPath + '" -RepoPath "' + $RepoPath + '" -WorkRoot "' + $resolvedWorkRoot + '" -LMStudioUrl "' + $LMStudioUrl + '"'
$taskRun = '"' + $powerShellExe + '" ' + $arguments
& schtasks.exe /Create /SC MINUTE /MO $IntervalMinutes /TN $TaskName /TR $taskRun /F | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Scheduled task registration failed with exit code $LASTEXITCODE." }

$proof = [ordered]@{
    schema = 'dreamledger.beck-local-fleet-install/v1'
    installed_at_utc = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
    repo_path = $RepoPath
    work_root = $resolvedWorkRoot
    task_name = $TaskName
    interval_minutes = $IntervalMinutes
    worker_path = $workerPath
    lmstudio_url = $LMStudioUrl
    idempotent = $true
    local_gpu_optional = $true
    public_actions = $false
    payment_mutations = $false
    verified_revenue_nzd = 0
    note = 'Installer registers the per-user Windows task. Cloud operations continue while this PC is off.'
}
Write-Utf8NoBom -Path $installerProof -Text ($proof | ConvertTo-Json -Depth 6)

Write-Host 'BECK_LOCAL_INSTALL=PASS'
Write-Host ('TASK=' + $TaskName)
Write-Host ('PROOF=' + $installerProof)
Write-Host ('WORKER=' + $workerPath)
Write-Host 'The installer has not claimed revenue or changed production payment paths.'
