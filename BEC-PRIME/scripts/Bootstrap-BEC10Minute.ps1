#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$RepoRoot = "",
    [string]$DataRoot = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Ensure-Dir([string]$p) {
    if (-not (Test-Path -LiteralPath $p)) { New-Item -ItemType Directory -Force -Path $p | Out-Null }
}
function Write-Json([string]$p,[object]$o) {
    Ensure-Dir (Split-Path -Parent $p)
    $o | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $p -Encoding UTF8
}
function Find-Lms {
    $c = Get-Command lms.exe -ErrorAction SilentlyContinue
    if ($c) { return $c.Source }
    $candidates = @(
        (Join-Path $env:USERPROFILE ".lmstudio\bin\lms.exe"),
        (Join-Path $env:LOCALAPPDATA "Programs\LM Studio\resources\app\.webpack\bin\lms.exe")
    )
    foreach ($p in $candidates) { if (Test-Path -LiteralPath $p) { return $p } }
    throw "lms.exe not found. Open LM Studio once or install llmster/lms."
}
function Invoke-Lms([string[]]$Args) {
    $lms = Find-Lms
    $o = & $lms @Args 2>&1
    if ($LASTEXITCODE -ne 0) { throw ("lms failed: " + ($Args -join " ") + " :: " + ($o -join " ")) }
    return ($o -join "`n")
}

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    if (Test-Path "D:\BrownEyeCortex\BECKPrime") { $RepoRoot = "D:\BrownEyeCortex\BECKPrime" }
    elseif (Test-Path "C:\BrownEyeCortex\BECKPrime") { $RepoRoot = "C:\BrownEyeCortex\BECKPrime" }
    else { throw "BEC PRIME repo not found on D: or C:." }
}
if ([string]::IsNullOrWhiteSpace($DataRoot)) {
    $DataRoot = if (Test-Path "D:\") { "D:\BrownEyeCortex\Runtime" } else { "C:\BrownEyeCortex\Runtime" }
}

$LogRoot = Join-Path $DataRoot "logs"
$ProofRoot = Join-Path $DataRoot "proofs"
$ConfigRoot = Join-Path $DataRoot "config"
Ensure-Dir $LogRoot; Ensure-Dir $ProofRoot; Ensure-Dir $ConfigRoot
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$log = Join-Path $LogRoot "bootstrap-10min-$stamp.log"
Start-Transcript -LiteralPath $log -Force | Out-Null

try {
    Write-Host "[1/6] Quieting known BEC startup task..." -ForegroundColor Cyan
    $knownTasks = @(
        "BEC-PRIME-Startup-Orchestra",
        "BECPrimeStartupOrchestra",
        "BrownEyeCortex-Startup",
        "BrownEyeCortex-Startup-Orchestra"
    )
    $disabled = @()
    foreach ($t in $knownTasks) {
        try {
            $task = Get-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue
            if ($task) {
                Disable-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue | Out-Null
                $disabled += $t
            }
        } catch {}
    }

    Write-Host "[2/6] Starting LM Studio daemon/server..." -ForegroundColor Cyan
    Invoke-Lms @("daemon","up","--json") | Out-Null
    Invoke-Lms @("server","start","--port","1234","--bind","127.0.0.1") | Out-Null

    Write-Host "[3/6] Discovering installed models..." -ForegroundColor Cyan
    $modelsRaw = Invoke-Lms @("ls","--llm","--json") | ConvertFrom-Json
    $models = @($modelsRaw)
    if ($models.Count -eq 1 -and $models[0].models) { $models = @($models[0].models) }
    $rows = @($models | Where-Object { $_.modelKey -or $_.identifier })
    if ($rows.Count -eq 0) { throw "No downloaded LM Studio models were discovered." }

    $preferred = $rows | Where-Object { ([string]$_.modelKey -match '(?i)gpt.*oss.*20b') -or ([string]$_.identifier -match '(?i)gpt.*oss.*20b') } | Select-Object -First 1
    if (-not $preferred) { $preferred = $rows | Select-Object -First 1 }
    $selected = if ($preferred.modelKey) { [string]$preferred.modelKey } else { [string]$preferred.identifier }

    $configPath = Join-Path $ConfigRoot "lmstudio-defaults.json"
    $cfg = [ordered]@{
        schema = "BEC-LMSTUDIO-DEFAULTS-1.0"
        preferred_model_pattern = "gpt.*oss.*20b"
        selected_model = $selected
        second_model_pattern = ""
        server = "http://127.0.0.1:1234"
        note = "Set second_model_pattern only after confirming the exact installed identifier."
    }
    if (Test-Path -LiteralPath $configPath) {
        try {
            $old = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
            if ($old.preferred_model_pattern) { $cfg.preferred_model_pattern = [string]$old.preferred_model_pattern }
            if ($old.selected_model) { $selected = [string]$old.selected_model; $cfg.selected_model = $selected }
            if ($old.second_model_pattern) { $cfg.second_model_pattern = [string]$old.second_model_pattern }
        } catch {}
    }

    Write-Host "[4/6] Loading default model quietly..." -ForegroundColor Cyan
    $loadedRaw = Invoke-Lms @("ps","--json") | ConvertFrom-Json
    $loaded = @($loadedRaw)
    if ($loaded.Count -eq 1 -and $loaded[0].models) { $loaded = @($loaded[0].models) }
    $already = $loaded | Where-Object { ([string]$_.identifier -eq $selected) -or ([string]$_.modelKey -eq $selected) }
    if (-not $already) { Invoke-Lms @("load",$selected,"--gpu","auto") | Out-Null }

    Write-Host "[5/6] Creating local control-plane handoff..." -ForegroundColor Cyan
    $handoff = Join-Path $DataRoot "ACTIVE-WORK-STATE.json"
    Write-Json $handoff ([ordered]@{
        schema="BEC-ACTIVE-WORK-STATE-1.0"
        mission="AUTONOMOUS-REVENUE-ENGINE"
        active_repo=$RepoRoot
        compiler_entry="BEC-PRIME\bec.cmd"
        compiler_targets=@("website","game","app")
        commercial_priority=@("BILLBOARD-TEXT-TILE-001","EDH_0001","DIGITAL-PRODUCT-CATALOG")
        model_team=@(@{role="proposer";model=$selected},@{role="critic";model_pattern=$cfg.second_model_pattern},@{role="synthesizer";model="local-controller"})
        public_actions="APPROVAL_REQUIRED"
        autonomous_spend_nzd=0
        updated_at_utc=(Get-Date).ToUniversalTime().ToString("o")
    })

    Write-Host "[6/6] Verifying local compiler control point..." -ForegroundColor Cyan
    $bec = Join-Path $RepoRoot "BEC-PRIME\bec.cmd"
    $compilerStatus = "MISSING"
    if (Test-Path -LiteralPath $bec) {
        Push-Location (Join-Path $RepoRoot "BEC-PRIME")
        try {
            & cmd.exe /c "bec.cmd status" *>&1 | Tee-Object -FilePath (Join-Path $LogRoot "bec-status.log") | Out-Host
            $compilerStatus = if ($LASTEXITCODE -eq 0) { "PASS" } else { "FAIL" }
        } finally { Pop-Location }
    }

    $proof = [ordered]@{
        schema="BEC-10MINUTE-BOOTSTRAP-1.0"
        status="PASS"
        repo=$RepoRoot
        data_root=$DataRoot
        known_startup_tasks_disabled=$disabled
        lm_studio_server="http://127.0.0.1:1234"
        selected_model=$selected
        compiler_entry=$bec
        compiler_status=$compilerStatus
        active_work_state=$handoff
        timestamp_utc=(Get-Date).ToUniversalTime().ToString("o")
    }
    Write-Json (Join-Path $ProofRoot "BOOTSTRAP-10MIN-LATEST.json") $proof
    $cfg | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $configPath -Encoding UTF8
    Write-Host "BOOTSTRAP 10-MINUTE PASS" -ForegroundColor Green
    Write-Host ("Proof: " + (Join-Path $ProofRoot "BOOTSTRAP-10MIN-LATEST.json")) -ForegroundColor Green
} catch {
    $proof = [ordered]@{schema="BEC-10MINUTE-BOOTSTRAP-1.0";status="FAIL";error=$_.Exception.Message;timestamp_utc=(Get-Date).ToUniversalTime().ToString("o")}
    Write-Json (Join-Path $ProofRoot "BOOTSTRAP-10MIN-LATEST.json") $proof
    throw
} finally {
    Stop-Transcript | Out-Null
}
