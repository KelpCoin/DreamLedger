#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$RepoRoot = "",
    [string]$DataRoot = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Ensure-Dir([string]$p) {
    if (-not (Test-Path -LiteralPath $p)) {
        New-Item -ItemType Directory -Force -Path $p | Out-Null
    }
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
    foreach ($p in $candidates) {
        if (Test-Path -LiteralPath $p) { return $p }
    }
    throw "lms.exe not found."
}

function Invoke-Lms([string]$Lms,[string[]]$Args,[switch]$AllowFailure) {
    $o = & $Lms @Args 2>&1
    $code = $LASTEXITCODE
    $text = ($o -join "`n")
    if (($code -ne 0) -and (-not $AllowFailure)) {
        throw ("lms failed: " + ($Args -join " ") + " :: " + $text)
    }
    return [pscustomobject]@{ Code=$code; Output=$text }
}

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    if (Test-Path "D:\BrownEyeCortex\BECKPrime") {
        $RepoRoot = "D:\BrownEyeCortex\BECKPrime"
    }
    elseif (Test-Path "C:\BrownEyeCortex\BECKPrime") {
        $RepoRoot = "C:\BrownEyeCortex\BECKPrime"
    }
    else {
        throw "BEC PRIME repo not found on D: or C:."
    }
}

if ([string]::IsNullOrWhiteSpace($DataRoot)) {
    $DataRoot = if (Test-Path "D:\") {
        "D:\BrownEyeCortex\Runtime"
    } else {
        "C:\BrownEyeCortex\Runtime"
    }
}

$LogRoot = Join-Path $DataRoot "logs"
$ProofRoot = Join-Path $DataRoot "proofs"
$ConfigRoot = Join-Path $DataRoot "config"
Ensure-Dir $LogRoot
Ensure-Dir $ProofRoot
Ensure-Dir $ConfigRoot

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

    Write-Host "[2/6] Detecting LM Studio CLI..." -ForegroundColor Cyan
    $lmsPath = Find-Lms
    $versionResult = Invoke-Lms $lmsPath @("version") -AllowFailure
    $lmsVersion = if ($versionResult.Code -eq 0) { $versionResult.Output.Trim() } else { "VERSION_UNAVAILABLE" }

    Write-Host "[3/6] Verifying LM Studio server without assuming daemon commands..." -ForegroundColor Cyan
    $serverBefore = Invoke-Lms $lmsPath @("server","status") -AllowFailure
    $serverTextBefore = $serverBefore.Output
    $serverRunning = $serverTextBefore -match "(?i)(running|listening|active|started)"
    $serverStartAttempted = $false
    $serverStartSucceeded = $false

    if (-not $serverRunning) {
        $serverStartAttempted = $true
        $startResult = Invoke-Lms $lmsPath @("server","start","--port","1234") -AllowFailure
        $serverStartSucceeded = ($startResult.Code -eq 0)
        if (-not $serverStartSucceeded) {
            Write-Host ("WARN: LM Studio server start returned non-zero: " + $startResult.Output) -ForegroundColor Yellow
        }
    }

    $serverAfter = Invoke-Lms $lmsPath @("server","status") -AllowFailure
    $serverTextAfter = $serverAfter.Output
    $serverRunningAfter = $serverTextAfter -match "(?i)(running|listening|active|started)"

    Write-Host "[4/6] Discovering installed models..." -ForegroundColor Cyan
    $modelsResult = Invoke-Lms $lmsPath @("ls")
    $loadedResult = Invoke-Lms $lmsPath @("ps") -AllowFailure

    $gptPattern = "(?i)gpt-oss-20b|openai/gpt-oss-20b"
    $gptAvailable = $modelsResult.Output -match $gptPattern
    $gptLoaded = $loadedResult.Output -match $gptPattern
    $loadAttempted = $false
    $loadSucceeded = $false

    Write-Host "[5/6] Ensuring GPT-OSS 20B is available when installed..." -ForegroundColor Cyan
    if ($gptAvailable -and (-not $gptLoaded)) {
        $loadAttempted = $true
        $loadResult = Invoke-Lms $lmsPath @("load","openai/gpt-oss-20b","--gpu=auto") -AllowFailure
        $loadSucceeded = ($loadResult.Code -eq 0)
        if (-not $loadSucceeded) {
            Write-Host ("WARN: GPT-OSS 20B load returned non-zero: " + $loadResult.Output) -ForegroundColor Yellow
        }
    }

    Write-Host "[6/6] Writing BEC work state and proof..." -ForegroundColor Cyan
    $handoff = Join-Path $DataRoot "ACTIVE-WORK-STATE.json"
    Write-Json $handoff ([ordered]@{
        schema="BEC-ACTIVE-WORK-STATE-2.3"
        mission="AUTONOMOUS-REVENUE-ENGINE"
        active_repo=$RepoRoot
        compiler_entry="BEC-PRIME\bec.cmd"
        compiler_targets=@("website","game","app")
        commercial_priority=@("BILLBOARD-TEXT-TILE-001","DIGITAL-PRODUCT-CATALOG","PHYSICAL-MTG-INVENTORY")
        model_team=@(
            @{role="proposer";model="openai/gpt-oss-20b"},
            @{role="critic";model="qwen2.5-coder-14b-instruct"},
            @{role="synthesizer";model="local-controller"}
        )
        lmstudio_cli=$lmsPath
        lmstudio_version=$lmsVersion
        lmstudio_server="http://127.0.0.1:1234"
        lmstudio_server_confirmed=$serverRunningAfter
        lmstudio_server_start_attempted=$serverStartAttempted
        lmstudio_server_start_succeeded=$serverStartSucceeded
        gpt_oss_20b_available=$gptAvailable
        gpt_oss_20b_loaded_before_boot=$gptLoaded
        gpt_oss_20b_load_attempted=$loadAttempted
        gpt_oss_20b_load_succeeded=$loadSucceeded
        public_actions="APPROVAL_REQUIRED"
        autonomous_spend_nzd=0
        updated_at_utc=(Get-Date).ToUniversalTime().ToString("o")
    })

    $bec = Join-Path $RepoRoot "BEC-PRIME\bec.cmd"
    if (-not (Test-Path -LiteralPath $bec)) {
        throw "BEC command missing: $bec"
    }

    Push-Location (Join-Path $RepoRoot "BEC-PRIME")
    try {
        & cmd.exe /c "bec.cmd status" *>&1 |
            Tee-Object -FilePath (Join-Path $LogRoot "bec-status.log") |
            Out-Host
        if ($LASTEXITCODE -ne 0) { throw "BEC status failed." }
    }
    finally {
        Pop-Location
    }

    $gptLoadedAfter = (Invoke-Lms $lmsPath @("ps") -AllowFailure).Output -match $gptPattern

    $proof = [ordered]@{
        schema="BEC-10MINUTE-BOOTSTRAP-2.3"
        status="PASS"
        repo=$RepoRoot
        data_root=$DataRoot
        known_startup_tasks_disabled=$disabled
        lmstudio_cli=$lmsPath
        lmstudio_version=$lmsVersion
        lmstudio_server_status_before=$serverTextBefore
        lmstudio_server_status_after=$serverTextAfter
        lmstudio_server_confirmed=$serverRunningAfter
        lmstudio_server_start_attempted=$serverStartAttempted
        lmstudio_server_start_succeeded=$serverStartSucceeded
        gpt_oss_20b_available=$gptAvailable
        gpt_oss_20b_loaded_before_boot=$gptLoaded
        gpt_oss_20b_loaded_after_boot=$gptLoadedAfter
        gpt_oss_20b_load_attempted=$loadAttempted
        gpt_oss_20b_load_succeeded=$loadSucceeded
        compiler_entry=$bec
        compiler_status="PASS"
        active_work_state=$handoff
        timestamp_utc=(Get-Date).ToUniversalTime().ToString("o")
    }
    Write-Json (Join-Path $ProofRoot "BOOTSTRAP-10MIN-LATEST.json") $proof
    Write-Host "BOOTSTRAP 10-MINUTE PASS" -ForegroundColor Green
    Write-Host ("Proof: " + (Join-Path $ProofRoot "BOOTSTRAP-10MIN-LATEST.json")) -ForegroundColor Green
}
catch {
    $proof = [ordered]@{
        schema="BEC-10MINUTE-BOOTSTRAP-2.3"
        status="FAIL"
        error=$_.Exception.Message
        timestamp_utc=(Get-Date).ToUniversalTime().ToString("o")
    }
    Write-Json (Join-Path $ProofRoot "BOOTSTRAP-10MIN-LATEST.json") $proof
    Write-Host "BOOTSTRAP FAILED: $($_.Exception.Message)" -ForegroundColor Red
    throw
}
finally {
    Stop-Transcript | Out-Null
}
