#requires -Version 5.1
[CmdletBinding()]
param([switch]$Once,[switch]$Install,[int]$IntervalSeconds=300)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$Run777 = Join-Path $Root "BEC-PRIME\scripts\Run-777.js"
$LmSwarm = Join-Path $Root "runtime\lm_studio\LM-Studio-Swarm.ps1"
$ProofDir = Join-Path $Root "runtime\777\supervisor-runs"
$Manifest = Join-Path $Root "runtime\777\RUNTIME-CANON.json"
New-Item -ItemType Directory -Force -Path $ProofDir | Out-Null

function Install-RuntimeTask {
  $taskName="BEC-Canonical-Runtime"
  $action=New-ScheduledTaskAction -Execute "powershell.exe" -ArgumentList "-NoProfile","-ExecutionPolicy","Bypass","-File",$PSCommandPath
  $trigger=New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
  $settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -RestartCount 10 -RestartInterval (New-TimeSpan -Minutes 1)
  $principal=New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
  $proof=[ordered]@{schema="DREAMLEDGER/RUNTIME-INSTALL/v1";status="INSTALLED";task=$taskName;script=$PSCommandPath;trigger="AT_LOGON";restart_policy="10_RESTARTS_1_MINUTE";installed_at_utc=(Get-Date).ToUniversalTime().ToString("o")}
  $proof | ConvertTo-Json -Depth 10 | Set-Content (Join-Path $ProofDir "runtime-install.json") -Encoding utf8
}

if($Install){ Install-RuntimeTask; if($Once){exit 0} }

function Invoke-Heartbeat {
  $started=(Get-Date).ToUniversalTime()
  $run777Status="NOT_RUN"
  $lmStatus="NOT_STARTED"

  if (Test-Path -LiteralPath $Run777) {
    try {
      & node $Run777 2>&1 | Out-File (Join-Path $ProofDir ("run777-"+$started.ToString("yyyyMMddTHHmmssZ")+".log")) -Encoding utf8
      $run777Status = if($LASTEXITCODE -eq 0){"PASS"}else{"FAIL:$LASTEXITCODE"}
    } catch { $run777Status="ERROR:$($_.Exception.Message)" }
  }

  if (Test-Path -LiteralPath $LmSwarm) {
    try {
      $existing = @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
        Where-Object { [string]$_.CommandLine -match "LM-Studio-Swarm\.ps1" })
      if($existing.Count -eq 0) {
        Start-Process powershell.exe -ArgumentList "-NoProfile","-ExecutionPolicy","Bypass","-File",$LmSwarm -WindowStyle Hidden | Out-Null
        $lmStatus="STARTED"
      } else { $lmStatus="ALREADY_RUNNING" }
    } catch { $lmStatus="ERROR:$($_.Exception.Message)" }
  }

  $proof=[ordered]@{
    schema="DREAMLEDGER/BEC-RUNTIME-HEARTBEAT/v2"
    runtime_manifest=(Test-Path -LiteralPath $Manifest)
    started_at_utc=$started.ToString("o")
    completed_at_utc=(Get-Date).ToUniversalTime().ToString("o")
    run_777=$run777Status
    lm_studio=$lmStatus
    autonomous_internal_work=$true
    external_action_authorized_by_runtime=$false
    verified_external_revenue_nzd=0
    rule="internal heartbeat is not economic proof"
  }
  $proof | ConvertTo-Json -Depth 10 | Set-Content (Join-Path $ProofDir ("heartbeat-"+$started.ToString("yyyyMMddTHHmmssZ")+".json")) -Encoding utf8
}

do {
  Invoke-Heartbeat
  if($Once){break}
  Start-Sleep -Seconds $IntervalSeconds
} while($true)
