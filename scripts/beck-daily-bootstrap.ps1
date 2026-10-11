# BECK daily bootstrap for Windows PowerShell 5.1+
# Creates a local day kit; checks services read-only; may start local LM Studio server.
$ErrorActionPreference = 'Continue'
$root = if ($env:BEC_DAILY_ROOT) { $env:BEC_DAILY_ROOT } else { Join-Path $HOME 'bec-daily' }
$day = Get-Date -Format 'yyyy-MM-dd'
$out = Join-Path $root $day
New-Item -ItemType Directory -Force -Path (Join-Path $out 'council'),(Join-Path $out 'money'),(Join-Path $out '777') | Out-Null
$log = Join-Path $out 'bootstrap.log'
Start-Transcript -Path $log -Append | Out-Null
function Http-Code([string]$url) {
  try { $r=Invoke-WebRequest -Uri $url -MaximumRedirection 5 -TimeoutSec 12 -UseBasicParsing; return [string][int]$r.StatusCode }
  catch { if ($_.Exception.Response -and $_.Exception.Response.StatusCode) { return [string][int]$_.Exception.Response.StatusCode }; return '000' }
}
try {
  Write-Output "BECK_DAILY_BOOTSTRAP=1"; Write-Output "DATE=$day"; Write-Output "HOST=$env:COMPUTERNAME"; Write-Output "WORKSPACE=$out"
  Write-Output '=== DISK / MEMORY ==='
  Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select-Object DeviceID,Size,FreeSpace | Format-Table -AutoSize
  Get-CimInstance Win32_OperatingSystem | Select-Object TotalVisibleMemorySize,FreePhysicalMemory | Format-List
  Write-Output '=== NVIDIA ==='
  if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) { & nvidia-smi --query-gpu=name,driver_version,memory.total,memory.used,memory.free,utilization.gpu --format=csv,noheader } else { Write-Output 'GPU_STATUS=UNVERIFIED; nvidia-smi unavailable' }
  Write-Output '=== LM STUDIO ==='
  $base=if ($env:BECK_LMSTUDIO_BASE) {$env:BECK_LMSTUDIO_BASE.TrimEnd('/')} else {'http://127.0.0.1:1234/v1'}
  $code=Http-Code "$base/models"
  if ($code -ne '200' -and (Get-Command lms -ErrorAction SilentlyContinue)) { Write-Output 'LMSTUDIO_START_ATTEMPT=1'; & lms server start --port 1234; Start-Sleep -Seconds 2; $code=Http-Code "$base/models" }
  Write-Output "LMSTUDIO_MODELS_HTTP=$code"
  if ($code -eq '200') { try { (Invoke-RestMethod -Uri "$base/models" -TimeoutSec 12).data | ForEach-Object { Write-Output ("MODEL_ID=" + $_.id) } } catch {} } else { Write-Output 'Model loading is not automatic.' }
  Write-Output '=== OFFER PAGES (HTTP ONLY) ==='
  $urls=if ($env:BECK_OFFER_URLS) {$env:BECK_OFFER_URLS -split '\s+'} else {@('https://dreamledger.org/agent-delivery-proof-audit.html','https://dreamledger.org/billboard.html')}
  foreach ($url in $urls) { Write-Output "URL=$url HTTP=$(Http-Code $url)" }
  Write-Output '=== SUPABASE GATEWAY (NO AUTH OR WRITES) ==='
  $sb=if ($env:SUPABASE_URL) {$env:SUPABASE_URL.TrimEnd('/')} else {'https://wbwgroygjeyukkspnqiy.supabase.co'}
  $sc=Http-Code "$sb/rest/v1/"
  Write-Output 'SUPABASE_PROJECT_REF=wbwgroygjeyukkspnqiy'; Write-Output "SUPABASE_REST_HTTP=$sc"
  if ($sc -eq '200') { Write-Output 'SUPABASE_STATUS=GATEWAY_REACHABLE_ONLY; DB/RPC health UNPROVEN' }
  elseif ($sc -in @('401','403')) { Write-Output 'SUPABASE_STATUS=AUTH_REQUIRED; DB/RPC health UNPROVEN' }
  elseif ($sc -eq '000' -or $sc -like '5*') { Write-Output 'SUPABASE_STATUS=BLOCKED; automated fulfillment BLOCKED' }
  else { Write-Output "SUPABASE_STATUS=HTTP_$sc; DB/RPC health UNPROVEN" }
  @' 
SCOUT: Find the strongest existing, independently sourced demand signal for one approved DreamLedger offer and one inbound/public action that could improve odds of a sale in 48h. Include URLs and timestamps. Never invent buyers or demand. Return at most five bullets.
'@ | Set-Content -Encoding UTF8 (Join-Path $out 'council\01-scout.txt')
  @'
CRITICAL: Challenge Scout claims. Label VERIFIED / UNVERIFIED / CONTRADICTED / STALE. Check buyer intent, evidence quality, price/scope, checkout readiness, support/contact, delivery capacity, and risk. Give practical fixes; never infer DB health from gateway reachability or revenue from internal events.
'@ | Set-Content -Encoding UTF8 (Join-Path $out 'council\02-critic.txt')
  @'
SYNTH: Use Scout evidence and Critical review to produce at most seven actions ordered by expected commercial value and low effort. One approved offer, one buyer path. Prefer inbound/public distribution; personal outreach is optional. State proof required and blockers. No architecture work unless it directly blocks sale/fulfillment.
'@ | Set-Content -Encoding UTF8 (Join-Path $out 'council\03-synth.txt')
  @'
# One-sale checklist
- [ ] Verify one approved offer's live page, price, scope, payment destination, support/contact, and delivery process.
- [ ] Do one feasible commercial action: fix a buyer-facing blocker, improve intake/delivery, or publish a useful sourced public post.
- [ ] Do not promote an offer whose checkout is held or delivery is not ready.
- [ ] For a sale, reconcile settled external payment to the exact order, deliver the work, and retain evidence.
- [ ] If any payment-to-delivery evidence is missing, mark UNVERIFIED.
- [ ] Page views, checkouts, model output, and CI are not revenue.
'@ | Set-Content -Encoding UTF8 (Join-Path $out 'money\CHECKLIST.md')
  @'
# 777 rules
- Use only admissible external signals with source URL and observation time.
- New public pulse HTML must cite sources and state revenue is UNVERIFIED unless proven.
- If no admissible signal exists, use the workflow's exact current-run no-op receipt contract.
- Never fabricate an artifact to make CI green.
- Run scripts/777_compounding_gate.py from the repo only after satisfying its artifact/no-op contract.
- Revenue remains NZ$0 until settlement and fulfillment evidence are reconciled.
'@ | Set-Content -Encoding UTF8 (Join-Path $out '777\RULES.md')
  @"
DATE: $day
DONE:
BLOCKED:
ARTIFACTS:
REVENUE_VERIFIED_NZD: 0.00
NEXT:
"@ | Set-Content -Encoding UTF8 (Join-Path $out 'EOD.md')
  Write-Output 'BOOTSTRAP_COMPLETE=1'; Write-Output "WORKSPACE=$out"; Write-Output "LOG=$log"
  Write-Output 'LIMITS=No model loading, Supabase writes, payment claims, or fulfillment claims. HTTP checks do not prove database health.'
} finally { Stop-Transcript | Out-Null }
