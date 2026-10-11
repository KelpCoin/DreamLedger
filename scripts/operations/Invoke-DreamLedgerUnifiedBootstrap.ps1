[CmdletBinding()]
param(
  [string]$RepoPath = 'D:\BrownEyeCortex\CANONICAL\DreamLedger',
  [int]$InferenceTimeoutSeconds = 90,
  [switch]$RunMembraneProbe
)

# Single entry point. Read-only diagnostics only; no deployments, task mutations,
# Stripe writes, public publishing, database writes, or simulated revenue.
$ErrorActionPreference = 'Stop'
$stamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')
$proofRoot = if (Test-Path 'D:\') { 'D:\BrownEyeCortex\proofs\unified-bootstrap' } else { Join-Path $env:USERPROFILE 'BrownEyeCortex\proofs\unified-bootstrap' }
New-Item -ItemType Directory -Force -Path $proofRoot | Out-Null
$reportPath = Join-Path $proofRoot "unified-bootstrap-$stamp.json"
$logPath = Join-Path $proofRoot "unified-bootstrap-$stamp.log"
$ignitionScript = Join-Path $RepoPath 'scripts\operations\Invoke-DreamLedgerIgnition20.ps1'
$heartbeatScript = Join-Path $RepoPath 'scripts\operations\Start-BrownEyeFactoryHeartbeat.ps1'

function Get-LatestIgnition {
  $dir = if (Test-Path 'D:\') { 'D:\BrownEyeCortex\proofs\factory-bootstrap' } else { Join-Path $env:USERPROFILE 'BrownEyeCortex\proofs\factory-bootstrap' }
  $f = Get-ChildItem -LiteralPath $dir -Filter 'ignition-*.json' -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
  if ($f) { try { return (Get-Content -LiteralPath $f.FullName -Raw | ConvertFrom-Json) } catch {} }
  return $null
}
function Get-Gate([object]$Ignition, [int]$Id) {
  if (-not $Ignition) { return $null }
  return $Ignition.gates | Where-Object { [int]$_.gate -eq $Id } | Select-Object -First 1
}
function Map-GateStatus([object]$Gate) {
  if (-not $Gate) { return 'UNVERIFIED' }
  if ($Gate.status -in @('PASS','FAIL','BLOCKED','WARN')) { return [string]$Gate.status }
  return 'OBSERVED_NOT_ACCEPTANCE'
}
function Add-Outcome([System.Collections.Generic.List[object]]$List, [int]$Id, [string]$Name, [string]$Status, [string]$Evidence, [string]$NextAction) {
  $List.Add([pscustomobject]@{ outcome=$Id; name=$Name; status=$Status; evidence=$Evidence; next_action=$NextAction })
}

try {
  Start-Transcript -LiteralPath $logPath -Force | Out-Null
  Write-Host 'DREAMLEDGER UNIFIED BOOTSTRAP: VERIFY FIRST; NO PRODUCTION MUTATIONS'
  if (-not (Test-Path (Join-Path $RepoPath '.git'))) { throw "Canonical repository not found at '$RepoPath'. No clone or overwrite attempted." }
  if (-not (Test-Path $ignitionScript)) { throw "Missing prerequisite: $ignitionScript. Fetch the PR #648 branch before running." }
  if (-not (Test-Path $heartbeatScript)) { throw "Missing prerequisite: $heartbeatScript. Fetch the PR #648 branch before running." }

  Write-Host 'PHASE 1/3: Running the 20-gate environment and production GET verifier...'
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $ignitionScript -RepoPath $RepoPath -InferenceTimeoutSeconds $InferenceTimeoutSeconds
  $ignitionExit = $LASTEXITCODE
  $ignition = Get-LatestIgnition

  Write-Host 'PHASE 2/3: Running the local factory heartbeat once...'
  $heartbeatArgs = @('-NoProfile','-ExecutionPolicy','Bypass','-File',$heartbeatScript,'-Once')
  if ($RunMembraneProbe) { $heartbeatArgs += '-RunMembraneProbe' }
  & powershell.exe @heartbeatArgs
  $heartbeatExit = $LASTEXITCODE
  $heartbeatRoot = if (Test-Path 'D:\') { 'D:\BrownEyeCortex\proofs\factory-heartbeat' } else { Join-Path $env:USERPROFILE 'BrownEyeCortex\proofs\factory-heartbeat' }
  $heartbeatPath = Join-Path $heartbeatRoot 'heartbeat-latest.json'
  $heartbeat = $null
  if (Test-Path $heartbeatPath) { try { $heartbeat = Get-Content -LiteralPath $heartbeatPath -Raw | ConvertFrom-Json } catch {} }

  Write-Host 'PHASE 3/3: Reconciling the 20 intended operational outcomes...'
  $o = [System.Collections.Generic.List[object]]::new()
  $g1=Get-Gate $ignition 1; $g2=Get-Gate $ignition 2; $g3=Get-Gate $ignition 3
  $g4=Get-Gate $ignition 4; $g5=Get-Gate $ignition 5; $g6=Get-Gate $ignition 6
  $g7=Get-Gate $ignition 7; $g8=Get-Gate $ignition 8; $g9=Get-Gate $ignition 9
  $g10=Get-Gate $ignition 10; $g11=Get-Gate $ignition 11; $g12=Get-Gate $ignition 12
  $g13=Get-Gate $ignition 13; $g14=Get-Gate $ignition 14; $g15=Get-Gate $ignition 15
  $g16=Get-Gate $ignition 16; $g17=Get-Gate $ignition 17; $g18=Get-Gate $ignition 18
  $g19=Get-Gate $ignition 19; $g20=Get-Gate $ignition 20

  Add-Outcome $o 1 'One authoritative supervisor / canonical checkout' (Map-GateStatus $g1) ("repo={0}; branch={1}" -f $RepoPath,$ignition.git_branch) 'Confirm the canonical checkout and retain this single entrypoint; do not create another scheduler.'
  Add-Outcome $o 2 'Physical GPU telemetry' $(if($heartbeat -and $heartbeat.gpu_after.available){'PASS'}else{Map-GateStatus $g6}) $(if($heartbeat){[string]$heartbeat.gpu_after.detail}else{'No heartbeat JSON'}) 'Install or repair NVIDIA driver/CLI only if telemetry is genuinely unavailable.'
  $modelCount = if($heartbeat){[int]$heartbeat.loaded_model_count}else{0}
  $allInference = $false
  if($heartbeat -and $heartbeat.model_inference_tests){$allInference = (@($heartbeat.model_inference_tests).Count -gt 0 -and @($heartbeat.model_inference_tests | Where-Object { -not $_.ok }).Count -eq 0)}
  Add-Outcome $o 3 'Three-model specialist inference' $(if($modelCount -ge 3 -and $allInference){'PASS'}elseif($modelCount -eq 0){'BLOCKED'}else{'FAIL'}) ("API-exposed models={0}; heartbeat inference pass={1}" -f $modelCount,$allInference) 'Load/configure the intended models through LM Studio, then rerun this same bootstrap.'
  Add-Outcome $o 4 'Useful-work scheduler inventory' 'OBSERVED_NOT_ACCEPTANCE' 'Processes gate 11 and scheduled tasks gate 12 captured; no task created or changed.' 'Review the captured inventory and select one existing supervisor; scheduling is not changed automatically.'
  Add-Outcome $o 5 'Restart recovery' 'UNVERIFIED' 'This run does not reboot, restart services, or simulate a crash.' 'After the supervisor is explicitly chosen, run a controlled restart test and retain before/after receipts.'
  $memStatus = if($heartbeat){[string]$heartbeat.membrane.status}else{'NO_HEARTBEAT'}
  $memEvidence = if($heartbeat -and $heartbeat.membrane){$heartbeat.membrane | ConvertTo-Json -Depth 6 -Compress}else{'No membrane evidence'}
  Add-Outcome $o 6 'Figure Eight membrane endpoint and receipt' $(if($memStatus -eq 'PASS'){'PASS'}elseif($memStatus -eq 'NOT_CONFIGURED'){'BLOCKED'}else{$memStatus}) $memEvidence 'Set BEC_MEMBRANE_URL to the actual endpoint and BEC_MEMBRANE_TOKEN if required; rerun with -RunMembraneProbe.'
  Add-Outcome $o 7 'Local-to-online authenticated round trip' 'UNVERIFIED' 'A nonce probe alone is not proof of a durable cross-boundary task.' 'Require task ID, nonce, authenticated identity, timestamp, replay protection, and durable remote receipt.'
  Add-Outcome $o 8 'Online-to-local return path' 'UNVERIFIED' 'No signed remote task was delivered to a local worker in this read-only run.' 'Add a real task and response round-trip test after the membrane contract is identified.'
  Add-Outcome $o 9 'Replay quarantine' 'UNVERIFIED' 'No duplicate nonce/task was submitted; no replay behavior claimed.' 'Submit a controlled duplicate to a test endpoint and prove it is rejected/quarantined.'
  Add-Outcome $o 10 'Round-trip reconciliation' 'UNVERIFIED' 'No matched local and remote durable receipts available.' 'Reconcile task ID, nonce, receipt ID, timestamps, and terminal status from both sides.'
  Add-Outcome $o 11 'Elohim candidate audit' 'UNVERIFIED' 'The bootstrap does not create, approve, or publish candidates.' 'Run candidates through the existing policy registry and Gauntlet; unknown evidence remains quarantined.'
  Add-Outcome $o 12 'Offer scope gate' 'UNVERIFIED' 'No offer is approved by environment diagnostics.' 'Require exact deliverable, exclusions, acceptance test, fulfillment owner, and refund boundary.'
  Add-Outcome $o 13 'Price registry gate' 'UNVERIFIED' 'No live Stripe price was retrieved or modified by this read-only bootstrap.' 'Verify the approved currency/amount maps to an active Stripe Price ID before exposing checkout.'
  Add-Outcome $o 14 'Checkout attribution gate' 'UNVERIFIED' 'No checkout-to-order attribution was proven in this run.' 'Require immutable offer ID, price ID, checkout/session ID, and order ID linkage.'
  Add-Outcome $o 15 'Settled external payment' 'UNVERIFIED' 'No Stripe settlement evidence was fetched; diagnostic execution is not revenue.' 'Verify a live-mode paid/settled payment from Stripe and reconcile it to one independent buyer and order.'
  Add-Outcome $o 16 'Entitlement after settlement' 'UNVERIFIED' 'No payment-triggered entitlement was issued or tested.' 'Issue entitlement only after verified settlement, with idempotency and revocation handling.'
  Add-Outcome $o 17 'Fulfillment contract' 'UNVERIFIED' 'No paid order was fulfilled by this diagnostic.' 'Run the exact fulfillment contract against a verified paid order; never use a test payment as proof.'
  Add-Outcome $o 18 'Delivered artifact evidence' 'UNVERIFIED' 'No customer delivery artifact was verified.' 'Record artifact hash, recipient/order linkage, delivery timestamp, and acceptance evidence.'
  Add-Outcome $o 19 'Full economic truth chain' 'UNVERIFIED' 'Buyer, authorization, settlement, fulfillment, delivery, and evidence were not proven end-to-end.' 'Mark VERIFIED only when every link is independently evidenced and reconciled.'
  Add-Outcome $o 20 'Replicate only a proven mechanism' 'BLOCKED' 'No verified paid-and-fulfilled outcome is evidenced by this bootstrap.' 'Keep replication disabled until at least one real buyer, settled payment, fulfilled order, and delivery evidence reconcile.'

  $summary = [ordered]@{
    schema='DREAMLEDGER/UNIFIED-BOOTSTRAP/1'
    generated_at_utc=[DateTime]::UtcNow.ToString('o')
    repository=$RepoPath
    git_branch=if($ignition){$ignition.git_branch}else{$null}
    git_commit=if($ignition){$ignition.git_commit}else{$null}
    child_process_exit_codes=@{ignition=$ignitionExit;heartbeat=$heartbeatExit}
    source_reports=@{ignition=(if($ignition){'factory-bootstrap/ignition-*.json'}else{$null});heartbeat=$heartbeatPath}
    outcomes=$o.ToArray()
    counts=@{pass=@($o|Where-Object{$_.status -eq 'PASS'}).Count;fail=@($o|Where-Object{$_.status -eq 'FAIL'}).Count;blocked=@($o|Where-Object{$_.status -eq 'BLOCKED'}).Count;unverified=@($o|Where-Object{$_.status -eq 'UNVERIFIED'}).Count;observed_not_acceptance=@($o|Where-Object{$_.status -eq 'OBSERVED_NOT_ACCEPTANCE'}).Count}
    economic_truth=@{verified_external_revenue_nzd=0;settled_external_payments=0;independent_buyers=0;paid_fulfilled_orders=0;verified_outcomes=0;status='UNCHANGED_NOT_PROVEN_BY_DIAGNOSTIC'}
    safety=@{production_mutations=0;stripe_writes=0;database_writes=0;deployments=0;public_posts=0;scheduled_task_mutations=0}
    interpretation='PASS means only the named acceptance evidence passed. UNVERIFIED is not a pass. This bootstrap cannot create buyer demand or claim revenue.'
  }
  $summary | ConvertTo-Json -Depth 14 | Set-Content -LiteralPath $reportPath -Encoding UTF8
  Write-Host ''
  Write-Host "UNIFIED REPORT: $reportPath"
  Write-Host "HEARTBEAT: $heartbeatPath"
  Write-Host ("OUTCOMES pass={0}; fail={1}; blocked={2}; unverified={3}; observed-only={4}" -f $summary.counts.pass,$summary.counts.fail,$summary.counts.blocked,$summary.counts.unverified,$summary.counts.observed_not_acceptance)
  Write-Host 'No production mutations performed. Inspect the JSON; do not treat diagnostic passes as revenue.'
}
catch {
  Write-Error ("UNIFIED BOOTSTRAP FAILED CLOSED: " + $_.Exception.Message)
  exit 1
}
finally {
  try { Stop-Transcript | Out-Null } catch {}
}
