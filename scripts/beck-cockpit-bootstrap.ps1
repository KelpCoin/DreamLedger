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
  $p = [ordered]@{schema='DREAMLEDGER-COCKPIT-BOOTSTRAP/v1';status=$Status;generated_at_utc=[DateTime]::UtcNow.ToString('o');elapsed_seconds=[math]::Round(([DateTime]::UtcNow-$started).TotalSeconds,2);repo_root=$RepoRoot;proof_root=$ProofRoot;checks=@($checks);safety=@('Read-only validation; no purchases, public posts, deployments or database writes.','Discord notifications remain disabled unless separately and explicitly configured.','Webhook values are never requested, written to proof files or logged.')}
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
  $scorer = Join-Path $RepoRoot 'ops\cockpit\economic-cockpit.mjs'
  if (-not (Test-Path $scorer)) { Add-Check 'cockpit.scorer' 'FAIL' "Missing $scorer"; Save-Proof 'FAIL'; exit 1 }
  $env:DREAMLEDGER_PROOF_ROOT = $ProofRoot
  $out = & node.exe $scorer 2>&1
  $code = $LASTEXITCODE
  $joined = (($out | ForEach-Object {[string]$_}) -join "`n")
  Add-Check 'cockpit.report' $(if ($code -eq 0) {'PASS'} else {'FAIL'}) $joined
  $status = if (@($checks | Where-Object {$_.status -eq 'FAIL'}).Count -gt 0) {'FAIL'} elseif (@($checks | Where-Object {$_.status -eq 'BLOCKED'}).Count -gt 0) {'BLOCKED'} else {'PASS'}
  Save-Proof $status
  Write-Host "COCKPIT_STATUS=$status"
  Write-Host "COCKPIT_HTML=$(Join-Path $ProofRoot 'cockpit\index.html')"
  Write-Host "COCKPIT_JSON=$(Join-Path $ProofRoot 'cockpit\cockpit-latest.json')"
  Write-Host "BOOTSTRAP_PROOF=$master"
  Write-Host 'NOTIFICATIONS=OFF_BY_DEFAULT'
  if ($status -eq 'FAIL') { exit 1 } elseif ($status -eq 'BLOCKED') { exit 2 } else { exit 0 }
} catch {
  Add-Check 'bootstrap.exception' 'FAIL' $_.Exception.Message
  Save-Proof 'FAIL'
  Write-Host "COCKPIT_STATUS=FAIL"
  Write-Host "BOOTSTRAP_PROOF=$master"
  exit 1
} finally { try { Stop-Transcript | Out-Null } catch {} }
