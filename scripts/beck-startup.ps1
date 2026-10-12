#Requires -Version 5.1
[CmdletBinding()]
param(
    [string]$RepoRoot = "",
    [string]$ProofRoot = ""
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}
if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot 'package.json'))) {
    throw "BLOCKED: package.json not found under RepoRoot=$RepoRoot"
}
$RepoRoot = (Resolve-Path $RepoRoot).Path
if ([string]::IsNullOrWhiteSpace($ProofRoot)) {
    $ProofRoot = if (Test-Path 'D:\') { 'D:\BrownEyeCortex\Runtime\proofs' } else { Join-Path $HOME 'BrownEyeCortex\Runtime\proofs' }
}
$null = New-Item -ItemType Directory -Force -Path $ProofRoot
$dailyRoot = Join-Path (Split-Path -Parent $ProofRoot) 'daily'
$masterPath = Join-Path $ProofRoot 'BECK-STARTUP-LATEST.json'
$logPath = Join-Path $ProofRoot 'BECK-STARTUP-LATEST.log'
$started = [DateTime]::UtcNow
$checks = [System.Collections.Generic.List[object]]::new()
function Add-StartupCheck([string]$Name,[string]$Status,[string]$Detail) {
    $checks.Add([ordered]@{name=$Name;status=$Status;detail=$Detail})
}
function Save-StartupProof([string]$Status) {
    $rubric = @(
        @{name='local.node_version';points=100},
        @{name='local.daily_bootstrap';points=100},
        @{name='local.lm_studio_api';points=150},
        @{name='local.inference';points=250},
        @{name='local.gpu_telemetry';points=100},
        @{name='local.proof_persisted';points=100},
        @{name='local.safe_defaults';points=100},
        @{name='local.backup_restore';points=50},
        @{name='local.three_role_readiness';points=50}
    )
    $localScore = 0
    $scoreRows = @(
        foreach ($rule in $rubric) {
            $found = @($checks | Where-Object { $_.name -eq $rule.name } | Select-Object -First 1)
            $checkStatus = if ($found.Count -gt 0) { [string]$found[0].status } else { 'UNVERIFIED' }
            $earned = if ($checkStatus -eq 'PASS') { [int]$rule.points } else { 0 }
            $localScore += $earned
            [ordered]@{name=$rule.name;points=[int]$rule.points;earned=$earned;status=$checkStatus}
        }
    )
    $proof = [ordered]@{
        schema = 'BECK-STARTUP-ORCHESTRATOR/v2'
        status = $Status
        generated_at_utc = [DateTime]::UtcNow.ToString('o')
        elapsed_seconds = [math]::Round(([DateTime]::UtcNow - $started).TotalSeconds,2)
        repository = $RepoRoot
        local_daily_root = $dailyRoot
        proof_root = $ProofRoot
        local_score_out_of_10000 = ($localScore * 10)
        local_score_status = if ($localScore -eq 1000) {'VERIFIED_10000'} else {'IMPROVEMENT_REQUIRED'}
        local_score_breakdown = $scoreRows
        checks = @($checks)
        safety = @(
            'Runs existing local daily bootstrap and read-only economic bootstrap.',
            'Does not deploy, alter Stripe webhook endpoints, write Supabase data, send messages, or make purchases.',
            'A blocked money path is reported as BLOCKED, not disguised as a startup failure or revenue.',
            'Local inference, backup restore, and three-role readiness receive no points without explicit proof.'
        )
    }
    $tmp = "$masterPath.tmp"
    $proof | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $tmp -Encoding UTF8
    Move-Item -LiteralPath $tmp -Destination $masterPath -Force
}

$transcriptStarted = $false
try {
    try { Start-Transcript -Path $logPath -Force | Out-Null; $transcriptStarted = $true } catch {}
    Write-Host 'BECK_STARTUP=1'
    Write-Host "REPOSITORY=$RepoRoot"
    Write-Host "PROOF_ROOT=$ProofRoot"
    $node = Get-Command node.exe -ErrorAction SilentlyContinue
    $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if (-not $node -or -not $npm) {
        Add-StartupCheck 'local.node_and_npm' 'BLOCKED' 'Install Node.js 20+ or make node.exe and npm.cmd available on PATH.'
        Save-StartupProof 'BLOCKED'
        Write-Host "STARTUP_STATUS=BLOCKED"
        Write-Host "PROOF=$masterPath"
        exit 2
    }
    $nodeVersion = (& node.exe --version 2>&1 | Out-String).Trim()
    if ($nodeVersion -notmatch '^v(\d+)\.' -or [int]$Matches[1] -lt 20) {
        Add-StartupCheck 'local.node_version' 'BLOCKED' "Node.js 20+ required; found $nodeVersion"
        Save-StartupProof 'BLOCKED'
        Write-Host "STARTUP_STATUS=BLOCKED"
        Write-Host "PROOF=$masterPath"
        exit 2
    }
    Add-StartupCheck 'local.node_version' 'PASS' $nodeVersion

    $dailyScript = Join-Path $RepoRoot 'scripts/beck-daily-bootstrap.ps1'
    $dailyProof = $null
    $dailyProofPath = $null
    if (Test-Path -LiteralPath $dailyScript) {
        $dailyOutput = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $dailyScript -Root $dailyRoot -Port 1234 2>&1
        $dailyCode = $LASTEXITCODE
        $dailyText = (($dailyOutput | ForEach-Object {[string]$_}) -join "`n")
        $dailyProofFiles = @(Get-ChildItem -LiteralPath $dailyRoot -Filter 'bootstrap-proof.json' -File -Recurse -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending)
        if ($dailyProofFiles.Count -gt 0) {
            $dailyProofPath = $dailyProofFiles[0].FullName
            try { $dailyProof = Get-Content -LiteralPath $dailyProofPath -Raw | ConvertFrom-Json } catch { $dailyProof = $null }
        }
        $dailyOk = $dailyCode -eq 0 -and $null -ne $dailyProof
        Add-StartupCheck 'local.daily_bootstrap' $(if ($dailyOk) {'PASS'} elseif ($dailyCode -ne 0) {'FAIL'} else {'BLOCKED'}) ("exit=$dailyCode; proof=" + [string]$dailyProofPath + "; output=" + $dailyText.Substring(0,[Math]::Min(2500,$dailyText.Length)))
        $lmStatus = if ($dailyProof) { [string]$dailyProof.checks.lm_studio.status } else { 'UNVERIFIED' }
        $inferenceStatus = if ($dailyProof) { [string]$dailyProof.checks.inference.status } else { 'UNVERIFIED' }
        $gpuStatus = if ($dailyProof) { [string]$dailyProof.checks.gpu.status } else { 'UNVERIFIED' }
        Add-StartupCheck 'local.lm_studio_api' $(if ($lmStatus -eq 'API_AND_MODEL_LIST_OBSERVED') {'PASS'} else {'BLOCKED'}) ("LM Studio status=" + $lmStatus)
        Add-StartupCheck 'local.inference' $(if ($inferenceStatus -eq 'PASS') {'PASS'} elseif ($inferenceStatus -eq 'FAIL') {'FAIL'} else {'BLOCKED'}) ("Inference smoke test=" + $inferenceStatus)
        Add-StartupCheck 'local.gpu_telemetry' $(if ($gpuStatus -eq 'OBSERVED') {'PASS'} else {'BLOCKED'}) ("GPU telemetry=" + $gpuStatus)
        Add-StartupCheck 'local.proof_persisted' $(if ($null -ne $dailyProof) {'PASS'} else {'FAIL'}) ("Daily proof file=" + [string]$dailyProofPath)
    } else {
        Add-StartupCheck 'local.daily_bootstrap' 'BLOCKED' "Missing existing bootstrap: $dailyScript"
        Add-StartupCheck 'local.lm_studio_api' 'BLOCKED' 'Daily bootstrap is missing.'
        Add-StartupCheck 'local.inference' 'BLOCKED' 'Daily bootstrap is missing.'
        Add-StartupCheck 'local.gpu_telemetry' 'BLOCKED' 'Daily bootstrap is missing.'
        Add-StartupCheck 'local.proof_persisted' 'FAIL' 'Daily proof was not written.'
    }
    Add-StartupCheck 'local.safe_defaults' 'PASS' 'Startup does not write Supabase data, deploy code, change Stripe, or send customer messages.'
    Add-StartupCheck 'local.backup_restore' 'BLOCKED' 'Encrypted backup restore has not been independently tested by this bootstrap.'
    Add-StartupCheck 'local.three_role_readiness' 'BLOCKED' 'Three-role model residency and behavior are not yet verified.'

    $economicScript = Join-Path $RepoRoot 'scripts/beck-economic-bootstrap.ps1'
    if (Test-Path -LiteralPath $economicScript) {
        # Enable only read-only live Stripe GETs when a live-mode secret is already present.
        # Never print, copy, or persist the key. A test key must not trigger live reconciliation.
        $previousStripeEnabled = $env:STRIPE_LIVE_ENABLED
        if ($env:STRIPE_SECRET_KEY -match '^(sk_live_|rk_live_)') {
            $env:STRIPE_LIVE_ENABLED = 'true'
            Add-StartupCheck 'stripe.live_read_only' 'PASS' 'Live-mode key detected; read-only Stripe endpoint and payment reconciliation enabled for this child process.'
        } else {
            $env:STRIPE_LIVE_ENABLED = 'false'
            Add-StartupCheck 'stripe.live_read_only' 'BLOCKED' 'No live-mode Stripe key detected in the process environment; webhook routing and live payment reconciliation will be skipped.'
        }
        $moneyProof = Join-Path $ProofRoot 'BECK-ECONOMIC-VALIDATION-LATEST.json'
        $economicOutput = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $economicScript -RepoRoot $RepoRoot -ProofPath $moneyProof 2>&1
        $economicCode = $LASTEXITCODE
        $env:STRIPE_LIVE_ENABLED = $previousStripeEnabled
        $economicText = (($economicOutput | ForEach-Object {[string]$_}) -join "`n")
        $moneyStatus = if ($economicCode -eq 0) {'PASS'} elseif ($economicCode -eq 2) {'BLOCKED'} else {'FAIL'}
        Add-StartupCheck 'economic.money_path' $moneyStatus ("exit=$economicCode; output=" + $economicText.Substring(0,[Math]::Min(5000,$economicText.Length)))
    } else {
        Add-StartupCheck 'economic.money_path' 'BLOCKED' "Missing existing bootstrap: $economicScript"
    }

    $hasFail = @($checks | Where-Object {$_.status -eq 'FAIL'}).Count -gt 0
    $hasBlocked = @($checks | Where-Object {$_.status -eq 'BLOCKED'}).Count -gt 0
    $status = if ($hasFail) {'FAIL'} elseif ($hasBlocked) {'BLOCKED'} else {'PASS'}
    Save-StartupProof $status
    Write-Host "`nSTARTUP_STATUS=$status"
    Write-Host "PROOF=$masterPath"
    Write-Host "LOG=$logPath"
    if ($status -eq 'FAIL') { exit 1 }
    if ($status -eq 'BLOCKED') { exit 2 }
    exit 0
} catch {
    Add-StartupCheck 'orchestrator.exception' 'FAIL' $_.Exception.Message
    try { Save-StartupProof 'FAIL' } catch {}
    Write-Error $_
    exit 1
} finally {
    if ($transcriptStarted) { try { Stop-Transcript | Out-Null } catch {} }
}
