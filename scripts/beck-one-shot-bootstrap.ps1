#Requires -Version 5.1
[CmdletBinding()]
param([string]$RepoRoot = "")
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$Branch = 'fix/beck-canonical-offer-and-supabase-failure'
$RepoUrl = 'https://github.com/KelpCoin/DreamLedger.git'
if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $base = if (Test-Path 'D:\') { 'D:\BrownEyeCortex\Runtime' } else { Join-Path $HOME 'BrownEyeCortex\Runtime' }
  $RepoRoot = Join-Path $base 'DreamLedger-heartbeat'
}
$parent = Split-Path -Parent $RepoRoot
$null = New-Item -ItemType Directory -Force -Path $parent
$git = Get-Command git.exe -ErrorAction SilentlyContinue
if (-not $git) { throw 'BLOCKED: Git for Windows is required. Install Git, reopen PowerShell, and rerun this bootstrap.' }
if (-not (Test-Path (Join-Path $RepoRoot '.git'))) {
  if (Test-Path $RepoRoot) {
    $existing = @(Get-ChildItem -LiteralPath $RepoRoot -Force -ErrorAction SilentlyContinue)
    if ($existing.Count -gt 0) { throw "Refusing to overwrite non-empty folder: $RepoRoot" }
    Remove-Item -LiteralPath $RepoRoot -Force
  }
  & git.exe clone --depth 1 --branch $Branch $RepoUrl $RepoRoot
  if ($LASTEXITCODE -ne 0) { throw "Git clone failed with exit code $LASTEXITCODE" }
} else {
  & git.exe -C $RepoRoot fetch --depth 1 origin $Branch
  if ($LASTEXITCODE -ne 0) { throw "Git fetch failed with exit code $LASTEXITCODE" }
  & git.exe -C $RepoRoot checkout -B $Branch FETCH_HEAD
  if ($LASTEXITCODE -ne 0) { throw "Git checkout failed with exit code $LASTEXITCODE" }
}
$RepoRoot = (Resolve-Path $RepoRoot).Path
$proofRoot = if (Test-Path 'D:\') { 'D:\BrownEyeCortex\Runtime\proofs' } else { Join-Path $HOME 'BrownEyeCortex\Runtime\proofs' }
$null = New-Item -ItemType Directory -Force -Path $proofRoot
Write-Output "REPO_ROOT=$RepoRoot"
Write-Output "PROOF_ROOT=$proofRoot"
Write-Output 'PHASE=INSTALL_LOCAL_HEARTBEAT'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot 'scripts\install-beck-heartbeat.ps1') -RepoRoot $RepoRoot
if ($LASTEXITCODE -ne 0) { throw "Local heartbeat installation failed: $LASTEXITCODE" }
Write-Output 'PHASE=RUN_LOCAL_HEARTBEAT_NOW'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot 'scripts\beck-heartbeat.ps1') -RepoRoot $RepoRoot -ProofRoot $proofRoot
$heartbeatExit = $LASTEXITCODE
Write-Output 'PHASE=RUN_EXISTING_ECONOMIC_STARTUP'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot 'scripts\beck-startup.ps1') -RepoRoot $RepoRoot -ProofRoot $proofRoot
$startupExit = $LASTEXITCODE
Write-Output "LOCAL_HEARTBEAT_EXIT=$heartbeatExit"
Write-Output "ECONOMIC_STARTUP_EXIT=$startupExit"
Write-Output "LOCAL_HEARTBEAT_PROOF=$(Join-Path $proofRoot 'heartbeat\LOCAL-HEARTBEAT-LATEST.json')"
Write-Output "STARTUP_PROOF=$(Join-Path $proofRoot 'BECK-STARTUP-LATEST.json')"
Write-Output 'CLOUD_HEARTBEAT=GITHUB_ACTIONS_SCHEDULED_EVERY_15_MINUTES_AFTER_WORKFLOW_IS_ON_DEFAULT_BRANCH'
Write-Output 'SAFETY=No production writes, purchases, deployments, public posts, or webhook changes.'
if ($startupExit -eq 1 -or $heartbeatExit -eq 1) { exit 1 }
if ($startupExit -ne 0 -or $heartbeatExit -ne 0) { exit 2 }
exit 0
