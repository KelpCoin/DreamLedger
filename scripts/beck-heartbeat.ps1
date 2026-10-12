#Requires -Version 5.1
[CmdletBinding()]
param(
  [string]$RepoRoot = "",
  [string]$ProofRoot = ""
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($RepoRoot)) { $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path }
$RepoRoot = (Resolve-Path $RepoRoot).Path
if ([string]::IsNullOrWhiteSpace($ProofRoot)) { $ProofRoot = if (Test-Path 'D:\') { 'D:\BrownEyeCortex\Runtime\proofs' } else { Join-Path $HOME 'BrownEyeCortex\Runtime\proofs' } }
$root = Join-Path $ProofRoot 'heartbeat'
$null = New-Item -ItemType Directory -Force -Path $root
$proof = Join-Path $root 'LOCAL-HEARTBEAT-LATEST.json'
$log = Join-Path $root 'LOCAL-HEARTBEAT-LATEST.log'
$checks = [System.Collections.Generic.List[object]]::new()
function Add-Check([string]$Name,[string]$Status,[string]$Detail) { $checks.Add([ordered]@{name=$Name;status=$Status;detail=$Detail}) }
$started = [DateTime]::UtcNow
try {
  "[$([DateTime]::UtcNow.ToString('o'))] local heartbeat started" | Add-Content -LiteralPath $log -Encoding UTF8
  $node = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($node) {
    $v = (& node.exe --version 2>&1 | Out-String).Trim()
    $ok = $v -match '^v(\d+)\.' -and [int]$Matches[1] -ge 20
    Add-Check 'local.node' $(if($ok){'PASS'}else{'BLOCKED'}) $v
  } else { Add-Check 'local.node' 'BLOCKED' 'Node.js 20+ is not on PATH.' }
  $lmsBase = if ($env:BECK_LMSTUDIO_BASE) { $env:BECK_LMSTUDIO_BASE.TrimEnd('/') } else { 'http://127.0.0.1:1234/v1' }
  $modelList = @()
  $modelIds = @()
  try {
    $models = Invoke-RestMethod -Uri ($lmsBase + '/models') -TimeoutSec 4
    $modelList = @($models.data)
    $modelIds = @($modelList | ForEach-Object { [string]$_.id })
    $expectedModelAliases = @('scout','critic','vision')
    $modelAliasesPresent = @($expectedModelAliases | Where-Object { $_ -in $modelIds }).Count
    Add-Check 'local.lm_studio_api' $(if($modelAliasesPresent -eq 3){'PASS'}else{'BLOCKED'}) ("Model endpoint reachable; required role aliases present="+$modelAliasesPresent+"/3; listed models="+$modelList.Count)
  } catch { Add-Check 'local.lm_studio_api' 'BLOCKED' 'LM Studio API unavailable; cloud heartbeat is independent.' }
  $roleProofPath = Join-Path $ProofRoot 'LMSTUDIO-THREE-ROLE-READINESS.json'
  $roleProof = $null
  $roleReady = $false
  $roleDetail = 'Three-role proof absent.'
  if (Test-Path -LiteralPath $roleProofPath) {
    try {
      $roleProof = Get-Content -LiteralPath $roleProofPath -Raw | ConvertFrom-Json
      $heartbeatUtc = [DateTime]::Parse([string]$roleProof.heartbeat_at_utc).ToUniversalTime()
      $age = ([DateTime]::UtcNow - $heartbeatUtc).TotalMinutes
      $roleNames = @($roleProof.roles | ForEach-Object { [string]$_.role })
      $modelKeys = @($roleProof.roles | ForEach-Object { [string]$_.model_key })
      $allAliases = @($roleProof.roles | ForEach-Object { [string]$_.api_identifier })
      $roleReady = $roleProof.status -eq 'PASS' -and $roleProof.readiness -eq 'THREE_DISTINCT_ROLES_INFERENCE_AND_LOADED_STATE_VERIFIED' -and $age -ge 0 -and $age -le 20 -and (@($roleNames | Select-Object -Unique).Count -eq 3) -and (@($modelKeys | Select-Object -Unique).Count -eq 3) -and (@($allAliases | Where-Object { $_ -in $modelIds }).Count -eq 3) -and $roleProof.gpu.total_memory_mb -gt 0 -and $roleProof.gpu.status -eq 'PASS_GPU_MEMORY_AND_INFERENCE_ACTIVITY_OBSERVED'
      $roleDetail = "status=$($roleProof.status); age_minutes=$([math]::Round($age,1)); roles=$(@($roleNames | Select-Object -Unique).Count)/3; distinct_models=$(@($modelKeys | Select-Object -Unique).Count)/3; proof=$roleProofPath"
    } catch { $roleDetail = "Cannot validate current three-role proof: $($_.Exception.Message)" }
  }
  Add-Check 'local.three_role_readiness' $(if($roleReady){'PASS'}else{'BLOCKED'}) $roleDetail
  $gpu = Get-Command nvidia-smi.exe -ErrorAction SilentlyContinue
  if (-not $gpu) { $gpu = Get-Command nvidia-smi -ErrorAction SilentlyContinue }
  if ($gpu) {
    $g = & $gpu.Source --query-gpu=name,memory.total,memory.used,memory.free,utilization.gpu --format=csv,noheader 2>&1
    Add-Check 'local.gpu_telemetry' $(if($LASTEXITCODE -eq 0){'PASS'}else{'BLOCKED'}) (($g -join '; ').Trim())
  } else { Add-Check 'local.gpu_telemetry' 'BLOCKED' 'nvidia-smi unavailable; no GPU claim made.' }
  $git = Get-Command git.exe -ErrorAction SilentlyContinue
  if ($git -and (Test-Path (Join-Path $RepoRoot '.git'))) {
    $head = (& git.exe -C $RepoRoot rev-parse HEAD 2>&1 | Out-String).Trim()
    Add-Check 'local.repository' $(if($LASTEXITCODE -eq 0){'PASS'}else{'BLOCKED'}) $head
  } else { Add-Check 'local.repository' 'BLOCKED' 'Git repository metadata unavailable.' }
  $dailyRoot = Join-Path (Split-Path -Parent $ProofRoot) 'daily'
  $dailyProof = $null
  $dailyFile = Get-ChildItem -LiteralPath $dailyRoot -Filter 'bootstrap-proof.json' -File -Recurse -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($dailyFile) { try { $dailyProof = Get-Content -LiteralPath $dailyFile.FullName -Raw | ConvertFrom-Json } catch {} }
  $inferenceStatus = if ($dailyProof) { [string]$dailyProof.checks.inference.status } else { 'UNVERIFIED' }
  Add-Check 'local.inference' $(if($inferenceStatus -eq 'PASS'){'PASS'}elseif($inferenceStatus -eq 'FAIL'){'FAIL'}else{'BLOCKED'}) ("Latest local inference proof=" + $inferenceStatus)
  $task = Get-ScheduledTask -TaskName 'DreamLedger-Local-Heartbeat' -ErrorAction SilentlyContinue
  Add-Check 'local.scheduled_task' $(if($task){'PASS'}else{'BLOCKED'}) 'Local heartbeat scheduled task registration'
  Add-Check 'local.proof_persisted' 'PASS' 'This run writes an atomic JSON heartbeat proof.'
  Add-Check 'local.safe_defaults' 'PASS' 'Read-only diagnostics; no money movement, deployment, webhook mutation, or public messages.'
  $backupProofPath = Join-Path $ProofRoot 'backup-restore-verification.json'
  $backupOk = $false
  if (Test-Path -LiteralPath $backupProofPath) {
    try { $backupProof = Get-Content -LiteralPath $backupProofPath -Raw | ConvertFrom-Json; $backupOk = $backupProof.restore_test_status -eq 'PASS' -and $backupProof.generated_at_utc -and (([DateTime]::UtcNow - [DateTime]::Parse($backupProof.generated_at_utc)).TotalDays -le 30) } catch {}
  }
  Add-Check 'local.backup_restore' $(if($backupOk){'PASS'}else{'BLOCKED'}) 'Encrypted backup restore earns points only from a dated independent restore-test proof.'
  $weights = @{
    'local.node' = 500
    'local.lm_studio_api' = 500
    'local.three_role_readiness' = 1000
    'local.inference' = 2500
    'local.gpu_telemetry' = 1000
    'local.repository' = 1000
    'local.scheduled_task' = 1000
    'local.proof_persisted' = 1000
    'local.safe_defaults' = 500
    'local.backup_restore' = 1000
  }
  $localScore = 0
  $scoreRows = @(
    foreach ($c in $checks) {
      if ($weights.ContainsKey($c.name)) {
        $points = [int]$weights[$c.name]
        $earned = if ($c.status -eq 'PASS') { $points } else { 0 }
        $localScore += $earned
        [ordered]@{name=$c.name;points=$points;earned=$earned;status=$c.status;detail=$c.detail}
      }
    }
  )
  $old = @($checks | Where-Object {$_.status -eq 'BLOCKED'}).Count
  $status = if (@($checks | Where-Object {$_.status -eq 'FAIL'}).Count -gt 0) {'FAIL'} elseif ($old -eq 0) {'PASS'} else {'DEGRADED'}
  $result = [ordered]@{
    schema='DREAMLEDGER-LOCAL-HEARTBEAT/v1'
    generated_at_utc=[DateTime]::UtcNow.ToString('o')
    host=$env:COMPUTERNAME
    status=$status
    score_out_of_10000=$localScore
    local_score_status=$(if($localScore -eq 10000){'VERIFIED_10000'}else{'IMPROVEMENT_REQUIRED'})
    score_breakdown=$scoreRows
    checks=@($checks)
    cloud_independence='Cloud monitoring is scheduled by GitHub Actions and does not require this computer to be online.'
    safety='Read-only diagnostics only. No Stripe secret collection, production writes, deployments, purchases, or public messages.'
  }
  $tmp="$proof.tmp"
  $result | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $tmp -Encoding UTF8
  Move-Item -LiteralPath $tmp -Destination $proof -Force
  "[$([DateTime]::UtcNow.ToString('o'))] status=$status score=$($result.score_out_of_10000)/10000 proof=$proof" | Add-Content -LiteralPath $log -Encoding UTF8
  Write-Output "LOCAL_HEARTBEAT=$status"
  Write-Output "LOCAL_SCORE=$($result.score_out_of_10000)/10000"
  Write-Output "LOCAL_PROOF=$proof"
  if ($status -eq 'PASS') { exit 0 } else { exit 2 }
} catch {
  "[$([DateTime]::UtcNow.ToString('o'))] error=$($_.Exception.Message)" | Add-Content -LiteralPath $log -Encoding UTF8
  throw
}
