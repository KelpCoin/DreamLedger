#Requires -Version 5.1
[CmdletBinding()]
param(
  [string]$RepoRoot = "",
  [string]$ProofRoot = "",
  [switch]$ConfigureDiscordCloudSecret,
  [switch]$SkipEconomicBootstrap
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($RepoRoot)) { $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path }
$RepoRoot = (Resolve-Path $RepoRoot).Path
if ([string]::IsNullOrWhiteSpace($ProofRoot)) {
  $ProofRoot = if (Test-Path 'D:\') { 'D:\BrownEyeCortex\Runtime\proofs' } else { Join-Path $HOME 'BrownEyeCortex\Runtime\proofs' }
}
$cockpitRoot = Join-Path $ProofRoot 'cockpit'
$null = New-Item -ItemType Directory -Force -Path $cockpitRoot
$master = Join-Path $cockpitRoot 'COCKPIT-BOOTSTRAP-LATEST.json'
$log = Join-Path $cockpitRoot 'COCKPIT-BOOTSTRAP-LATEST.log'
$started = [DateTime]::UtcNow
$checks = [System.Collections.Generic.List[object]]::new()
function Add-Check([string]$Name,[string]$Status,[string]$Detail) { $checks.Add([ordered]@{name=$Name;status=$Status;detail=$Detail}) }
function Save-Proof([string]$Status) {
  $p = [ordered]@{schema='DREAMLEDGER-COCKPIT-BOOTSTRAP/v1';status=$Status;generated_at_utc=[DateTime]::UtcNow.ToString('o');elapsed_seconds=[math]::Round(([DateTime]::UtcNow-$started).TotalSeconds,2);repo_root=$RepoRoot;proof_root=$ProofRoot;checks=@($checks);safety=@('Read-only validation; no purchases, public posts, deployments or database writes.','Discord notifications remain disabled unless separately and explicitly configured.','Webhook values are never written to proof files or logs.')}
  $p | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $master -Encoding UTF8
}
try {
  Start-Transcript -Path $log -Force | Out-Null
  Write-Host 'PRIVATE_ECONOMIC_COCKPIT_BOOTSTRAP=1'
  Write-Host "REPO_ROOT=$RepoRoot"
  Write-Host "PROOF_ROOT=$ProofRoot"
  $node = Get-Command node.exe -ErrorAction SilentlyContinue
  if (-not $node) { Add-Check 'runtime.node' 'BLOCKED' 'Node.js 20+ must be installed and on PATH.'; Save-Proof 'BLOCKED'; exit 2 }
  $v = (& node.exe --version 2>&1 | Out-String).Trim()
  if ($v -notmatch '^v(\d+)\.' -or [int]$Matches[1] -lt 20) { Add-Check 'runtime.node' 'BLOCKED' "Node.js 20+ required; found $v"; Save-Proof 'BLOCKED'; exit 2 }
  Add-Check 'runtime.node' 'PASS' $v

  if (-not $SkipEconomicBootstrap) {
    $startScript = Join-Path $RepoRoot 'scripts\beck-startup.ps1'
    if (Test-Path $startScript) {
      $out = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $startScript -RepoRoot $RepoRoot -ProofRoot $ProofRoot 2>&1
      $code = $LASTEXITCODE
      $joined = (($out | ForEach-Object {[string]$_}) -join "`n")
      Add-Check 'economic.preflight' $(if ($code -eq 0) {'PASS'} else {'BLOCKED'}) ("exit=$code; " + $joined.Substring(0,[Math]::Min(2500,$joined.Length)))
    } else { Add-Check 'economic.preflight' 'BLOCKED' "Missing $startScript" }
  } else { Add-Check 'economic.preflight' 'SKIPPED' 'Explicitly skipped by operator.' }

  $cockpitScript = Join-Path $RepoRoot 'ops\cockpit\figure-eight-cockpit.mjs'
  $renderScript = Join-Path $RepoRoot 'ops\cockpit\render-cockpit-html.mjs'
  if (-not (Test-Path $cockpitScript)) { Add-Check 'cockpit.scorer' 'FAIL' "Missing $cockpitScript"; Save-Proof 'FAIL'; exit 1 }
  $env:COCKPIT_REPORT_PATH = Join-Path $cockpitRoot 'figure-eight-cockpit-latest.json'
  $env:COCKPIT_LOCAL_PROOF_JSON = Join-Path $ProofRoot 'BECK-STARTUP-LATEST.json'
  $env:COCKPIT_PRIVATE_MODE = 'true'
  $out = & node.exe $cockpitScript 2>&1
  $code = $LASTEXITCODE
  $joined = (($out | ForEach-Object {[string]$_}) -join "`n")
  Add-Check 'cockpit.report' $(if ($code -eq 0) {'PASS'} else {'FAIL'}) $joined
  if ($code -eq 0 -and (Test-Path $renderScript)) {
    $null = & node.exe $renderScript $env:COCKPIT_REPORT_PATH (Join-Path $cockpitRoot 'index.html') 2>&1
    Add-Check 'cockpit.html' $(if ($LASTEXITCODE -eq 0) {'PASS'} else {'FAIL'}) 'Rendered private local cockpit HTML from the canonical cloud cockpit report.'
  } else { Add-Check 'cockpit.html' 'BLOCKED' 'Cockpit HTML renderer missing or JSON report failed.' }

  if ($ConfigureDiscordCloudSecret) {
    $gh = Get-Command gh.exe -ErrorAction SilentlyContinue
    if (-not $gh) { Add-Check 'discord.cloud_secret' 'BLOCKED' 'GitHub CLI not found. Install gh, authenticate, then rerun with -ConfigureDiscordCloudSecret.' }
    else {
      $auth = & gh.exe auth status 2>&1
      if ($LASTEXITCODE -ne 0) { Add-Check 'discord.cloud_secret' 'BLOCKED' 'GitHub CLI is not authenticated. No secret was changed.' }
      else {
        Write-Host 'Discord webhook setup: paste the webhook only into this local secure prompt. It will be sent to GitHub as a secret and not saved in this script.'
        $secure = Read-Host 'Private Discord incoming webhook URL (blank cancels)' -AsSecureString
        $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
        if ([string]::IsNullOrWhiteSpace($plain)) { Add-Check 'discord.cloud_secret' 'SKIPPED' 'No webhook entered; no secret changed.' }
        elseif ($plain -notmatch '^https://discord(?:app)?\.com/api/webhooks/\d+/[A-Za-z0-9_\-]+$') { Add-Check 'discord.cloud_secret' 'BLOCKED' 'Value did not match the expected Discord webhook URL shape; no secret changed.'; $plain = $null }
        else {
          # Pipe through stdin; never place the webhook in command arguments, console output or proof.
          $plain | & gh.exe secret set COCKPIT_DISCORD_WEBHOOK_URL --repo KelpCoin/DreamLedger 2>$null
          $setCode = $LASTEXITCODE
          $plain = $null
          Add-Check 'discord.cloud_secret' $(if ($setCode -eq 0) {'PASS'} else {'FAIL'}) $(if ($setCode -eq 0) {'GitHub repository secret updated. Sending remains disabled until the separate enable flag and kill-switch settings are deliberately changed.'} else {'gh secret set failed. Webhook value was not recorded in the proof.'})
        }
      }
    }
  } else { Add-Check 'discord.cloud_secret' 'SKIPPED' 'No Discord webhook was requested. Notifications remain disabled.' }

  $status = if (@($checks | Where-Object {$_.status -eq 'FAIL'}).Count -gt 0) {'FAIL'} elseif (@($checks | Where-Object {$_.status -eq 'BLOCKED'}).Count -gt 0) {'BLOCKED'} else {'PASS'}
  Save-Proof $status
  Write-Host "COCKPIT_STATUS=$status"
  Write-Host "COCKPIT_HTML=$(Join-Path $ProofRoot 'cockpit\index.html')"
  Write-Host "COCKPIT_JSON=$(Join-Path $cockpitRoot 'figure-eight-cockpit-latest.json')"
  Write-Host "BOOTSTRAP_PROOF=$master"
  Write-Host 'NOTIFICATIONS=OFF_BY_DEFAULT; KILL_SWITCH=ON_UNLESS_EXPLICITLY_DISABLED'
  if ($status -eq 'FAIL') { exit 1 } elseif ($status -eq 'BLOCKED') { exit 2 } else { exit 0 }
} catch {
  Add-Check 'bootstrap.exception' 'FAIL' $_.Exception.Message
  Save-Proof 'FAIL'
  Write-Host "COCKPIT_STATUS=FAIL"
  Write-Host "BOOTSTRAP_PROOF=$master"
  exit 1
} finally {
  try { Stop-Transcript | Out-Null } catch {}
}
