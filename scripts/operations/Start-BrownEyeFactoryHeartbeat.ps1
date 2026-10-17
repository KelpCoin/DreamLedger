[CmdletBinding()]
param([int]$IntervalSeconds = 60, [switch]$Once, [switch]$RunMembraneProbe)
# Safe local heartbeat. No deploys, Stripe writes, public publishing, or guessed endpoint.
$ErrorActionPreference = 'Stop'
$api = if ($env:LMSTUDIO_BASE_URL) { $env:LMSTUDIO_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:1234' }
$root = if (Test-Path 'D:\') { 'D:\BrownEyeCortex\proofs\factory-heartbeat' } else { Join-Path $env:USERPROFILE 'BrownEyeCortex\proofs\factory-heartbeat' }
New-Item -ItemType Directory -Force -Path $root | Out-Null
$latest = Join-Path $root 'heartbeat-latest.json'
$log = Join-Path $root 'heartbeat.jsonl'
$lms = Get-Command lms -ErrorAction SilentlyContinue
if (-not $lms) { $candidate = Join-Path $env:USERPROFILE '.lmstudio\bin\lms.exe'; if (Test-Path $candidate) { $lmsPath = $candidate } else { $lmsPath = $null } } else { $lmsPath = $lms.Source }
function Get-GpuSnapshot {
  $cmd = Get-Command nvidia-smi -ErrorAction SilentlyContinue
  if (-not $cmd) { return @{ available=$false; detail='nvidia-smi not found' } }
  $v = (& $cmd.Source --query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader 2>&1 | Out-String).Trim()
  return @{ available=($LASTEXITCODE -eq 0); detail=$v }
}
function Get-ModelIds {
  try { $r = Invoke-RestMethod -Uri "$api/v1/models" -TimeoutSec 5; return @($r.data | ForEach-Object { [string]$_.id } | Where-Object { $_ }) }
  catch { return @() }
}
function Test-Model([string]$id) {
  $body = @{ model=$id; messages=@(@{role='user';content='Reply with exactly FACTORY_HEARTBEAT_OK'}); temperature=0; max_tokens=24 } | ConvertTo-Json -Depth 6
  try {
    $r = Invoke-RestMethod -Uri "$api/v1/chat/completions" -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 90
    $answer = [string]$r.choices[0].message.content
    return @{ model=$id; ok=($answer -match 'FACTORY_HEARTBEAT_OK'); response=$answer; error=$null }
  } catch { return @{ model=$id; ok=$false; response=$null; error=$_.Exception.Message } }
}
function Test-Membrane {
  $url = $env:BEC_MEMBRANE_URL
  if (-not $url) { return @{ status='NOT_CONFIGURED'; detail='Set BEC_MEMBRANE_URL to the real authenticated endpoint. No endpoint was guessed.' } }
  $taskId = [guid]::NewGuid().ToString()
  $nonce = [guid]::NewGuid().ToString('N')
  $payload = @{ schema='BEC/FIGURE-EIGHT-PROBE/1'; task_id=$taskId; nonce=$nonce; issued_at=[DateTime]::UtcNow.ToString('o'); source='local-heartbeat'; purpose='connectivity_probe_only' } | ConvertTo-Json -Depth 5
  $headers = @{}
  if ($env:BEC_MEMBRANE_TOKEN) { $headers.Authorization = "Bearer $env:BEC_MEMBRANE_TOKEN" }
  try {
    $reply = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -ContentType 'application/json' -Body $payload -TimeoutSec 20
    $nonceOk = ([string]$reply.nonce -eq $nonce); $taskOk = ([string]$reply.task_id -eq $taskId)
    $receiptOk = -not [string]::IsNullOrWhiteSpace([string]$reply.receipt_id); $processed = ($reply.processed -eq $true)
    $ok = $nonceOk -and $taskOk -and $receiptOk -and $processed
    return @{ status=$(if($ok){'PASS'}else{'FAIL'}); url=$url; task_id=$taskId; nonce_match=$nonceOk; task_match=$taskOk; receipt_present=$receiptOk; processed=$processed; receipt_id=$reply.receipt_id; response=$reply }
  } catch { return @{ status='FAIL'; url=$url; task_id=$taskId; error=$_.Exception.Message } }
}
do {
  $gpuBefore = Get-GpuSnapshot; $ids = @(Get-ModelIds); $modelTests = @()
  foreach ($id in $ids) { $modelTests += Test-Model $id }
  $gpuAfter = Get-GpuSnapshot
  $membrane = if ($RunMembraneProbe) { Test-Membrane } else { @{ status='NOT_RUN'; detail='Use -RunMembraneProbe after configuring the actual endpoint.' } }
  $report = [ordered]@{
    schema='BROWN-EYE/FACTORY-HEARTBEAT/1'; timestamp_utc=[DateTime]::UtcNow.ToString('o')
    machine=$env:COMPUTERNAME; local_api=$api; lms_cli=if($lmsPath){$lmsPath}else{'NOT_FOUND'}
    gpu_before=$gpuBefore; gpu_after=$gpuAfter; loaded_model_count=$ids.Count; minimum_loaded_models=3
    model_inventory=$ids; model_inference_tests=$modelTests
    model_gate_pass=($ids.Count -ge 3 -and @($modelTests | Where-Object { -not $_.ok }).Count -eq 0)
    membrane=$membrane; economic_truth='NOT_CHECKED_BY_LOCAL_HEARTBEAT'; stripe_fulfillment='NOT_CHECKED_BY_LOCAL_HEARTBEAT'
  }
  $json = $report | ConvertTo-Json -Depth 12
  Set-Content -LiteralPath $latest -Value $json -Encoding UTF8
  Add-Content -LiteralPath $log -Value ([regex]::Replace($json, '\s+', ' '))
  Write-Host "HEARTBEAT $($report.timestamp_utc) | loaded=$($ids.Count)/3 | model_gate=$($report.model_gate_pass) | gpu=$($gpuAfter.detail) | membrane=$($membrane.status)"
  Write-Host "Evidence: $latest"
  if ($Once) { break }
  Start-Sleep -Seconds ([Math]::Max(15,$IntervalSeconds))
} while ($true)
