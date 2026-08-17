#Requires -Version 5.1
# BROWNEYE LOCAL-FIRST BOOTSTRAP
# ASCII ONLY / IDEMPOTENT / NO PUBLIC POSTING / NO PAYMENT CLAIMS
# Clones or updates the known ecosystem repos, verifies DreamLedger locally,
# starts LM Studio on localhost, inventories local models, and emits proof.

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::ASCII } catch {}

$Root = 'C:\BrownEyeCortex'
$RepoRoot = Join-Path $Root 'REPOS'
$ConfigRoot = Join-Path $Root 'CONFIG'
$ArtifactRoot = if (Test-Path 'D:\') { 'D:\BrownEyeCortex\ARTIFACTS' } else { Join-Path $Root 'ARTIFACTS' }
$LogRoot = Join-Path $ArtifactRoot 'LOGS'
$ConfigPath = Join-Path $ConfigRoot 'LMSTUDIO-ECO-SILOS.json'
$ProofPath = Join-Path $ArtifactRoot 'LOCAL-FIRST-BOOTSTRAP-PROOF.json'
$LogPath = Join-Path $LogRoot ('bootstrap_' + (Get-Date -Format 'yyyyMMdd_HHmmss') + '.log')

$Repos = @(
    'KelpCoin/index.html',
    'KelpCoin/kelpcoin-faucet-site',
    'KelpCoin/safehub',
    'KelpCoin/carousel-catalog',
    'KelpCoin/pulse-catalog',
    'KelpCoin/DreamLedger',
    'KelpCoin/render-ingestor',
    'KelpCoin/mtg-furnace-render',
    'KelpCoin/Happyhomarid',
    'KelpCoin/DreamLogic',
    'KelpCoin/BrownEye-CUBE'
)

function Ensure-Dir([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Force -Path $Path | Out-Null
    }
}

function Log([string]$Text) {
    $line = ('[' + (Get-Date).ToString('s') + '] ' + $Text)
    Add-Content -LiteralPath $LogPath -Value $line -Encoding ASCII
    Write-Host $line
}

function Has-Command([string]$Name) {
    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Invoke-Process([string]$File,[string[]]$Args) {
    $p = Start-Process -FilePath $File -ArgumentList $Args -NoNewWindow -Wait -PassThru
    return $p.ExitCode
}

Ensure-Dir $RepoRoot
Ensure-Dir $ConfigRoot
Ensure-Dir $ArtifactRoot
Ensure-Dir $LogRoot
New-Item -ItemType File -Force -Path $LogPath | Out-Null

Log 'BOOTSTRAP_START'
Log ('POWERSHELL=' + $PSVersionTable.PSVersion.ToString())
Log ('ROOT=' + $Root)
Log ('ARTIFACT_ROOT=' + $ArtifactRoot)

if (-not (Has-Command 'git')) { throw 'git is required' }
if (-not (Has-Command 'npm')) { Log 'npm=NOT_FOUND' }
if (-not (Has-Command 'lms')) { Log 'lms=NOT_FOUND; LM Studio must be installed before local inference can start' }
if (-not (Has-Command 'gh')) { Log 'gh=NOT_FOUND; public repositories can still clone with git; private CUBE may require GitHub auth' }

$repoResults = @()
foreach ($full in $Repos) {
    $parts = $full.Split('/')
    $owner = $parts[0]
    $name = $parts[1]
    $path = Join-Path $RepoRoot $name
    try {
        if (-not (Test-Path (Join-Path $path '.git'))) {
            if (Has-Command 'gh') {
                Log ('CLONE=' + $full)
                $code = Invoke-Process 'gh' @('repo','clone',$full,$path)
            } else {
                Log ('CLONE_GIT=' + $full)
                $code = Invoke-Process 'git' @('clone',('https://github.com/' + $full + '.git'),$path)
            }
            if ($code -ne 0) { throw ('clone exit ' + $code) }
        } else {
            Log ('UPDATE=' + $full)
            $status = (& git -C $path status --porcelain 2>$null)
            if ([string]::IsNullOrWhiteSpace(($status -join ''))) {
                & git -C $path fetch origin --prune 2>&1 | Out-File -FilePath $LogPath -Append -Encoding ASCII
                & git -C $path pull --ff-only 2>&1 | Out-File -FilePath $LogPath -Append -Encoding ASCII
            } else {
                Log ('DIRTY_SKIP_PULL=' + $full)
            }
        }
        $branch = (& git -C $path branch --show-current 2>$null)
        $sha = (& git -C $path rev-parse HEAD 2>$null)
        $repoResults += [pscustomobject]@{ repo=$full; path=$path; branch=($branch -join ''); sha=($sha -join ''); status='READY' }
    } catch {
        Log ('REPO_ERROR=' + $full + ' :: ' + $_.Exception.Message)
        $repoResults += [pscustomobject]@{ repo=$full; path=$path; branch=''; sha=''; status='ERROR'; error=$_.Exception.Message }
    }
}

# LM Studio: localhost only. Current LM Studio docs use lms server start and port 1234 by default.
$lmStatus = 'NOT_AVAILABLE'
$models = @()
$serverStarted = $false
if (Has-Command 'lms') {
    try {
        $statusText = (& lms server status 2>&1 | Out-String)
        Log ('LM_SERVER_STATUS=' + ($statusText.Trim() -replace "`r?`n", ' | '))
        if ($statusText -notmatch '(?i)running|started|online') {
            Log 'LM_SERVER_START=127.0.0.1:1234'
            $proc = Start-Process -FilePath 'lms' -ArgumentList @('server','start','--port','1234') -WindowStyle Hidden -PassThru
            Start-Sleep -Seconds 3
            $serverStarted = $true
        }
        $headers = @{}
        if ($env:LM_API_TOKEN) { $headers['Authorization'] = 'Bearer ' + $env:LM_API_TOKEN }
        try {
            $r = Invoke-RestMethod -Uri 'http://127.0.0.1:1234/api/v1/models' -Headers $headers -Method Get -TimeoutSec 10
            $models = @($r.data)
            $lmStatus = 'API_V1_OK'
        } catch {
            $r = Invoke-RestMethod -Uri 'http://127.0.0.1:1234/api/v0/models' -Headers $headers -Method Get -TimeoutSec 10
            $models = @($r.data)
            $lmStatus = 'API_V0_OK'
        }
        Log ('LM_MODELS=' + $models.Count)
    } catch {
        $lmStatus = 'ERROR'
        Log ('LM_ERROR=' + $_.Exception.Message)
    }
}

$modelIds = @($models | ForEach-Object { $_.id } | Where-Object { $_ })
function Pick-Model([string[]]$Candidates,[string[]]$Ids) {
    foreach ($pattern in $Candidates) {
        $hit = $Ids | Where-Object { $_ -match $pattern } | Select-Object -First 1
        if ($hit) { return $hit }
    }
    return $null
}

$roles = [ordered]@{
    proposer = Pick-Model @('qwen.*coder','qwen.*instruct','deepseek.*coder','coder') $modelIds
    critic = Pick-Model @('qwen.*instruct','llama.*instruct','mistral.*instruct','gemma.*instruct') $modelIds
    synthesizer = Pick-Model @('qwen.*instruct','llama.*instruct','mistral.*instruct') $modelIds
    monetizer = Pick-Model @('qwen.*instruct','llama.*instruct','mistral.*instruct') $modelIds
    verifier = Pick-Model @('qwen.*coder','qwen.*instruct','deepseek.*coder','coder') $modelIds
}

$config = [ordered]@{
    schema_version = '1.0'
    generated_utc = (Get-Date).ToUniversalTime().ToString('o')
    endpoint = 'http://127.0.0.1:1234'
    api = $lmStatus
    roles = $roles
    model_ids = $modelIds
    operating_mode = 'LOCAL_FIRST_SEQUENTIAL_ROLES'
    public_actions = 'HUMAN_APPROVAL_REQUIRED'
    revenue_nzd = 0
    payment_count = 0
}
$config | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ConfigPath -Encoding ASCII

# Verify DreamLedger locally. Compile is the canonical website assembly command in package.json.
$dreamPath = Join-Path $RepoRoot 'DreamLedger'
$compile = 'NOT_RUN'
if (Test-Path (Join-Path $dreamPath 'package.json')) {
    try {
        Push-Location $dreamPath
        if (Test-Path 'package-lock.json') { & npm ci --ignore-scripts 2>&1 | Tee-Object -FilePath $LogPath -Append | Out-Null }
        else { & npm install --ignore-scripts 2>&1 | Tee-Object -FilePath $LogPath -Append | Out-Null }
        & npm run compile 2>&1 | Tee-Object -FilePath $LogPath -Append
        if ($LASTEXITCODE -ne 0) { throw ('npm run compile exit ' + $LASTEXITCODE) }
        $compile = 'PASS'
    } catch {
        $compile = 'FAIL'
        Log ('DREAMLEDGER_COMPILE_ERROR=' + $_.Exception.Message)
    } finally { Pop-Location }
} else {
    $compile = 'MISSING_PACKAGE'
}

$proof = [ordered]@{
    bootstrap = 'Bootstrap-BrownEye-LMStudio.ps1'
    timestamp_utc = (Get-Date).ToUniversalTime().ToString('o')
    powershell = $PSVersionTable.PSVersion.ToString()
    repositories = $repoResults
    lmstudio = [ordered]@{ status=$lmStatus; server_started=$serverStarted; endpoint='http://127.0.0.1:1234'; model_count=$models.Count; roles=$roles }
    dreamledger_compile = $compile
    verified_payment_count = 0
    revenue_nzd = 0
    public_actions_performed = $false
    status = if ($compile -eq 'PASS' -and $lmStatus -match 'OK') { 'LOCAL_SPINE_READY' } else { 'PARTIAL' }
}
$proof | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $ProofPath -Encoding ASCII

Log ('PROOF=' + $ProofPath)
Log ('CONFIG=' + $ConfigPath)
Log ('DREAMLEDGER_COMPILE=' + $compile)
Log ('LMSTUDIO=' + $lmStatus)
Log 'VERIFIED_REVENUE_NZD=0'
Log 'PAYMENT_COUNT=0'
Log 'PUBLIC_ACTIONS=NONE'
Log 'BOOTSTRAP_COMPLETE'

Write-Host ''
Write-Host 'BROWNEYE LOCAL-FIRST BOOTSTRAP COMPLETE'
Write-Host ('PROOF=' + $ProofPath)
Write-Host ('CONFIG=' + $ConfigPath)
Write-Host ('LOG=' + $LogPath)
Write-Host ('DREAMLEDGER_COMPILE=' + $compile)
Write-Host ('LMSTUDIO=' + $lmStatus)
Write-Host 'VERIFIED_REVENUE_NZD=0'
