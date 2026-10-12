#Requires -Version 5.1
[CmdletBinding()]
param([string]$RepoRoot = "")
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$Branch = 'fix/beck-canonical-offer-and-supabase-failure'
$Workflow = 'figure-eight-cockpit.yml'
$RepoUrl = 'https://github.com/KelpCoin/DreamLedger.git'
if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $base = if (Test-Path 'D:\') { 'D:\BrownEyeCortex\Runtime' } else { Join-Path $HOME 'BrownEyeCortex\Runtime' }
  $RepoRoot = Join-Path $base 'DreamLedger-heartbeat'
}
$parent = Split-Path -Parent $RepoRoot
$null = New-Item -ItemType Directory -Force -Path $parent
$git = Get-Command git.exe -ErrorAction SilentlyContinue
if (-not $git) {
  $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
  if (-not $winget) { throw 'BLOCKED: Git for Windows is missing and winget is unavailable. Install Git once, reopen PowerShell, then rerun this same bootstrap.' }
  Write-Output 'PHASE=INSTALL_GIT'
  & winget.exe install --id Git.Git -e --silent --accept-package-agreements --accept-source-agreements
  if ($LASTEXITCODE -ne 0) { throw "Git installation failed with exit code $LASTEXITCODE" }
  $env:PATH = [Environment]::GetEnvironmentVariable('PATH','Machine') + ';' + [Environment]::GetEnvironmentVariable('PATH','User')
  $git = Get-Command git.exe -ErrorAction SilentlyContinue
  if (-not $git) { throw 'Git installed but git.exe is not on PATH. Close PowerShell, reopen it, and rerun this same bootstrap.' }
}
if (-not (Test-Path (Join-Path $RepoRoot '.git'))) {
  if (Test-Path $RepoRoot) {
    $existing = @(Get-ChildItem -LiteralPath $RepoRoot -Force -ErrorAction SilentlyContinue)
    if ($existing.Count -gt 0) { throw "Refusing to overwrite non-empty folder: $RepoRoot" }
    Remove-Item -LiteralPath $RepoRoot -Force
  }
  & git.exe clone --depth 1 --branch $Branch $RepoUrl $RepoRoot
  if ($LASTEXITCODE -ne 0) { throw "Git clone failed with exit code $LASTEXITCODE" }
} else {
  $dirty = (& git.exe -C $RepoRoot status --porcelain 2>&1 | Out-String).Trim()
  if ($LASTEXITCODE -ne 0) { throw 'Could not inspect existing repository state; refusing to change it.' }
  if (-not [string]::IsNullOrWhiteSpace($dirty)) { throw "Refusing to reset a dirty repository at $RepoRoot. Use the dedicated default bootstrap folder or commit/stash changes first." }
  & git.exe -C $RepoRoot fetch --depth 1 origin $Branch
  if ($LASTEXITCODE -ne 0) { throw "Git fetch failed with exit code $LASTEXITCODE" }
  & git.exe -C $RepoRoot checkout -B $Branch FETCH_HEAD
  if ($LASTEXITCODE -ne 0) { throw "Git checkout failed with exit code $LASTEXITCODE" }
}
$RepoRoot = (Resolve-Path $RepoRoot).Path
if (-not (Get-Command node.exe -ErrorAction SilentlyContinue) -or -not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
  $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
  if (-not $winget) { throw 'BLOCKED: Node.js 20+ is missing and winget is unavailable. Install Node.js LTS once, reopen PowerShell, then rerun this same bootstrap.' }
  Write-Output 'PHASE=INSTALL_NODE_LTS'
  & winget.exe install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements
  if ($LASTEXITCODE -ne 0) { throw "Node.js LTS installation failed with exit code $LASTEXITCODE" }
  $env:PATH = [Environment]::GetEnvironmentVariable('PATH','Machine') + ';' + [Environment]::GetEnvironmentVariable('PATH','User')
  if (-not (Get-Command node.exe -ErrorAction SilentlyContinue) -or -not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw 'Node.js installed but is not on PATH. Close PowerShell, reopen it, and rerun this same bootstrap.' }
}
$proofRoot = if (Test-Path 'D:\') { 'D:\BrownEyeCortex\Runtime\proofs' } else { Join-Path $HOME 'BrownEyeCortex\Runtime\proofs' }
$null = New-Item -ItemType Directory -Force -Path $proofRoot
Write-Output "REPO_ROOT=$RepoRoot"
Write-Output "PROOF_ROOT=$proofRoot"
Write-Output 'PHASE=INSTALL_NODE_DEPENDENCIES'
if (-not (Get-Command node.exe -ErrorAction SilentlyContinue) -or -not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
  throw 'BLOCKED: Node.js 20+ and npm must be installed and available on PATH. Install Node.js LTS, reopen PowerShell, then rerun this same bootstrap.'
}
$nodeVersion = (& node.exe --version 2>&1 | Out-String).Trim()
if ($nodeVersion -notmatch '^v(\d+)\.' -or [int]$Matches[1] -lt 20) { throw "BLOCKED: Node.js 20+ required; found $nodeVersion" }
Push-Location $RepoRoot
try {
  & npm.cmd install --no-package-lock --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw "npm dependency installation failed with exit code $LASTEXITCODE" }
} finally { Pop-Location }
Write-Output 'PHASE=INSTALL_LOCAL_HEARTBEAT'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot 'scripts\install-beck-heartbeat.ps1') -RepoRoot $RepoRoot
if ($LASTEXITCODE -ne 0) { throw "Local heartbeat installation failed: $LASTEXITCODE" }
Write-Output 'PHASE=RUN_LOCAL_HEARTBEAT_NOW'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot 'scripts\beck-heartbeat.ps1') -RepoRoot $RepoRoot -ProofRoot $proofRoot
$heartbeatExit = $LASTEXITCODE
Write-Output 'PHASE=RUN_EXISTING_ECONOMIC_STARTUP'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot 'scripts\beck-startup.ps1') -RepoRoot $RepoRoot -ProofRoot $proofRoot
$startupExit = $LASTEXITCODE
Write-Output 'PHASE=REFRESH_LOCAL_HEARTBEAT_AFTER_INFERENCE'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot 'scripts\beck-heartbeat.ps1') -RepoRoot $RepoRoot -ProofRoot $proofRoot
$heartbeatAfterStartupExit = $LASTEXITCODE
if ($heartbeatAfterStartupExit -ne 0) { $heartbeatExit = $heartbeatAfterStartupExit }
Write-Output 'PHASE=BUILD_PRIVATE_COCKPIT'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot 'scripts\beck-cockpit-bootstrap.ps1') -RepoRoot $RepoRoot -ProofRoot $proofRoot -SkipEconomicBootstrap
$cockpitExit = $LASTEXITCODE
Write-Output 'PHASE=DISPATCH_CLOUD_COCKPIT_IF_AUTHORIZED'
$cloudDispatchStatus = 'BLOCKED_GH_CLI_NOT_AVAILABLE'
$gh = Get-Command gh.exe -ErrorAction SilentlyContinue
if (-not $gh) {
  $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
  if ($winget) {
    Write-Output 'PHASE=INSTALL_GITHUB_CLI'
    & winget.exe install --id GitHub.cli -e --silent --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -eq 0) {
      $env:PATH = [Environment]::GetEnvironmentVariable('PATH','Machine') + ';' + [Environment]::GetEnvironmentVariable('PATH','User')
      $gh = Get-Command gh.exe -ErrorAction SilentlyContinue
    }
  }
}
if ($gh) {
  & gh.exe auth status 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Output 'PHASE=GITHUB_AUTHENTICATION_REQUIRED'
    & gh.exe auth login --hostname github.com --git-protocol https --web
  }
  & gh.exe auth status 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) {
    $dispatchStarted = (Get-Date).ToUniversalTime()
    & gh.exe workflow run $Workflow --repo KelpCoin/DreamLedger --ref $Branch
    if ($LASTEXITCODE -eq 0) {
      $cloudDispatchStatus = 'DISPATCHED_WAITING_FOR_CLOUD_RUN'
      $deadline = (Get-Date).AddMinutes(8)
      $runId = $null
      do {
        Start-Sleep -Seconds 10
        $runsJson = & gh.exe run list --repo KelpCoin/DreamLedger --workflow $Workflow --branch $Branch --limit 5 --json databaseId,status,conclusion,createdAt,event
        if ($LASTEXITCODE -eq 0) {
          try {
            $runs = @($runsJson | ConvertFrom-Json)
            $run = $runs | Where-Object { $_.event -eq 'workflow_dispatch' -and ([DateTime]::Parse($_.createdAt).ToUniversalTime() -ge $dispatchStarted.AddSeconds(-5)) } | Sort-Object createdAt -Descending | Select-Object -First 1
            if ($run) {
              $runId = [string]$run.databaseId
              if ($run.status -eq 'completed') {
                $cloudDispatchStatus = 'COMPLETED_' + [string]$run.conclusion
                break
              }
            }
          } catch {}
        }
      } while ((Get-Date) -lt $deadline)
      if ($cloudDispatchStatus -eq 'DISPATCHED_WAITING_FOR_CLOUD_RUN') { $cloudDispatchStatus = 'TIMED_OUT_CHECK_GITHUB_ACTIONS' }
      if ($runId) {
        $cloudDir = Join-Path $proofRoot 'cloud'
        $null = New-Item -ItemType Directory -Force -Path $cloudDir
        & gh.exe run download $runId --repo KelpCoin/DreamLedger --dir $cloudDir
        if ($LASTEXITCODE -eq 0) { $cloudDispatchStatus += '_ARTIFACT_DOWNLOADED' }
      }
    } else { $cloudDispatchStatus = 'BLOCKED_WORKFLOW_DISPATCH_FAILED' }
  } else { $cloudDispatchStatus = 'BLOCKED_GH_NOT_AUTHENTICATED' }
}
$cloudProof = [ordered]@{
  schema = 'DREAMLEDGER-ONE-SHOT-CLOUD-RESULT/v1'
  generated_at_utc = [DateTime]::UtcNow.ToString('o')
  workflow = $Workflow
  branch = $Branch
  status = $cloudDispatchStatus
  note = 'Manual dispatch is attempted only when GitHub CLI is installed and authenticated. Scheduled execution still requires the workflow to be on the repository default branch.'
}
$cloudProofPath = Join-Path $proofRoot 'CLOUD-COCKPIT-DISPATCH-LATEST.json'
$cloudProof | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $cloudProofPath -Encoding UTF8
if ($cloudDispatchStatus -match '^COMPLETED_success_ARTIFACT_DOWNLOADED$') {
  $remoteReportFile = Get-ChildItem -LiteralPath (Join-Path $proofRoot 'cloud') -Filter 'figure-eight-cockpit-latest.json' -File -Recurse -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  $localHeartbeatPath = Join-Path $proofRoot 'heartbeat\LOCAL-HEARTBEAT-LATEST.json'
  $cockpitDir = Join-Path $proofRoot 'cockpit'
  $mergedPath = Join-Path $cockpitDir 'figure-eight-cockpit-latest.json'
  if ($remoteReportFile -and (Test-Path -LiteralPath $localHeartbeatPath)) {
    try {
      $remoteReport = Get-Content -LiteralPath $remoteReportFile.FullName -Raw | ConvertFrom-Json
      $localReport = Get-Content -LiteralPath $localHeartbeatPath -Raw | ConvertFrom-Json
      $localChecks = @($localReport.checks | Where-Object { $_.name -like 'local.*' })
      $remoteReport.local = [ordered]@{
        score = [int]$localReport.score_out_of_10000
        max = 10000
        status = [string]$localReport.local_score_status
        detail = "Local heartbeat evidence: $(@($localChecks | Where-Object {$_.status -eq 'PASS'}).Count)/$($localChecks.Count) checks passed; proof timestamp $($localReport.generated_at_utc)"
      }
      if ($remoteReport.cloud) {
        $remoteReport.cloud | Add-Member -NotePropertyName workflow_dispatch_status -NotePropertyValue $cloudDispatchStatus -Force
      }
      $remoteReport | ConvertTo-Json -Depth 16 | Set-Content -LiteralPath $mergedPath -Encoding UTF8
      $renderer = Join-Path $RepoRoot 'ops\cockpit\render-cockpit-html.mjs'
      & node.exe $renderer $mergedPath (Join-Path $cockpitDir 'index.html')
      if ($LASTEXITCODE -ne 0) { throw 'Could not render the merged cloud/local cockpit.' }
      Write-Output 'UNIFIED_COCKPIT=MERGED_CLOUD_ARTIFACT_PLUS_LOCAL_HEARTBEAT'
    } catch {
      $cloudDispatchStatus = 'COMPLETED_BUT_COCKPIT_MERGE_FAILED'
      Write-Output ("UNIFIED_COCKPIT_ERROR=" + $_.Exception.Message)
    }
  } else {
    $cloudDispatchStatus = 'COMPLETED_BUT_REQUIRED_ARTIFACT_MISSING'
  }
}
Write-Output "LOCAL_HEARTBEAT_EXIT=$heartbeatExit"
Write-Output "LOCAL_HEARTBEAT_AFTER_STARTUP_EXIT=$heartbeatAfterStartupExit"
Write-Output "ECONOMIC_STARTUP_EXIT=$startupExit"
Write-Output "COCKPIT_EXIT=$cockpitExit"
Write-Output "COCKPIT_HTML=$(Join-Path $proofRoot 'cockpit\index.html')"
Write-Output "CLOUD_COCKPIT_STATUS=$cloudDispatchStatus"
Write-Output "CLOUD_COCKPIT_PROOF=$cloudProofPath"
Write-Output "LOCAL_HEARTBEAT_PROOF=$(Join-Path $proofRoot 'heartbeat\LOCAL-HEARTBEAT-LATEST.json')"
Write-Output "STARTUP_PROOF=$(Join-Path $proofRoot 'BECK-STARTUP-LATEST.json')"
Write-Output 'CLOUD_SCHEDULE=30_MINUTES_ONLY_AFTER_THIS_WORKFLOW_IS_ENABLED_ON_DEFAULT_BRANCH; CURRENT_DEFAULT_BRANCH_SCHEDULE_NOT_CHANGED'
Write-Output 'SAFETY=No production writes, purchases, deployments, public posts, or webhook changes.'
if ($startupExit -eq 1 -or $heartbeatExit -eq 1 -or $cockpitExit -eq 1) { exit 1 }
if ($startupExit -ne 0 -or $heartbeatExit -ne 0 -or $cockpitExit -ne 0 -or $cloudDispatchStatus -notmatch '^COMPLETED_success_ARTIFACT_DOWNLOADED$') { exit 2 }
exit 0
