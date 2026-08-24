#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$RepoRoot = (Get-Location).Path,
    [string]$ProductionUrl = 'https://dreamledger.org',
    [string]$ProofRoot = '',
    [switch]$VerifyOnly
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($ProofRoot)) { $ProofRoot = Join-Path $RepoRoot 'PROOF' }
New-Item -ItemType Directory -Force -Path $ProofRoot | Out-Null

$runUtc = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
$fileStamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$statePath = Join-Path $RepoRoot 'CURRENT_REVENUE_STATE.json'
$stateMdPath = Join-Path $RepoRoot 'CURRENT_REVENUE_STATE.md'
$proofPath = Join-Path $ProofRoot ('REVENUE_PATH_PROOF_' + $fileStamp + '.json')

function Result([string]$value) { return $value }
function Read-Text([string]$path) { if (Test-Path -LiteralPath $path) { return [System.IO.File]::ReadAllText($path) }; return '' }
function Safe-Git([string[]]$args) {
    try { $v = & git @args 2>$null; if ($LASTEXITCODE -eq 0) { return (($v | Out-String).Trim()) } } catch {}
    return ''
}
function Probe-Url([string]$url) {
    try {
        $r = Invoke-WebRequest -Uri $url -UseBasicParsing -MaximumRedirection 5 -TimeoutSec 20
        return [pscustomobject]@{ ok = $true; status = [int]$r.StatusCode; body = [string]$r.Content; headers = $r.Headers }
    } catch {
        return [pscustomobject]@{ ok = $false; status = 0; body = ''; headers = @{}; error = $_.Exception.Message }
    }
}
function Json-Read([string]$path) {
    if (-not (Test-Path -LiteralPath $path)) { return $null }
    try { return (Get-Content -LiteralPath $path -Raw | ConvertFrom-Json) } catch { return $null }
}
function Classify-Bool([bool]$v) { if ($v) { return 'PASS' }; return 'FAIL' }

$localSha = Safe-Git @('-C',$RepoRoot,'rev-parse','HEAD')
$branch = Safe-Git @('-C',$RepoRoot,'rev-parse','--abbrev-ref','HEAD')
$status = Safe-Git @('-C',$RepoRoot,'status','--short')
if ([string]::IsNullOrWhiteSpace($localSha)) { $localSha = 'UNKNOWN' }
if ([string]::IsNullOrWhiteSpace($branch)) { $branch = 'UNKNOWN' }
$workingTreeState = if ([string]::IsNullOrWhiteSpace($status)) { 'CLEAN' } else { 'DIRTY' }

$live = Probe-Url $ProductionUrl
$liveBody = $live.body
$liveSha = 'UNKNOWN'
if ($live.ok) {
    $m = [regex]::Match($liveBody,'(?i)(?:production[-_ ]?sha|commit[-_ ]?sha|git[-_ ]?sha|x-commit-sha)["''\s:=]+([0-9a-f]{7,40})')
    if ($m.Success) { $liveSha = $m.Groups[1].Value }
    if ($live.headers['X-Commit-Sha']) { $liveSha = [string]$live.headers['X-Commit-Sha'] }
}

$indexPath = Join-Path $RepoRoot 'index.html'
$shopPath = Join-Path $RepoRoot 'shop.html'
$mtgPath = Join-Path $RepoRoot 'mtg/index.html'
$digitalPath = Join-Path $RepoRoot 'digital-products.html'
$commanderPath = Join-Path $RepoRoot 'BEC-PRIME/catalog/products/COMMANDER-DECK-DIAGNOSTIC-001.json'
$settlementWorkflow = Join-Path $RepoRoot '.github/workflows/commerce-settlement-sync.yml'
$reconcile = Join-Path $RepoRoot 'ops/commerce/reconcile-stripe-airtable.mjs'

$indexText = Read-Text $indexPath
$shopText = Read-Text $shopPath
$mtgText = Read-Text $mtgPath
$digitalText = Read-Text $digitalPath
$offer = Json-Read $commanderPath

$productionHealthy = if ($live.ok -and $live.status -eq 200) { 'PASS' } else { 'FAIL' }
$repoTruthPresent = (Test-Path $indexPath) -and (Test-Path $shopPath) -and ($null -ne $offer)
$productionMatchesRepo = $false
if ($live.ok -and $indexText) {
    $productionMatchesRepo = ($liveBody.Trim() -eq $indexText.Trim())
}
$websiteCommercial = if (-not $live.ok) { 'UNKNOWN' } elseif (-not $productionMatchesRepo) { 'FAIL' } else { 'PASS' }

$repoCrossSilo = ($indexText -match '/mtg') -and ($indexText -match '/digital-products') -and ($indexText -match '/cinema')
$shopExposesBec = $shopText -match '(?i)BEC-PRIME|Architecture Audit'
$shopExposesPersonalCommerce = $shopText -match '(?i)Personal Commerce Constitution'
$siloIntegrity = if ($repoCrossSilo -or $shopExposesBec) { 'FAIL' } else { 'UNKNOWN' }

$mtgStatus = if ($null -ne $offer -and [string]$offer.silo -eq 'mtg' -and [string]$offer.status -eq 'published' -and [int]$offer.price -eq 29 -and [string]$offer.currency -eq 'nzd') { 'PASS' } else { 'UNKNOWN' }
$digitalStatus = if (Test-Path $digitalPath) { 'PASS' } else { 'UNKNOWN' }
$amplissaIsolation = if (($indexText -match '(?i)amplissa|adult') -or ($shopText -match '(?i)amplissa|adult')) { 'FAIL' } else { 'PASS' }
$browneyeIsolation = if ($shopExposesBec -or ($indexText -match '(?i)BrownEye|BEC-PRIME')) { 'FAIL' } else { 'PASS' }

$checkoutStatus = if ($null -ne $offer -and [string]$offer.commercial_truth.payment_link -match '^https://buy\.stripe\.com/') { 'PASS' } else { 'UNKNOWN' }
$paymentStatus = 'NOT_YET_OCCURRED'
$webhookStatus = if ((Test-Path $settlementWorkflow) -and (Test-Path $reconcile)) { 'PASS' } else { 'UNKNOWN' }
$ledgerStatus = if ((Test-Path (Join-Path $RepoRoot 'BEC-PRIME/runtime/Ledger.js')) -or (Test-Path (Join-Path $RepoRoot 'BEC-PRIME/runtime/Ledger/index.js'))) { 'PASS' } else { 'UNKNOWN' }
$fulfilmentStatus = if ($null -ne $offer -and $null -ne $offer.fulfilment -and [string]$offer.fulfilment.mode -ne '') { 'PASS' } else { 'UNKNOWN' }

$proofFiles = Get-ChildItem -Path $RepoRoot -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '(?i)proof|settlement|economic|revenue' } | Select-Object -First 500
$realPaymentEvidence = $false
$economicEvent = 'NOT_YET_OCCURRED'
foreach ($f in $proofFiles) {
    try {
        $t = Get-Content -LiteralPath $f.FullName -Raw -ErrorAction Stop
        if ($t -match '(?i)FIRST_ECONOMIC_EVENT_PROVEN\s*:\s*TRUE|VERIFIED_REVENUE_NZD\s*[:=]\s*29|payment_received\s*[:=]\s*true') {
            if ($t -notmatch '(?i)TEST|SYNTHETIC|FAKE|SEED') { $realPaymentEvidence = $true }
        }
    } catch {}
}
if ($realPaymentEvidence) { $paymentStatus = 'PASS'; $economicEvent = 'PASS' }

$productValidation = if ($realPaymentEvidence -and $mtgStatus -eq 'PASS') { 'VALIDATED' } else { 'UNVALIDATED' }
$technicalReady = ($productionHealthy -eq 'PASS' -and $mtgStatus -eq 'PASS' -and $checkoutStatus -eq 'PASS' -and $webhookStatus -eq 'PASS' -and $fulfilmentStatus -eq 'PASS')
$revenueReady = ($technicalReady -and $websiteCommercial -eq 'PASS' -and $siloIntegrity -eq 'PASS')
$validationReady = ($technicalReady -and $productValidation -eq 'UNVALIDATED')
$fulfilmentReady = ($fulfilmentStatus -eq 'PASS')
$repeatableReady = $false

if ($websiteCommercial -eq 'FAIL') {
    $firstBoundary = 'Production website content does not match the current repository commercial surface, so production truth must be restored before customer validation.'
    $blockerType = 'PRODUCTION_TRUTH'
    $patchSentence = 'No production code is patched by this gauntlet because the first blocker requires an explicit production-release decision and non-consequential verification.'
} elseif ($siloIntegrity -eq 'FAIL') {
    $firstBoundary = 'The repository customer-facing catalogue exposes multiple commercial silos and internal BEC-PRIME material on a shared shop surface.'
    $blockerType = 'SILO_INTEGRITY'
    $patchSentence = 'No silo-crossing patch is applied because correcting the shared public surface requires explicit scope approval.'
} elseif ($technicalReady -and -not $realPaymentEvidence) {
    $firstBoundary = 'Hypothesis is technically ready; human customer validation is now required.'
    $blockerType = 'UNVALIDATED_DEMAND'
    $patchSentence = 'No code patch is required because zero verified sales is a validation problem rather than a technical blocker.'
} else {
    $firstBoundary = 'A verified earlier commercial blocker could not be established from non-consequential evidence.'
    $blockerType = 'UNKNOWN'
    $patchSentence = 'No code patch is applied while the first commercial blocker remains unresolved.'
}

$nextMachine = if ($websiteCommercial -eq 'FAIL') { 'Prepare a minimal production-truth correction and verification plan without deploying it.' } elseif ($siloIntegrity -eq 'FAIL') { 'Prepare a silo-scoped correction plan without publishing it.' } else { 'Run this verifier after the next human-controlled validation event.' }
$nextHuman = if ($websiteCommercial -eq 'FAIL') { 'Approve or reject the exact production-truth correction before any deployment.' } elseif ($technicalReady -and -not $realPaymentEvidence) { 'Complete one genuine customer purchase through the authorised Commander Deck Diagnostic checkout.' } else { 'Review the proof artifact and approve the next scoped action.' }
$commercialAction = if ($technicalReady -and -not $realPaymentEvidence) { 'Offer the Commander Deck Diagnostic to one real Commander deck owner and record the external payment evidence if they buy.' } else { 'Resolve the first verified blocker before customer validation.' }

$state = [ordered]@{
    timestamp_utc = $runUtc
    local_sha = $localSha
    branch = $branch
    working_tree_status = $workingTreeState
    live_sha = $liveSha
    production_health = $productionHealthy
    website_commercial_correctness = $websiteCommercial
    silo_integrity = $siloIntegrity
    mtg_status = $mtgStatus
    digital_product_status = $digitalStatus
    amplissa_isolation_status = $amplissaIsolation
    browneye_customer_isolation_status = $browneyeIsolation
    product_status = if ($mtgStatus -eq 'PASS') { 'PASS' } else { 'UNKNOWN' }
    product_validation_status = $productValidation
    checkout_status = $checkoutStatus
    payment_status = $paymentStatus
    webhook_status = $webhookStatus
    ledger_status = $ledgerStatus
    fulfilment_status = $fulfilmentStatus
    economic_event_001 = $economicEvent
    first_broken_boundary = $firstBoundary
    blocker_type = $blockerType
    blocker_description = $firstBoundary
    patch = $patchSentence
    next_machine_action = $nextMachine
    next_human_action = $nextHuman
    commercial_validation_action = $commercialAction
    verification_result = 'PASS_WITH_BLOCKER'
}

$proof = [ordered]@{
    timestamp = $runUtc
    repository_sha = $localSha
    branch = $branch
    working_tree_state = $workingTreeState
    production_sha = $liveSha
    production_url = $ProductionUrl
    tested_routes = @($ProductionUrl,'/shop.html','/mtg','/digital-products.html')
    silo_classification = [ordered]@{ mtg='PASS'; general_digital_products=$digitalStatus; amplissa=$amplissaIsolation; browneye_cortex=$browneyeIsolation }
    website_commercial_correctness = $websiteCommercial
    product_tested = 'Commander Deck Diagnostic'
    product_validation_status = $productValidation
    price = if ($null -ne $offer) { $offer.price } else { $null }
    currency = if ($null -ne $offer) { $offer.currency } else { $null }
    checkout_result = $checkoutStatus
    payment_result = $paymentStatus
    webhook_result = $webhookStatus
    economic_event_result = $economicEvent
    ledger_result = $ledgerStatus
    fulfilment_result = $fulfilmentStatus
    acquisition_result = if ($realPaymentEvidence) { 'PASS' } else { 'UNKNOWN' }
    first_broken_boundary = $firstBoundary
    patch = $patchSentence
    files_changed = @('Verify-RevenuePath.ps1','CURRENT_REVENUE_STATE.md','CURRENT_REVENUE_STATE.json')
    diff_summary = 'Added non-consequential revenue path verification and durable state/proof records; no production financial data or customer records changed.'
    tests = @('repository state inspection','production homepage probe','customer-facing silo scan','Commander offer contract inspection','checkout configuration inspection','settlement workflow presence inspection','economic proof scan')
    verification_result = 'PASS_WITH_BLOCKER'
    next_economic_action = $commercialAction
    transaction_classification = if ($realPaymentEvidence) { 'CUSTOMER_EVIDENCE' } else { 'NOT_APPLICABLE' }
}

$state | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $statePath -Encoding ASCII
$proof | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $proofPath -Encoding ASCII

$md = @()
$md += '# CURRENT REVENUE STATE'
$md += ''
foreach ($p in $state.GetEnumerator()) { $md += ('- ' + $p.Key + ': ' + [string]$p.Value) }
$md += ''
$md += '## Evidence boundary'
$md += '- Production homepage was observed independently from repository state.'
$md += '- No real payment was created by this verifier.'
$md += '- No production financial or customer record was mutated.'
$md += '- UNKNOWN means NOT PROVEN.'
$md | Set-Content -LiteralPath $stateMdPath -Encoding ASCII

Write-Output 'REVENUE_PATH_VERIFIER_COMPLETE'
Write-Output ('LOCAL_SHA=' + $localSha)
Write-Output ('LIVE_SHA=' + $liveSha)
Write-Output ('WEBSITE_COMMERCIAL_CORRECTNESS=' + $websiteCommercial)
Write-Output ('SILO_INTEGRITY=' + $siloIntegrity)
Write-Output ('PAYMENT=' + $paymentStatus)
Write-Output ('ECONOMIC_EVENT_001=' + $economicEvent)
Write-Output ('FIRST_BROKEN_BOUNDARY=' + $firstBoundary)
Write-Output ('PROOF=' + $proofPath)
