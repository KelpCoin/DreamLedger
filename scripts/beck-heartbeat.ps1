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
  try {
    $models = Invoke-RestMethod -Uri ($lmsBase + '/models') -TimeoutSec 4
    $modelList = @($models.data)
    Add-Check 'local.lm_studio_api' $(if($modelList.Count -gt 0){'PASS'}else{'BLOCKED'}) ("Model endpoint reachable; listed models="+$modelList.Count)
  } catch { Add-Check 'local.lm_studio_api' 'BLOCKED' 'LM Studio API unavailable; cloud heartbeat is independent.' }
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
  $old = @($checks | Where-Object {$_.status -eq 'BLOCKED'}).Count
  $status = if ($old -eq 0) {'PASS'} else {'DEGRADED'}
  $result = [ordered]@{
    schema='DREAMLEDGER-LOCAL-HEARTBEAT/v1'
    generated_at_utc=[DateTime]::UtcNow.ToString('o')
    host=$env:COMPUTERNAME
    status=$status
    score_out_of_10000=[int]([math]::Round(10000 * @($checks | Where-Object {$_.status -eq 'PASS'}).Count / [math]::Max(1,$checks.Count)))
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
