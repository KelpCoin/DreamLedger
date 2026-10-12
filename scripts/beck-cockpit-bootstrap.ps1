#Requires -Version 5.1
[CmdletBinding()]
param([string]$RepoRoot = "", [string]$ProofRoot = "", [switch]$SkipEconomicBootstrap)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($RepoRoot)) { $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path }
$RepoRoot = (Resolve-Path $RepoRoot).Path
if ([string]::IsNullOrWhiteSpace($ProofRoot)) { $ProofRoot = if (Test-Path 'D:\') { 'D:\BrownEyeCortex\Runtime\proofs' } else { Join-Path $HOME 'BrownEyeCortex\Runtime\proofs' } }
$cockpitRoot = Join-Path $ProofRoot 'cockpit'
$null = New-Item -ItemType Directory -Force -Path $cockpitRoot
$master = Join-Path $cockpitRoot 'COCKPIT-BOOTSTRAP-LATEST.json'
$log = Join-Path $cockpitRoot 'COCKPIT-BOOTSTRAP-LATEST.log'
$started = [DateTime]::UtcNow
$checks = [System.Collections.Generic.List[object]]::new()
function Add-Check([string]$Name,[string]$Status,[string]$Detail) { $checks.Add([ordered]@{name=$Name;status=$Status;detail=$Detail}) }
function Save-Proof([string]$Status) {
  $p = [ordered]@{schema='DREAMLEDGER-COCKPIT-BOOTSTRAP/v1';status=$Status;generated_at_utc=[DateTime]::UtcNow.ToString('o');elapsed_seconds=[math]::Round(([DateTime]::UtcNow-$started).TotalSeconds,2);repo_root=$RepoRoot;proof_root=$ProofRoot;checks=@($checks);safety=@('Read-only validation; no purchases, public posts, deployments or database writes.','Discord notifications default off and the kill switch defaults to ON.','No webhook or API secret is requested, displayed, logged, or stored by this bootstrap.')}
  $p | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $master -Encoding UTF8
}
try {
  Start-Transcript -Path $log -Force | Out-Null
  Write-Host 'PRIVATE_ECONOMIC_COCKPIT_BOOTSTRAP=1'
  Write-Host "REPO_ROOT=$RepoRoot"
  Write-Host "PROOF_ROOT=$ProofRoot"
  $node = Get-Command node.exe -ErrorAction SilentlyContinue
  if (-not $node) { Add-Check 'local.node_version' 'BLOCKED' 'Node.js 20+ must be installed and on PATH.'; Save-Proof 'BLOCKED'; exit 2 }
  $v = (& node.exe --version 2>&1 | Out-String).Trim()
  if ($v -notmatch '^v(\d+)\.' -or [int]$Matches[1] -lt 20) { Add-Check 'local.node_version' 'BLOCKED' "Node.js 20+ required; found $v"; Save-Proof 'BLOCKED'; exit 2 }
  Add-Check 'local.node_version' 'PASS' $v

  if (-not $SkipEconomicBootstrap) {
    $startScript = Join-Path $RepoRoot 'scripts\beck-startup.ps1'
    if (Test-Path $startScript) {
      $out = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $startScript -RepoRoot $RepoRoot -ProofRoot $ProofRoot 2>&1
      $code = $LASTEXITCODE
      $joined = (($out | ForEach-Object {[string]$_}) -join "`n")
      Add-Check 'local.daily_bootstrap' $(if ($code -eq 0) {'PASS'} else {'BLOCKED'}) ("exit=$code; " + $joined.Substring(0,[Math]::Min(2500,$joined.Length)))
    } else { Add-Check 'local.daily_bootstrap' 'BLOCKED' "Missing $startScript" }
  } else { Add-Check 'local.daily_bootstrap' 'SKIPPED' 'Economic bootstrap explicitly skipped.' }

  $cockpitScript = Join-Path $RepoRoot 'ops\cockpit\figure-eight-cockpit.mjs'
  $renderScript = Join-Path $RepoRoot 'ops\cockpit\render-cockpit-html.mjs'
  if (-not (Test-Path $cockpitScript)) { Add-Check 'cockpit.report' 'FAIL' "Missing $cockpitScript"; Save-Proof 'FAIL'; exit 1 }
  $env:COCKPIT_REPORT_PATH = Join-Path $cockpitRoot 'figure-eight-cockpit-latest.json'
  $env:COCKPIT_LOCAL_PROOF_JSON = Join-Path $ProofRoot 'heartbeat\LOCAL-HEARTBEAT-LATEST.json'
  $env:COCKPIT_PRIVATE_MODE = 'true'
  $out = & node.exe $cockpitScript 2>&1
  $code = $LASTEXITCODE
  Add-Check 'cockpit.report' $(if ($code -eq 0) {'PASS'} else {'FAIL'}) (($out | ForEach-Object {[string]$_}) -join "`n")
  if ($code -eq 0 -and (Test-Path $renderScript)) {
    $null = & node.exe $renderScript $env:COCKPIT_REPORT_PATH (Join-Path $cockpitRoot 'index.html') 2>&1
    Add-Check 'cockpit.html' $(if ($LASTEXITCODE -eq 0) {'PASS'} else {'FAIL'}) 'Rendered private local cockpit HTML.'
  } else { Add-Check 'cockpit.html' 'BLOCKED' 'HTML renderer missing or report generation failed.' }

  $status = if (@($checks | Where-Object {$_.status -eq 'FAIL'}).Count -gt 0) {'FAIL'} elseif (@($checks | Where-Object {$_.status -eq 'BLOCKED'}).Count -gt 0) {'BLOCKED'} else {'PASS'}
  Save-Proof $status
  Write-Host "COCKPIT_STATUS=$status"
  Write-Host "COCKPIT_HTML=$(Join-Path $cockpitRoot 'index.html')"
  Write-Host "COCKPIT_JSON=$(Join-Path $cockpitRoot 'figure-eight-cockpit-latest.json')"
  Write-Host "BOOTSTRAP_PROOF=$master"
  Write-Host 'DISCORD=OFF_BY_DEFAULT; KILL_SWITCH=ON'
  if ($status -eq 'FAIL') { exit 1 } elseif ($status -eq 'BLOCKED') { exit 2 } else { exit 0 }
} catch {
  Add-Check 'bootstrap.exception' 'FAIL' $_.Exception.Message
  Save-Proof 'FAIL'
  Write-Host 'COCKPIT_STATUS=FAIL'
  Write-Host "BOOTSTRAP_PROOF=$master"
  exit 1
} finally { try { Stop-Transcript | Out-Null } catch {} }
