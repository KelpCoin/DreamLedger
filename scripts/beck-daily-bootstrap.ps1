#Requires -Version 5.1
[CmdletBinding()]
param([string]$Root = $env:BEC_DAILY_ROOT, [int]$Port = 1234)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($Root)) { $Root = Join-Path $HOME 'bec-daily' }
$day = Get-Date -Format 'yyyy-MM-dd'
$out = Join-Path $Root $day
$log = Join-Path $out 'bootstrap.log'
$proofPath = Join-Path $out 'bootstrap-proof.json'
$transcriptStarted = $false
$proof = [ordered]@{
  schema = 'BECK-DAILY-BOOTSTRAP-1.1'
  status = 'BLOCKED'
  readiness = 'NOT_COMMISSIONED'
  captured_at_utc = [DateTime]::UtcNow.ToString('o')
  host = $env:COMPUTERNAME
  workspace = $out
  checks = [ordered]@{}
  limitations = @('No Supabase writes','No Stripe API calls','No public/customer actions','HTTP reachability is not database health','Prompt files are not model inference')
}
function Write-Proof {
  $tmp = "$proofPath.tmp"
  $proof | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $tmp -Encoding UTF8
  Move-Item -LiteralPath $tmp -Destination $proofPath -Force
}
function Get-HttpStatus([string]$Url) {
  try {
    $response = Invoke-WebRequest -Uri $Url -MaximumRedirection 5 -TimeoutSec 12 -UseBasicParsing
    return [string][int]$response.StatusCode
  } catch {
    try { if ($_.Exception.Response -and $_.Exception.Response.StatusCode) { return [string][int]$_.Exception.Response.StatusCode } } catch {}
    return '000'
  }
}
try {
  New-Item -ItemType Directory -Force -Path $out,(Join-Path $out 'council'),(Join-Path $out 'money'),(Join-Path $out '777') | Out-Null
  try { Start-Transcript -Path $log -Append | Out-Null; $transcriptStarted = $true } catch { Write-Warning 'Transcript unavailable; structured proof will still be written.' }
  Write-Output "BECK_DAILY_BOOTSTRAP=1"
  Write-Output "DATE=$day"
  Write-Output "WORKSPACE=$out"
  $proof.checks.disk = @(Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" -ErrorAction SilentlyContinue | ForEach-Object { [ordered]@{drive=$_.DeviceID;size_bytes=[int64]$_.Size;free_bytes=[int64]$_.FreeSpace} })
  $os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
  if ($os) { $proof.checks.memory = [ordered]@{total_kb=[int64]$os.TotalVisibleMemorySize;free_kb=[int64]$os.FreePhysicalMemory} }
  if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) {
    $gpu = & nvidia-smi --query-gpu=name,driver_version,memory.total,memory.used,memory.free,utilization.gpu --format=csv,noheader 2>&1
    $proof.checks.gpu = [ordered]@{status=if ($LASTEXITCODE -eq 0) {'OBSERVED'} else {'UNVERIFIED'};output=($gpu -join [Environment]::NewLine)}
  } else { $proof.checks.gpu = [ordered]@{status='UNVERIFIED';reason='nvidia-smi unavailable'} }

  $base = "http://127.0.0.1:$Port/v1"
  if ($env:BECK_LMSTUDIO_BASE) {
    $base = $env:BECK_LMSTUDIO_BASE.TrimEnd('/')
    if ($base -match ':(\d+)/v1$') { $Port = [int]$Matches[1] }
  }
  $modelUrl = "$base/models"
  $modelStatus = Get-HttpStatus $modelUrl
  if ($modelStatus -ne '200') {
    $lms = Get-Command lms.exe -ErrorAction SilentlyContinue
    $lmsPath = if ($lms) { $lms.Source } else { $null }
    if (-not $lmsPath) {
      $candidates = @((Join-Path $env:USERPROFILE '.lmstudio\bin\lms.exe'),(Join-Path $env:LOCALAPPDATA 'Programs\LM Studio\resources\app\.webpack\bin\lms.exe'))
      $lmsPath = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    }
    if ($lmsPath) {
      $null = & $lmsPath server start --port $Port 2>&1
      for ($i=0; $i -lt 20; $i++) { Start-Sleep -Seconds 1; $modelStatus = Get-HttpStatus $modelUrl; if ($modelStatus -eq '200') { break } }
    }
  }
  $modelIds = @()
  if ($modelStatus -eq '200') { try { $api = Invoke-RestMethod -Uri $modelUrl -TimeoutSec 12; $modelIds = @($api.data | ForEach-Object { [string]$_.id } | Where-Object { $_ }) } catch {} }
  $proof.checks.lm_studio = [ordered]@{
    status = if ($modelStatus -eq '200' -and $modelIds.Count -gt 0) {'API_AND_MODEL_LIST_OBSERVED'} elseif ($modelStatus -eq '200') {'API_REACHABLE_NO_MODELS'} else {'BLOCKED'}
    http_status = $modelStatus
    visible_model_ids = $modelIds
    inference = 'NOT_RUN_BY_DAILY_BOOTSTRAP'
    three_role_readiness = 'NOT_VERIFIED'
  }

  $urls = @('https://dreamledger.org/agent-delivery-proof-audit.html','https://dreamledger.org/billboard.html')
  if ($env:BECK_OFFER_URLS) { $urls = @($env:BECK_OFFER_URLS -split '\s+' | Where-Object { $_ }) }
  $proof.checks.public_pages = @($urls | ForEach-Object { [ordered]@{url=$_;http_status=(Get-HttpStatus $_);checkout='NOT_TESTED';payment='NOT_TESTED'} })

  $sb = if ($env:SUPABASE_URL) { $env:SUPABASE_URL.TrimEnd('/') } else { 'https://wbwgroygjeyukkspnqiy.supabase.co' }
  $sbStatus = Get-HttpStatus "$sb/rest/v1/"
  if ($sbStatus -eq '200') { $sbLabel = 'GATEWAY_REACHABLE_ONLY_DB_UNPROVEN' }
  elseif ($sbStatus -in @('401','403')) { $sbLabel = 'GATEWAY_AUTH_REQUIRED_DB_UNPROVEN' }
  elseif ($sbStatus -eq '000' -or $sbStatus -like '5*') { $sbLabel = 'BLOCKED' }
  else { $sbLabel = "HTTP_$($sbStatus)_DB_UNPROVEN" }
  $proof.checks.supabase = [ordered]@{project_ref='wbwgroygjeyukkspnqiy';rest_gateway_http=$sbStatus;status=$sbLabel;authenticated_sql='NOT_TESTED';rpc_health='NOT_PROVEN';writes='NOT_ATTEMPTED'}

  @'
SCOUT: Find the strongest independently sourced demand signal for one approved DreamLedger offer and one inbound/public action that could improve odds of a sale in 48h. Include source URLs and timestamps. Never invent buyers or demand. Return at most five bullets.
'@ | Set-Content -LiteralPath (Join-Path $out 'council\01-scout.txt') -Encoding UTF8
  @'
CRITICAL: Challenge Scout claims. Label VERIFIED / UNVERIFIED / CONTRADICTED / STALE. Check buyer intent, evidence quality, price/scope, checkout readiness, support/contact, delivery capacity, and risk. Never infer DB health from gateway reachability or revenue from internal events.
'@ | Set-Content -LiteralPath (Join-Path $out 'council\02-critic.txt') -Encoding UTF8
  @'
SYNTH: Use Scout evidence and Critical review to produce at most seven actions ordered by commercial value and low effort. One approved offer, one buyer path. Prefer inbound/public distribution. State proof required and blockers. No architecture work unless it directly blocks sale or fulfillment.
'@ | Set-Content -LiteralPath (Join-Path $out 'council\03-synth.txt') -Encoding UTF8
  @'
# One-sale checklist
- [ ] Verify live page, price, scope, payment destination, support/contact, and delivery process.
- [ ] Fix one buyer-visible blocker or improve intake/delivery.
- [ ] Do not promote an offer whose checkout is held or delivery is not ready.
- [ ] Reconcile settled external payment to the exact order, deliver the work, and retain evidence.
- [ ] If any link is missing, mark UNVERIFIED.
- [ ] Page views, checkouts, model output, and CI are not revenue.
'@ | Set-Content -LiteralPath (Join-Path $out 'money\CHECKLIST.md') -Encoding UTF8
  @'
# 777 rules
- Use admissible external signals with source URL and observation time.
- Never fabricate an artifact to make CI green.
- Use the workflow's exact current-run no-op receipt contract when no admissible signal exists.
- Revenue remains NZ$0 until settlement and fulfillment evidence are reconciled.
'@ | Set-Content -LiteralPath (Join-Path $out '777\RULES.md') -Encoding UTF8
  $proof.status = 'PREPARED'
  $proof.readiness = 'DIAGNOSTICS_AND_PROMPTS_ONLY'
  Write-Proof
  Write-Output 'BOOTSTRAP_STATUS=PREPARED_NOT_COMMISSIONED'
  Write-Output "PROOF=$proofPath"
  Write-Output 'LMSTUDIO_INFERENCE=NOT_RUN'
  Write-Output 'SUPABASE_AUTHENTICATED_HEALTH=NOT_PROVEN'
} catch {
  $proof.status = 'FAIL'
  $proof.readiness = 'NOT_READY'
  $proof.error = $_.Exception.Message
  try { Write-Proof } catch { Write-Error 'Could not persist bootstrap proof.' }
  Write-Error $_
  exit 2
} finally {
  if ($transcriptStarted) { try { Stop-Transcript | Out-Null } catch {} }
}) { $Port = [int]$Matches[1] }
  }
  $modelUrl = "$base/models"
  $modelStatus = Get-HttpStatus $modelUrl
  if ($modelStatus -ne '200') {
    $lms = Get-Command lms.exe -ErrorAction SilentlyContinue
    $lmsPath = if ($lms) { $lms.Source } else { $null }
    if (-not $lmsPath) {
      $candidates = @((Join-Path $env:USERPROFILE '.lmstudio\bin\lms.exe'),(Join-Path $env:LOCALAPPDATA 'Programs\LM Studio\resources\app\.webpack\bin\lms.exe'))
      $lmsPath = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    }
    if ($lmsPath) {
      $null = & $lmsPath server start --port $Port 2>&1
      for ($i=0; $i -lt 20; $i++) { Start-Sleep -Seconds 1; $modelStatus = Get-HttpStatus $modelUrl; if ($modelStatus -eq '200') { break } }
    }
  }
  $modelIds = @()
  if ($modelStatus -eq '200') { try { $api = Invoke-RestMethod -Uri $modelUrl -TimeoutSec 12; $modelIds = @($api.data | ForEach-Object { [string]$_.id } | Where-Object { $_ }) } catch {} }
  $proof.checks.lm_studio = [ordered]@{
    status = if ($modelStatus -eq '200' -and $modelIds.Count -gt 0) {'API_AND_MODEL_LIST_OBSERVED'} elseif ($modelStatus -eq '200') {'API_REACHABLE_NO_MODELS'} else {'BLOCKED'}
    http_status = $modelStatus
    visible_model_ids = $modelIds
    inference = 'NOT_RUN_BY_DAILY_BOOTSTRAP'
    three_role_readiness = 'NOT_VERIFIED'
  }

  $urls = @('https://dreamledger.org/agent-delivery-proof-audit.html','https://dreamledger.org/billboard.html')
  if ($env:BECK_OFFER_URLS) { $urls = @($env:BECK_OFFER_URLS -split '\s+' | Where-Object { $_ }) }
  $proof.checks.public_pages = @($urls | ForEach-Object { [ordered]@{url=$_;http_status=(Get-HttpStatus $_);checkout='NOT_TESTED';payment='NOT_TESTED'} })

  $sb = if ($env:SUPABASE_URL) { $env:SUPABASE_URL.TrimEnd('/') } else { 'https://wbwgroygjeyukkspnqiy.supabase.co' }
  $sbStatus = Get-HttpStatus "$sb/rest/v1/"
  if ($sbStatus -eq '200') { $sbLabel = 'GATEWAY_REACHABLE_ONLY_DB_UNPROVEN' }
  elseif ($sbStatus -in @('401','403')) { $sbLabel = 'GATEWAY_AUTH_REQUIRED_DB_UNPROVEN' }
  elseif ($sbStatus -eq '000' -or $sbStatus -like '5*') { $sbLabel = 'BLOCKED' }
  else { $sbLabel = "HTTP_$($sbStatus)_DB_UNPROVEN" }
  $proof.checks.supabase = [ordered]@{project_ref='wbwgroygjeyukkspnqiy';rest_gateway_http=$sbStatus;status=$sbLabel;authenticated_sql='NOT_TESTED';rpc_health='NOT_PROVEN';writes='NOT_ATTEMPTED'}

  @'
SCOUT: Find the strongest independently sourced demand signal for one approved DreamLedger offer and one inbound/public action that could improve odds of a sale in 48h. Include source URLs and timestamps. Never invent buyers or demand. Return at most five bullets.
'@ | Set-Content -LiteralPath (Join-Path $out 'council\01-scout.txt') -Encoding UTF8
  @'
CRITICAL: Challenge Scout claims. Label VERIFIED / UNVERIFIED / CONTRADICTED / STALE. Check buyer intent, evidence quality, price/scope, checkout readiness, support/contact, delivery capacity, and risk. Never infer DB health from gateway reachability or revenue from internal events.
'@ | Set-Content -LiteralPath (Join-Path $out 'council\02-critic.txt') -Encoding UTF8
  @'
SYNTH: Use Scout evidence and Critical review to produce at most seven actions ordered by commercial value and low effort. One approved offer, one buyer path. Prefer inbound/public distribution. State proof required and blockers. No architecture work unless it directly blocks sale or fulfillment.
'@ | Set-Content -LiteralPath (Join-Path $out 'council\03-synth.txt') -Encoding UTF8
  @'
# One-sale checklist
- [ ] Verify live page, price, scope, payment destination, support/contact, and delivery process.
- [ ] Fix one buyer-visible blocker or improve intake/delivery.
- [ ] Do not promote an offer whose checkout is held or delivery is not ready.
- [ ] Reconcile settled external payment to the exact order, deliver the work, and retain evidence.
- [ ] If any link is missing, mark UNVERIFIED.
- [ ] Page views, checkouts, model output, and CI are not revenue.
'@ | Set-Content -LiteralPath (Join-Path $out 'money\CHECKLIST.md') -Encoding UTF8
  @'
# 777 rules
- Use admissible external signals with source URL and observation time.
- Never fabricate an artifact to make CI green.
- Use the workflow's exact current-run no-op receipt contract when no admissible signal exists.
- Revenue remains NZ$0 until settlement and fulfillment evidence are reconciled.
'@ | Set-Content -LiteralPath (Join-Path $out '777\RULES.md') -Encoding UTF8
  $proof.status = 'PREPARED'
  $proof.readiness = 'DIAGNOSTICS_AND_PROMPTS_ONLY'
  Write-Proof
  Write-Output 'BOOTSTRAP_STATUS=PREPARED_NOT_COMMISSIONED'
  Write-Output "PROOF=$proofPath"
  Write-Output 'LMSTUDIO_INFERENCE=NOT_RUN'
  Write-Output 'SUPABASE_AUTHENTICATED_HEALTH=NOT_PROVEN'
} catch {
  $proof.status = 'FAIL'
  $proof.readiness = 'NOT_READY'
  $proof.error = $_.Exception.Message
  try { Write-Proof } catch { Write-Error 'Could not persist bootstrap proof.' }
  Write-Error $_
  exit 2
} finally {
  if ($transcriptStarted) { try { Stop-Transcript | Out-Null } catch {} }
}