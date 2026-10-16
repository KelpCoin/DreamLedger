#requires -Version 5.1
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot '..'
$offersFile = Join-Path $root 'catalog\offers\offers.json'
$approvedFile = Join-Path $root 'catalog\offers\approved.json'
$capabilitiesFile = Join-Path $root 'catalog\ip-capabilities.json'
$registryFile = Join-Path $root 'fulfillment\PRODUCT-FULFILLMENT-REGISTRY.json'
$proofFile = Join-Path $root 'PROOF-APPROVED-OFFER-CONTRACT.json'

foreach ($file in @($offersFile, $approvedFile, $capabilitiesFile, $registryFile)) {
    if (-not (Test-Path -LiteralPath $file)) { throw "Missing required file: $file" }
}

$offers = Get-Content -Raw -LiteralPath $offersFile | ConvertFrom-Json
$approvedCatalog = Get-Content -Raw -LiteralPath $approvedFile | ConvertFrom-Json
$catalog = Get-Content -Raw -LiteralPath $capabilitiesFile | ConvertFrom-Json

$errors = New-Object System.Collections.Generic.List[string]
$validIds = @($catalog.capabilities | ForEach-Object { $_.id })
$approvedRecords = @($approvedCatalog.approved)
$compiledRecords = @($offers.offers)
$compiledById = @{}

$gateCode = @'
const fs = require("node:fs");
const { evaluateCanonicalProduct } = require("./runtime/canonicalCheckoutGate.js");
const productPath = process.env.DL_PRODUCT_PATH;
const registryPath = process.env.DL_FULFILLMENT_REGISTRY_PATH;
const repoRoot = process.env.DL_REPO_ROOT;
if (!productPath || !registryPath || !repoRoot) throw new Error("canonical gate inputs are incomplete");
const product = JSON.parse(fs.readFileSync(productPath, "utf8"));
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const result = evaluateCanonicalProduct(product, registry, repoRoot);
process.stdout.write(JSON.stringify({
  allowed: result.allowed === true,
  reasons: Array.isArray(result.reasons) ? result.reasons : [],
  checkout_url: result.checkout_url || null
}));
'@

if ($offers.schema -ne 'BEC-PRIME/OFFER-CATALOG/v1') { $errors.Add('offers schema mismatch') }
if ($offers.compiler -ne 'offer-compiler-v1') { $errors.Add('compiler version mismatch') }

foreach ($offer in $compiledRecords) {
    if ([string]::IsNullOrWhiteSpace([string]$offer.offer_id)) {
        $errors.Add('compiled offer missing offer_id')
        continue
    }
    if ($compiledById.ContainsKey([string]$offer.offer_id)) {
        $errors.Add("duplicate compiled offer id: $($offer.offer_id)")
        continue
    }
    $compiledById[[string]$offer.offer_id] = $offer
}

foreach ($record in $approvedRecords) {
    $id = [string]$record.offer_id
    if ([string]::IsNullOrWhiteSpace($id)) {
        $errors.Add('approved record missing offer_id')
        continue
    }
    if (-not $compiledById.ContainsKey($id)) {
        $errors.Add("approved offer missing from compiled catalog: $id")
        continue
    }
    $offer = $compiledById[$id]
    if ($offer.silo -ne $record.silo) { $errors.Add("$($id): silo mismatch between approved source and compiled catalog") }
    if ([double]$offer.price -ne [double]$record.price) { $errors.Add("$($id): price mismatch between approved source and compiled catalog") }
    if ([string]$offer.currency -ne [string]$record.currency) { $errors.Add("$($id): currency mismatch between approved source and compiled catalog") }
    if ($offer.capability_id -notin $validIds) { $errors.Add("$($id): compiled capability is not present in capability catalog") }

    $productFile = Join-Path (Join-Path $root 'catalog\products') ("{0}.json" -f [string]$record.product_id)
    if (-not (Test-Path -LiteralPath $productFile)) {
        $errors.Add("$($id): canonical product file is missing")
        continue
    }

    $priorProduct = $env:DL_PRODUCT_PATH
    $priorRegistry = $env:DL_FULFILLMENT_REGISTRY_PATH
    $priorRepoRoot = $env:DL_REPO_ROOT
    try {
        $env:DL_PRODUCT_PATH = (Resolve-Path -LiteralPath $productFile).Path
        $env:DL_FULFILLMENT_REGISTRY_PATH = (Resolve-Path -LiteralPath $registryFile).Path
        $env:DL_REPO_ROOT = $repoRoot
        $gateJson = & node -e $gateCode
        if ($LASTEXITCODE -ne 0) { throw "canonical product gate returned exit code $LASTEXITCODE" }
        $gate = $gateJson | ConvertFrom-Json
    } catch {
        $errors.Add("$($id): canonical product gate could not be evaluated: $($_.Exception.Message)")
        continue
    } finally {
        if ($null -eq $priorProduct) { Remove-Item Env:DL_PRODUCT_PATH -ErrorAction SilentlyContinue } else { $env:DL_PRODUCT_PATH = $priorProduct }
        if ($null -eq $priorRegistry) { Remove-Item Env:DL_FULFILLMENT_REGISTRY_PATH -ErrorAction SilentlyContinue } else { $env:DL_FULFILLMENT_REGISTRY_PATH = $priorRegistry }
        if ($null -eq $priorRepoRoot) { Remove-Item Env:DL_REPO_ROOT -ErrorAction SilentlyContinue } else { $env:DL_REPO_ROOT = $priorRepoRoot }
    }

    $gateOpen = $gate.allowed -eq $true
    $linkMatches = ($gateOpen -and (-not [string]::IsNullOrWhiteSpace([string]$record.payment_link_url)) -and ([string]$record.payment_link_url -ceq [string]$gate.checkout_url))
    $enabled = $linkMatches -and ([string]$record.payment_link_status -ceq 'ACTIVE_LIVEMODE')

    if ($enabled) {
        if ($offer.approval_required -ne $false) { $errors.Add("$($id): canonical gate is open but approval_required must be false") }
        if ($offer.checkout_available -ne $true) { $errors.Add("$($id): canonical gate is open but checkout_available must be true") }
        if ($offer.status -ne 'VERIFIED_AVAILABLE') { $errors.Add("$($id): canonical gate is open but status must be VERIFIED_AVAILABLE") }
        if ([string]$offer.payment_link_url -cne [string]$gate.checkout_url) { $errors.Add("$($id): compiled payment URL differs from canonical product URL") }
        if ($offer.checkout_disabled_reason) { $errors.Add("$($id): enabled offer retains checkout_disabled_reason") }
    } else {
        if ($gateOpen) {
            $expectedStatus = 'HELD_STRIPE_LINK_DRIFT'
            $expectedReason = 'payment_link_does_not_match_canonical_product'
        } else {
            $expectedStatus = 'HELD_CANONICAL_PRODUCT_GATE'
            $expectedReason = if (@($gate.reasons).Count -gt 0) { [string]@($gate.reasons)[0] } else { 'canonical_product_gate_closed' }
        }
        if ($offer.approval_required -ne $true) { $errors.Add("$($id): held offer must have approval_required=true") }
        if ($offer.checkout_available -ne $false) { $errors.Add("$($id): held offer must have checkout_available=false") }
        if ([string]$offer.status -cne $expectedStatus) { $errors.Add("$($id): expected held status $expectedStatus") }
        if (-not [string]::IsNullOrWhiteSpace([string]$offer.payment_link_url)) { $errors.Add("$($id): held offer must not expose payment_link_url") }
        if ([string]$offer.checkout_disabled_reason -cne $expectedReason) { $errors.Add("$($id): checkout_disabled_reason mismatch; expected $expectedReason") }
        $expectedRoute = if ($record.silo -eq 'mtg') { '/mtg/' } elseif ($record.silo -eq 'dreamledger') { '/billboard' } else { '/shop.html' }
        if ([string]$offer.checkout_route -cne $expectedRoute) { $errors.Add("$($id): held offer must use safe route $expectedRoute") }
        if ($null -ne $offer.fulfillment_route -and -not [string]::IsNullOrWhiteSpace([string]$offer.fulfillment_route)) { $errors.Add("$($id): held offer must not expose a fulfillment route") }
    }
}

if ($approvedRecords.Count -eq 0) { $errors.Add('approved catalog contains zero records') }

if ($errors.Count -gt 0) {
    $proof = [ordered]@{
        type = 'dreamledger-offer-compilation-proof'
        status = 'FAIL'
        verified_at = (Get-Date).ToUniversalTime().ToString('o')
        approved_count = $approvedRecords.Count
        compiled_count = $compiledRecords.Count
        errors = @($errors)
    }
    $proof | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $proofFile -Encoding UTF8
    $errors | ForEach-Object { Write-Host "FAIL: $_" -ForegroundColor Red }
    exit 1
}

$proof = [ordered]@{
    type = 'dreamledger-offer-compilation-proof'
    status = 'PASS'
    verified_at = (Get-Date).ToUniversalTime().ToString('o')
    approved_count = $approvedRecords.Count
    compiled_count = $compiledRecords.Count
    approved_offer_ids = @($approvedRecords | ForEach-Object { $_.offer_id })
    contract = 'compiled offer state must match the shared canonical product gate; closed gates stay held and payment URLs remain unexposed'
}
$proof | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $proofFile -Encoding UTF8
Write-Host "PASS: $($approvedRecords.Count) approved source records match the canonical product gate. Held offers remain non-checkoutable." -ForegroundColor Green
