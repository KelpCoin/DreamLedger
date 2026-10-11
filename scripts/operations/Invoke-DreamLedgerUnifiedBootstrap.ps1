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

function Get-LatestIgnition([datetime]$SinceUtc) {
  $dir = if (Test-Path 'D:\') { 'D:\BrownEyeCortex\proofs\factory-bootstrap' } else { Join-Path $env:USERPROFILE 'BrownEyeCortex\proofs\factory-bootstrap' }
  $f = Get-ChildItem -LiteralPath $dir -Filter 'ignition-*.json' -File -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTimeUtc -ge $SinceUtc } | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
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

  $ignitionStartedUtc = [DateTime]::UtcNow
  Write-Host 'PHASE 1/3: Running the 20-gate environment and production GET verifier...'
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $ignitionScript -RepoPath $RepoPath -InferenceTimeoutSeconds $InferenceTimeoutSeconds
  $ignitionExit = $LASTEXITCODE
  $ignition = Get-LatestIgnition $ignitionStartedUtc
  if (-not $ignition) { throw 'Ignition verifier did not create a fresh report. Stale reports are never accepted.' }
  if ($ignitionExit -ne 0) { Write-Warning "Ignition verifier exited $ignitionExit; gate results will retain their individual failures." }

  Write-Host 'PHASE 2/3: Running the local factory heartbeat once...'
  $heartbeatArgs = @('-NoProfile','-ExecutionPolicy','Bypass','-File',$heartbeatScript,'-Once')
  if ($RunMembraneProbe) { $heartbeatArgs += '-RunMembraneProbe' }
  & powershell.exe @heartbeatArgs
  $heartbeatExit = $LASTEXITCODE
  $heartbeatRoot = if (Test-Path 'D:\') { 'D:\BrownEyeCortex\proofs\factory-heartbeat' } else { Join-Path $env:USERPROFILE 'BrownEyeCortex\proofs\factory-heartbeat' }
  $heartbeatPath = Join-Path $heartbeatRoot 'heartbeat-latest.json'
  $heartbeat = $null
  if (Test-Path $heartbeatPath) {
    try {
      $heartbeatFile = Get-Item -LiteralPath $heartbeatPath
      if ($heartbeatFile.LastWriteTimeUtc -ge $ignitionStartedUtc) { $heartbeat = Get-Content -LiteralPath $heartbeatPath -Raw | ConvertFrom-Json }
    } catch {}
  }
  if (-not $heartbeat) { Write-Warning 'Heartbeat did not produce fresh evidence; previous heartbeat data will not be reused.' }

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
  $g11=Get-Gate $ignition 11; $g12=Get-Gate $ignition 12
  Add-Outcome $o 4 'Useful-work scheduler inventory' $(if($g11 -and $g12 -and $g11.evidence -and $g12.evidence){'PASS'}else{'UNVERIFIED'}) ("process_inventory={0}; task_inventory={1}; ignition_report_fresh=true" -f [bool]$g11,[bool]$g12) 'Inspect the captured inventory and select one existing supervisor; this diagnostic deliberately does not create or mutate scheduled tasks.'
  $recentRecoveryLogs = @()
  $recoveryRoot = if (Test-Path 'D:\') { 'D:\BrownEyeCortex\proofs' } else { Join-Path $env:USERPROFILE 'BrownEyeCortex\proofs' }
  if (Test-Path $recoveryRoot) { $recentRecoveryLogs = @(Get-ChildItem -LiteralPath $recoveryRoot -Recurse -File -Include '*restart*','*recovery*','*crash*' -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTimeUtc -ge $ignitionStartedUtc } | Select-Object -ExpandProperty FullName -First 10) }
  Add-Outcome $o 5 'Restart recovery' $(if($recentRecoveryLogs.Count -gt 0){'OBSERVED_NOT_ACCEPTANCE'}else{'BLOCKED'}) ("fresh_recovery_artifacts={0}; this run did not restart or crash a service" -f $recentRecoveryLogs.Count) 'A controlled restart/crash test is required; this read-only run will not disrupt the running machine.'
  $memStatus = if($heartbeat){[string]$heartbeat.membrane.status}else{'NO_HEARTBEAT'}
  $memEvidence = if($heartbeat -and $heartbeat.membrane){$heartbeat.membrane | ConvertTo-Json -Depth 6 -Compress}else{'No membrane evidence'}
  Add-Outcome $o 6 'Figure Eight membrane endpoint and receipt' $(if($memStatus -eq 'PASS'){'PASS'}elseif($memStatus -eq 'NOT_CONFIGURED'){'BLOCKED'}else{$memStatus}) $memEvidence 'Set BEC_MEMBRANE_URL to the actual endpoint and BEC_MEMBRANE_TOKEN if required; rerun with -RunMembraneProbe.'
  Add-Outcome $o 7 'Local-to-online authenticated round trip' 'UNVERIFIED' 'A nonce probe alone is not proof of a durable cross-boundary task.' 'Require task ID, nonce, authenticated identity, timestamp, replay protection, and durable remote receipt.'
  Add-Outcome $o 8 'Online-to-local return path' 'UNVERIFIED' 'No signed remote task was delivered to a local worker in this read-only run.' 'Add a real task and response round-trip test after the membrane contract is identified.'
  Add-Outcome $o 9 'Replay quarantine' 'UNVERIFIED' 'No duplicate nonce/task was submitted; no replay behavior claimed.' 'Submit a controlled duplicate to a test endpoint and prove it is rejected/quarantined.'
  Add-Outcome $o 10 'Round-trip reconciliation' 'UNVERIFIED' 'No matched local and remote durable receipts available.' 'Reconcile task ID, nonce, receipt ID, timestamps, and terminal status from both sides.'
  $candidateFiles = @('BEC-PRIME/gauntlet/CandidateGauntlet.js','BEC-PRIME/compiler/FactoryFactoryApprovalPackets.js') | ForEach-Object { Join-Path $RepoPath $_ }
  $candidatePresent = @($candidateFiles | Where-Object { Test-Path $_ }).Count -eq $candidateFiles.Count
  Add-Outcome $o 11 'Elohim candidate audit readiness' $(if($candidatePresent){'OBSERVED_NOT_ACCEPTANCE'}else{'FAIL'}) ("required_policy_files_present={0}; candidate execution/publication was not triggered" -f $candidatePresent) 'A real candidate still needs Gauntlet policy evaluation and durable evidence; this bootstrap will not auto-approve or publish it.'
  $offerFiles = @('BEC-PRIME/compiler/OfferCompiler.js','BEC-PRIME/scripts/verify-commercial-cell.js') | ForEach-Object { Join-Path $RepoPath $_ }
  $offerPresent = @($offerFiles | Where-Object { Test-Path $_ }).Count -eq $offerFiles.Count
  Add-Outcome $o 12 'Offer scope gate readiness' $(if($offerPresent){'OBSERVED_NOT_ACCEPTANCE'}else{'FAIL'}) ("offer_contract_files_present={0}; no offer was newly approved" -f $offerPresent) 'An offer must still specify deliverable, exclusions, acceptance test, fulfillment owner, and refund boundary.'
  $stripeConfigured = -not [string]::IsNullOrWhiteSpace($env:STRIPE_SECRET_KEY)
  $stripePriceCheck = 'NOT_RUN_NO_STRIPE_SECRET_KEY'
  $stripePriceEvidence = 'No Stripe API request was made; no key was found in process environment.'
  if($stripeConfigured){ try { $p=Invoke-RestMethod -Uri 'https://api.stripe.com/v1/prices?limit=3&active=true' -Headers @{Authorization="Bearer $env:STRIPE_SECRET_KEY"} -TimeoutSec 15; $stripePriceCheck='PASS_READ_ONLY_API_REACHABLE'; $stripePriceEvidence=("active_prices_returned={0}; read_only=true" -f @($p.data).Count) } catch { $stripePriceCheck='FAIL'; $stripePriceEvidence=$_.Exception.Message } }
  Add-Outcome $o 13 'Live Stripe price registry reachability' $(if($stripePriceCheck -eq 'PASS_READ_ONLY_API_REACHABLE'){'OBSERVED_NOT_ACCEPTANCE'}elseif($stripePriceCheck -eq 'FAIL'){'FAIL'}else{'BLOCKED'}) $stripePriceEvidence 'A reachable price list does not prove the approved offer-to-price mapping; verify the exact active live-mode Price ID before publishing checkout.'
  $checkoutSource = @('BEC-PRIME/lib/commercePaymentContractPreload.js','BEC-PRIME/scripts/verify-commercial-cell.js') | ForEach-Object { Join-Path $RepoPath $_ }
  $checkoutPresent = @($checkoutSource | Where-Object { Test-Path $_ }).Count -eq $checkoutSource.Count
  Add-Outcome $o 14 'Checkout attribution contract readiness' $(if($checkoutPresent){'OBSERVED_NOT_ACCEPTANCE'}else{'FAIL'}) ("checkout_contract_files_present={0}; no checkout or order was created" -f $checkoutPresent) 'A real order still needs immutable offer, price, checkout/session, and order linkage.'
  $paymentEvidenceRoot = Join-Path $proofRoot 'economic'
  $paymentEvidence = if(Test-Path $paymentEvidenceRoot){@(Get-ChildItem -LiteralPath $paymentEvidenceRoot -File -Filter '*.json' -ErrorAction SilentlyContinue | Where-Object {$_.LastWriteTimeUtc -ge [datetime]::UtcNow.AddDays(-30)} | Select-Object -ExpandProperty FullName -First 10)}else{@()}
  Add-Outcome $o 15 'Settled external payment evidence' $(if($paymentEvidence.Count -gt 0){'OBSERVED_NOT_ACCEPTANCE'}else{'BLOCKED'}) ("recent_economic_evidence_files={0}; file presence alone is not settlement proof" -f $paymentEvidence.Count) 'A real live-mode Stripe settlement must be reconciled to an independent buyer and order; this diagnostic does not charge anyone.'
  $entitlementFiles = @('BEC-PRIME/lib/commercePaymentContractPreload.js','BEC-PRIME/scripts/verify-commercial-cell.js') | ForEach-Object { Join-Path $RepoPath $_ }
  $entitlementPresent = @($entitlementFiles | Where-Object { Test-Path $_ }).Count -eq $entitlementFiles.Count
  Add-Outcome $o 16 'Settlement-gated entitlement readiness' $(if($entitlementPresent){'OBSERVED_NOT_ACCEPTANCE'}else{'FAIL'}) ("payment_contract_files_present={0}; entitlement not issued" -f $entitlementPresent) 'Exercise entitlement issuance only against a verified settled order, including idempotency and revocation.'
  $fulfillmentFiles = @('BEC-PRIME/scripts/verify-commercial-cell.js','BEC-PRIME/runtime/ExecutionGate.js') | ForEach-Object { Join-Path $RepoPath $_ }
  $fulfillmentPresent = @($fulfillmentFiles | Where-Object { Test-Path $_ }).Count -eq $fulfillmentFiles.Count
  Add-Outcome $o 17 'Fulfillment contract readiness' $(if($fulfillmentPresent){'OBSERVED_NOT_ACCEPTANCE'}else{'FAIL'}) ("fulfillment_contract_files_present={0}; no paid order fulfilled" -f $fulfillmentPresent) 'Run the exact fulfillment contract on a verified paid order; test payments are not revenue.'
  $deliveryRoot = Join-Path $proofRoot 'delivery'
  $deliveryEvidence = if(Test-Path $deliveryRoot){@(Get-ChildItem -LiteralPath $deliveryRoot -File -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName -First 10)}else{@()}
  Add-Outcome $o 18 'Delivered artifact evidence' $(if($deliveryEvidence.Count -gt 0){'OBSERVED_NOT_ACCEPTANCE'}else{'BLOCKED'}) ("delivery_evidence_files={0}; content and recipient linkage still require reconciliation" -f $deliveryEvidence.Count) 'Record artifact hash, recipient/order linkage, delivery timestamp, and acceptance evidence.'
  $truthFiles = @($paymentEvidence) + @($deliveryEvidence)
  Add-Outcome $o 19 'Full economic truth-chain evidence availability' $(if($paymentEvidence.Count -gt 0 -and $deliveryEvidence.Count -gt 0){'OBSERVED_NOT_ACCEPTANCE'}else{'BLOCKED'}) ("payment_evidence_files={0}; delivery_evidence_files={1}; file existence alone never verifies the chain" -f $paymentEvidence.Count,$deliveryEvidence.Count) 'Only reconcile as VERIFIED when buyer, authorization, settlement, fulfillment, delivery, and evidence are independently linked.'
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
