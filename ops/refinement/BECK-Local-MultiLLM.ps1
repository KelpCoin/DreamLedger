# BECK local-first multi-LLM scheduler. Windows PowerShell 5.1, ASCII-only.
# Installs a current-user scheduled task; never posts, sells, deploys or pays for model inference.
# One command: powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\BECK-Local-MultiLLM.ps1 -Install
[CmdletBinding()]
param(
    [switch]$Install,
    [switch]$Run,
    [string]$Root = "",
    [int]$EveryHours = 4
)
$ErrorActionPreference = "Stop"
$TaskName = "BECK_Local_MultiLLM_4h"
if ([string]::IsNullOrWhiteSpace($Root)) {
    if (Test-Path "D:\") {
        $Root = "D:\BrownEye\BROWNEYE_ARTIFACTS\BECK\MultiLLM"
    } else {
        $Root = "C:\BrownEyeCortex\BECK\MultiLLM"
    }
}
$Root = [System.IO.Path]::GetFullPath($Root)
$Repo = Join-Path $Root "DreamLedger-Refinement-Source"
$Logs = Join-Path $Root "proof"
New-Item -ItemType Directory -Path $Root,$Logs -Force | Out-Null
$LogFile = Join-Path $Logs "local-refinement.log"
function Log([string]$Text) {
    $line = (Get-Date).ToUniversalTime().ToString("o") + " " + $Text
    Add-Content -Path $LogFile -Value $line -Encoding ASCII
    Write-Host $line
}
function Require-Command([string]$Name) {
    $found = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $found) { throw "Required command not found: $Name" }
}
function Sync-Repo {
    Require-Command "git"
    if (-not (Test-Path (Join-Path $Repo ".git"))) {
        if (Test-Path $Repo) { throw "Dedicated source path exists but is not a Git clone: $Repo" }
        & git clone --quiet --depth 1 --branch main "https://github.com/KelpCoin/DreamLedger.git" $Repo
        if ($LASTEXITCODE -ne 0) { throw "Git clone failed" }
    } else {
        # The script owns this dedicated clone. No user workspace is reset.
        & git -C $Repo fetch --quiet --depth 1 origin main
        if ($LASTEXITCODE -ne 0) { throw "Git fetch failed" }
        & git -C $Repo checkout --quiet -B main origin/main
        if ($LASTEXITCODE -ne 0) { throw "Git checkout failed" }
    }
}
function Discover-Ollama {
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags" -Method Get -TimeoutSec 12
    $models = @($response.models | ForEach-Object { $_.name } | Where-Object { $_ -and $_.Trim() -ne "" } | Select-Object -Unique)
    if ($models.Count -lt 2) { throw "At least two distinct local Ollama models must be installed. Found: $($models.Count)" }
    return ,@($models | Select-Object -First 3)
}
function Invoke-Local {
    Require-Command "node"
    Log "MODE=READ_ONLY_LOCAL_MODEL_REFINEMENT"
    Sync-Repo
    $models = @(Discover-Ollama)
    $env:LLM_API_URL = "http://127.0.0.1:11434/v1/chat/completions"
    $env:LLM_API_KEY = "ollama"
    $env:LLM_MODELS = $models -join ","
    $env:REFINEMENT_OUT = Join-Path $Logs "iterative-refinement-proof.md"
    $env:REFINEMENT_JSON_OUT = Join-Path $Logs "iterative-refinement-proof.json"
    Log ("MODEL_COUNT=" + $models.Count + " MODEL_IDS=" + ($models -join ","))
    & node (Join-Path $Repo "BEC-PRIME\scripts\iterative-refinement.js")
    if ($LASTEXITCODE -ne 0) { throw "LLM refinement failed (not marked successful)" }
    $proof = Get-Content $env:REFINEMENT_JSON_OUT -Raw | ConvertFrom-Json
    if ($proof.status -ne "COMPLETED_RESEARCH_ONLY" -or $proof.model_count_distinct -lt 2) {
        throw "LLM proof did not confirm two distinct models"
    }
    $hash = (Get-FileHash -Algorithm SHA256 $env:REFINEMENT_JSON_OUT).Hash
    $receipt = [ordered]@{
        schema = "beck/local-refinement-receipt/v1"
        time_utc = (Get-Date).ToUniversalTime().ToString("o")
        status = $proof.status
        source_branch = "main"
        distinct_models = $proof.model_count_distinct
        proof_sha256 = $hash
        public_posts = 0
        checkouts_created = 0
        new_revenue_verified = $false
    }
    ($receipt | ConvertTo-Json -Depth 5) | Set-Content -Path (Join-Path $Logs "latest-receipt.json") -Encoding ASCII
    Log ("SUCCESS_LOCAL_REFINEMENT_PROOF_SHA256=" + $hash)
}
try {
    if ($EveryHours -lt 1 -or $EveryHours -gt 24) { throw "EveryHours must be 1 through 24" }
    if ($Install) {
        # First run verifies local models and outputs a genuine proof before scheduling.
        Invoke-Local
        $scriptPath = $MyInvocation.MyCommand.Path
        if (-not (Test-Path $scriptPath)) { throw "Script must be saved on disk before installing" }
        $action = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "' + $scriptPath + '" -Run -Root "' + $Root + '"'
        & schtasks.exe /Create /F /TN $TaskName /SC HOURLY /MO $EveryHours /TR $action
        if ($LASTEXITCODE -ne 0) { throw "Task Scheduler registration failed" }
        Log ("TASK_REGISTERED=" + $TaskName + " CADENCE_HOURS=" + $EveryHours)
    } else {
        Invoke-Local
    }
} catch {
    Log ("STATUS=FAILED REASON=" + $_.Exception.Message)
    exit 1
}
