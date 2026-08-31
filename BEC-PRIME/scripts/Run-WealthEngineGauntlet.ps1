$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$root = Join-Path $PSScriptRoot '..'
$candidateFile = Join-Path $root 'catalog\products\COMMANDER-DECK-DIAGNOSTIC-001.json'
$offerFile = Join-Path $root 'catalog\offers\offers.json'
$ipFile = Join-Path $root 'catalog\ip-capabilities.json'
$gauntletFile = Join-Path $root 'gauntlet\GauntletV6.js'
$proofDir = Join-Path $root 'Proof\WealthEngine'
$tempFile = Join-Path $env:TEMP 'dreamledger-wealth-gauntlet-offers.json'

foreach ($path in @($candidateFile,$offerFile,$ipFile,$gauntletFile)) {
    if (-not (Test-Path $path)) { throw "Missing required file: $path" }
}
if (-not (Test-Path $proofDir)) { New-Item -ItemType Directory -Path $proofDir -Force | Out-Null }

$candidate = Get-Content -Raw $candidateFile | ConvertFrom-Json
$catalog = Get-Content -Raw $offerFile | ConvertFrom-Json

# Exercise the current first-sale product as a NEW candidate. The candidate
# remains approval-gated and checkout-disabled; the separately approved offer
# remains controlled by catalog/offers/approved.json and PR #59.
$offer = [ordered]@{
    offer_id = 'OFFER-CMD-DIAG-29-NZD-CANDIDATE'
    version = 'offer-v1'
    capability_id = 'PRODUCT-COMMANDER-DECK-DIAGNOSTIC-001'
    silo = 'commerce'
    name = $candidate.name
    problem = 'A business needs evidence-backed assessment of whether its commerce surface can be understood, evaluated, and acted upon by software agents.'
    input = 'Commander name, decklist, strategy if known, and improvement budget.'
    output = 'Diagnostic report with structural findings, cut candidates, upgrade priorities and tuning plan.'
    delivery_mechanism = 'stripe_payment -> automated_fulfillment'
    deliverable = 'Automated Commander deck diagnostic report.'
    target_buyer = 'Commander deck owners seeking actionable tuning guidance'
    eligibility = 'Customer must control or authorize review of the submitted public commerce surface.'
    constraints = @('No credentials collected','No private data requested','No unsupported claims','Silo boundaries enforced')
    price = [int]$candidate.price
    currency = 'NZD'
    pricing_strategy = 'fixed'
    pricing_tier = 'mtg_diagnostic'
    refund_rules = 'Apply the published checkout policy; delivery is not represented as complete before verified fulfillment.'
    payment_adapter = 'stripe'
    checkout_route = '/api/offer-checkout/create'
    approval_required = $true
    checkout_available = $false
    status = 'candidate'
    proof_of_delivery = 'diagnostic_report'
    verification_rules = @('capability_exists','price_positive','approval_gate_locked','checkout_disabled','delivery_defined','proof_defined','silo_isolated','private_material_excluded')
    provenance = [ordered]@{
        capability_ids = @('PRODUCT-COMMANDER-DECK-DIAGNOSTIC-001')
        methodology = 'MTG-SALES-001'
        public_claims_source = 'BEC-PRIME/catalog/ip-capabilities.json'
        private_material = 'excluded'
    }
}

$merged = [ordered]@{
    schema = $catalog.schema
    compiler = $catalog.compiler
    source = $catalog.source
    approval_rule = $catalog.approval_rule
    counts = $catalog.counts
    offers = @($catalog.offers) + @([pscustomobject]$offer)
}
$merged | ConvertTo-Json -Depth 20 | Set-Content -Path $tempFile -Encoding UTF8

$nodeScript = @"
const g = require(process.argv[2]);
const result = g.run({ offerFile: process.argv[3], ipFile: process.argv[4], writeProof: false });
console.log(JSON.stringify(result, null, 2));
if (result.status !== 'PASS') process.exit(2);
"@
$tempJs = Join-Path $env:TEMP 'dreamledger-wealth-gauntlet-run.js'
Set-Content -Path $tempJs -Value $nodeScript -Encoding UTF8

try {
    $json = & node $tempJs $gauntletFile $tempFile $ipFile 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Gauntlet returned exit code $LASTEXITCODE`n$($json -join "`n")" }
    $result = ($json -join "`n") | ConvertFrom-Json
    $proof = [ordered]@{
        schema_version = 'BEC-WEALTH-GAUNTLET-1.1'
        event = 'wealth_engine.candidate_gauntlet_completed'
        status = $result.status
        candidate = $candidate.id
        offer_id = 'OFFER-CMD-DIAG-29-NZD-CANDIDATE'
        price_nzd = [int]$candidate.price
        checkout_enabled = [bool]$offer.checkout_available
        approval_required = [bool]$offer.approval_required
        gauntlet = $result
        checked_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    }
    $proofPath = Join-Path $proofDir 'WEALTH-ENGINE-CANDIDATE-GAUNTLET.json'
    $proof | ConvertTo-Json -Depth 30 | Set-Content -Path $proofPath -Encoding UTF8
    Write-Host 'GAUNTLET_PASS'
    Write-Host "PROOF=$proofPath"
} finally {
    Remove-Item $tempFile,$tempJs -Force -ErrorAction SilentlyContinue
}
