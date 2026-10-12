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
    $proof = [ordered]@{
        schema = 'BECK-STARTUP-ORCHESTRATOR/v1'
        status = $Status
        generated_at_utc = [DateTime]::UtcNow.ToString('o')
        elapsed_seconds = [math]::Round(([DateTime]::UtcNow - $started).TotalSeconds,2)
        repository = $RepoRoot
        local_daily_root = $dailyRoot
        proof_root = $ProofRoot
        checks = @($checks)
        safety = @(
            'Runs existing local daily bootstrap and read-only economic bootstrap.',
            'Does not deploy, alter Stripe webhook endpoints, write Supabase data, send messages, or make purchases.',
            'A blocked money path is reported as BLOCKED, not disguised as a startup failure or revenue.'
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
    if (Test-Path -LiteralPath $dailyScript) {
        $dailyOutput = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $dailyScript -Root $dailyRoot -Port 1234 2>&1
        $dailyCode = $LASTEXITCODE
        $dailyText = (($dailyOutput | ForEach-Object {[string]$_}) -join "`n")
        Add-StartupCheck 'local.daily_bootstrap' $(if ($dailyCode -eq 0) {'PASS'} else {'BLOCKED'}) ("exit=$dailyCode; output=" + $dailyText.Substring(0,[Math]::Min(3500,$dailyText.Length)))
    } else {
        Add-StartupCheck 'local.daily_bootstrap' 'BLOCKED' "Missing existing bootstrap: $dailyScript"
    }

    $economicScript = Join-Path $RepoRoot 'scripts/beck-economic-bootstrap.ps1'
    if (Test-Path -LiteralPath $economicScript) {
        $moneyProof = Join-Path $ProofRoot 'BECK-ECONOMIC-VALIDATION-LATEST.json'
        $economicOutput = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $economicScript -RepoRoot $RepoRoot -ProofPath $moneyProof 2>&1
        $economicCode = $LASTEXITCODE
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
