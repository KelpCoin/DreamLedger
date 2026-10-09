[CmdletBinding()]
param(
  [switch]$InstallTask,
  [switch]$Once,
  [int]$IntervalSeconds = 600,
  [string]$RepoPath = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$ErrorActionPreference = "Stop"
$RepoPath = (Resolve-Path $RepoPath).Path
$StateRoot = Join-Path $env:LOCALAPPDATA "DreamLedger\BECK"
$LogPath = Join-Path $StateRoot "worker.log"
$StatusPath = Join-Path $StateRoot "latest-status.json"
New-Item -ItemType Directory -Path $StateRoot -Force | Out-Null

function Write-Log([string]$Message) {
  $line = "$(Get-Date -Format o) $Message"
  Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
  Write-Output $line
}

function Invoke-Checked([string]$Exe, [string[]]$Arguments, [string]$WorkingDirectory) {
  Push-Location $WorkingDirectory
  try {
    $output = & $Exe @Arguments 2>&1
    $code = $LASTEXITCODE
    if ($code -ne 0) {
      throw "$Exe $($Arguments -join ' ') failed ($code): $($output -join ' ')"
    }
    return ($output -join [Environment]::NewLine)
  } finally {
    Pop-Location
  }
}

function Run-BeckCycle {
  $started = (Get-Date).ToUniversalTime().ToString("o")
  $checks = [ordered]@{}
  $overall = "PASS"
  $dirty = $false
  try {
    foreach ($tool in @("git", "node", "npm", "python")) {
      if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "Required local tool missing: $tool"
      }
    }

    $gitStatus = Invoke-Checked "git" @("status", "--porcelain") $RepoPath
    $dirty = -not [string]::IsNullOrWhiteSpace($gitStatus)
    $checks["working_tree"] = if ($dirty) { "DIRTY_NO_AUTO_PULL" } else { "CLEAN" }

    # Never overwrite uncommitted desktop work. Updates remain manual if dirty.
    $branch = Invoke-Checked "git" @("rev-parse", "--abbrev-ref", "HEAD") $RepoPath
    if ($branch -ne "main") {
      $checks["git_sync"] = "SKIPPED_NON_MAIN_BRANCH"
    } elseif (-not $dirty) {
      try {
        $null = Invoke-Checked "git" @("fetch", "origin", "main", "--quiet") $RepoPath
        $aheadBehind = Invoke-Checked "git" @("rev-list", "--left-right", "--count", "HEAD...origin/main") $RepoPath
        $counts = $aheadBehind.Trim() -split "\s+"
        if ($counts.Count -eq 2 -and [int]$counts[0] -eq 0 -and [int]$counts[1] -gt 0) {
          $null = Invoke-Checked "git" @("pull", "--ff-only", "origin", "main") $RepoPath
          $checks["git_sync"] = "FAST_FORWARD_UPDATED"
        } elseif ($counts.Count -eq 2 -and [int]$counts[0] -eq 0) {
          $checks["git_sync"] = "CURRENT"
        } else {
          $checks["git_sync"] = "DIVERGED_OR_LOCAL_COMMITS_NO_AUTO_MERGE"
        }
      } catch {
        $checks["git_sync"] = "UNAVAILABLE: $($_.Exception.Message)"
      }
    }

    $checks["public_site_contract"] = Invoke-Checked "python" @("scripts/test_public_site_contract.py") $RepoPath
    $checks["storefront_syntax"] = Invoke-Checked "node" @("--check", "server.js") (Join-Path $RepoPath "public")
    $checks["beck_unit_tests"] = Invoke-Checked "npm" @("test") (Join-Path $RepoPath "BEC-PRIME")
    $checks["bridge_inbox_dry_run"] = Invoke-Checked "python" @("scripts/bridge_process_inbox.py", "--dry-run") $RepoPath
    $checks["economic_loop_registry"] = Invoke-Checked "python" @("scripts/loop_status.py") $RepoPath

    # Local model is an optional accelerator, never a dependency for cloud operation.
    try {
      $models = Invoke-RestMethod -Uri "http://127.0.0.1:1234/v1/models" -TimeoutSec 3
      $checks["lm_studio"] = "AVAILABLE model_count=$(@($models.data).Count)"
    } catch {
      $checks["lm_studio"] = "OFFLINE_OPTIONAL"
    }
  } catch {
    $overall = "FAIL"
    $checks["fatal"] = $_.Exception.Message
    Write-Log "CYCLE_FAIL $($_.Exception.Message)"
  }

  $report = [ordered]@{
    schema = "dreamledger/beck-desktop-worker-status/v1"
    observed_at = (Get-Date).ToUniversalTime().ToString("o")
    started_at = $started
    status = $overall
    truth_status = "UNVERIFIED"
    verified_external_revenue_nzd = 0.00
    local_model_is_optional = $true
    external_actions_performed = $false
    payment_or_credential_mutations_performed = $false
    checks = $checks
  }
  $report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $StatusPath -Encoding UTF8
  Write-Log "CYCLE_$overall status=$StatusPath"
  return $overall
}

if ($InstallTask) {
  $taskName = "DreamLedger-BECK-Desktop-Worker"
  $script = $PSCommandPath
  $taskArgs = '-NoProfile -ExecutionPolicy Bypass -File "' + $script + '" -RepoPath "' + $RepoPath + '"'
  $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $taskArgs
  $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Days 3650)
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "Runs safe DreamLedger BECK checks; no payments or external publishing." -Force | Out-Null
  Write-Log "TASK_INSTALLED name=$taskName trigger=AtLogOn"
  Start-ScheduledTask -TaskName $taskName
  if (-not $Once) { exit 0 }
}

do {
  $null = Run-BeckCycle
  if ($Once) { break }
  Start-Sleep -Seconds ([Math]::Max(60, $IntervalSeconds))
} while ($true)
