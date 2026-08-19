#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$ProofPath = ''
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$ProofDir = Join-Path $Root 'RUN-PROOFS'
if ([string]::IsNullOrWhiteSpace($ProofPath)) {
    if (-not [string]::IsNullOrWhiteSpace($env:BEC_COMPILER_TRUTH_PROOF)) {
        $ProofPath = $env:BEC_COMPILER_TRUTH_PROOF
    } else {
        $ProofPath = Join-Path $ProofDir 'COMPILER-TRUTH-PROOF.json'
    }
}
$ContractPath = Join-Path $Root 'compiler\COMPILER-TRUTH-CONTRACT.json'
$ManifestPath = Join-Path $Root 'manifests\CUBE-PUBLIC-SURFACE-MANIFEST.json'
$OffersPath = Join-Path $Root 'catalog\offers\offers.json'
$ApprovedPath = Join-Path $Root 'catalog\offers\approved.json'
$IpPath = Join-Path $Root 'catalog\ip-capabilities.json'
$SurfaceCompilerPath = Join-Path $Root 'compiler\SurfaceCompiler.js'
$OfferCompilerPath = Join-Path $Root 'compiler\OfferCompiler.js'
$MetaPath = Join-Path $Root 'scripts\meta-gauntlet.js'
$SentinelPath = Join-Path $Root 'runtime\Sentinel.js'
$Errors = New-Object System.Collections.Generic.List[string]

function Require-File([string]$Path, [string]$Name) {
    if (-not (Test-Path -LiteralPath $Path)) { $Errors.Add("MISSING:$Name") }
}

foreach ($item in @(
    @($ContractPath,'contract'),
    @($ManifestPath,'cube_manifest'),
    @($OffersPath,'offers'),
    @($ApprovedPath,'approved_offers'),
    @($IpPath,'ip_catalog'),
    @($SurfaceCompilerPath,'surface_compiler'),
    @($OfferCompilerPath,'offer_compiler'),
    @($MetaPath,'meta_gauntlet'),
    @($SentinelPath,'sentinel')
)) { Require-File $item[0] $item[1] }

$contract = if ($Errors.Count -eq 0) { Get-Content -Raw $ContractPath | ConvertFrom-Json } else { $null }
$manifest = if ($Errors.Count -eq 0) { Get-Content -Raw $ManifestPath | ConvertFrom-Json } else { $null }
$offers = if ($Errors.Count -eq 0) { Get-Content -Raw $OffersPath | ConvertFrom-Json } else { $null }
$approved = if ($Errors.Count -eq 0) { Get-Content -Raw $ApprovedPath | ConvertFrom-Json } else { $null }
$ip = if ($Errors.Count -eq 0) { Get-Content -Raw $IpPath | ConvertFrom-Json } else { $null }
$approvedIds = if ($approved) { @($approved.approved | ForEach-Object { [string]$_.offer_id }) } else { @() }

if ($contract) {
    if ($contract.surface_rules.server_authoritative_price -ne $true) { $Errors.Add('POLICY:server_authoritative_price') }
    if ($contract.surface_rules.server_authoritative_inventory -ne $true) { $Errors.Add('POLICY:server_authoritative_inventory') }
    if ($contract.surface_rules.approval_required_before_activation -ne $true) { $Errors.Add('POLICY:approval_required') }
    if ($contract.surface_rules.digital_proxy_auto_open -ne $false) { $Errors.Add('POLICY:digital_proxy_auto_open') }
    if ($contract.surface_rules.demand_radar_charge_authority -ne $false) { $Errors.Add('POLICY:demand_radar_charge') }
    if ($contract.surface_rules.sentinel_charge_authority -ne $false) { $Errors.Add('POLICY:sentinel_charge') }
}

if ($manifest) {
    if ($manifest.surface_policy.server_authoritative_economics -ne $true) { $Errors.Add('MANIFEST:server_authoritative_economics') }
    if ($manifest.surface_policy.approval_required_for_activation -ne $true) { $Errors.Add('MANIFEST:approval_required') }
    if ($manifest.surface_policy.private_material_excluded -ne $true) { $Errors.Add('MANIFEST:private_material_excluded') }
    if ($manifest.surface_policy.silo_isolation_required -ne $true) { $Errors.Add('MANIFEST:silo_isolation') }
}

if ($offers) {
    foreach ($offer in @($offers.offers)) {
        $isApproved = [string]$offer.offer_id -in $approvedIds
        if ($isApproved) {
            if ($offer.approval_required -ne $false) { $Errors.Add("APPROVED_OFFER_LOCKED:$($offer.offer_id)") }
            if ($offer.checkout_available -ne $true) { $Errors.Add("APPROVED_OFFER_CHECKOUT_DISABLED:$($offer.offer_id)") }
            if ($offer.status -ne 'VERIFIED_AVAILABLE') { $Errors.Add("APPROVED_OFFER_STATUS:$($offer.offer_id)") }
        } else {
            if ($offer.approval_required -ne $true) { $Errors.Add("OFFER_UNLOCKED:$($offer.offer_id)") }
            if ($offer.checkout_available -ne $false) { $Errors.Add("OFFER_CHECKOUT_ENABLED:$($offer.offer_id)") }
            if ($offer.status -ne 'candidate') { $Errors.Add("OFFER_STATUS:$($offer.offer_id)") }
        }
        if ($offer.provenance.private_material -ne 'excluded') { $Errors.Add("OFFER_PRIVATE_MATERIAL:$($offer.offer_id)") }
    }
    foreach ($approvedId in $approvedIds) {
        if ($approvedId -notin @($offers.offers | ForEach-Object { [string]$_.offer_id })) { $Errors.Add("APPROVED_OFFER_MISSING:$approvedId") }
    }
}

if ($ip) {
    $ids = @($ip.capabilities | ForEach-Object { [string]$_.id })
    if (($ids | Sort-Object -Unique).Count -ne $ids.Count) { $Errors.Add('IP_DUPLICATE_IDS') }
    $raw = Get-Content -Raw $IpPath
    foreach ($pattern in @('sk_live_','sk_test_','whsec_','PRIVATE KEY','BEGIN RSA PRIVATE KEY','BEGIN OPENSSH PRIVATE KEY')) {
        if ($raw -match [regex]::Escape($pattern)) { $Errors.Add("PUBLIC_SECRET_MARKER:$pattern") }
    }
}

$proof = [ordered]@{
    schema = 'BEC-PRIME/COMPILER-TRUTH-PROOF/v1'
    checked_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    verdict = if ($Errors.Count -eq 0) { 'PASS' } else { 'FAIL' }
    compiler_chain = @('OfferCompiler','SurfaceCompiler','PriceDisplayPatch','Gauntlet','Meta-Gauntlet','Sentinel')
    surface_policy = [ordered]@{
        phone_first = [bool]$contract.surface_rules.phone_first_horizontal_carousels
        thumb_first = [bool]$contract.surface_rules.thumb_first_ctas
        proxy_opt_in = ($contract.surface_rules.digital_proxy_auto_open -eq $false)
        demand_proposal_only = ($contract.surface_rules.demand_radar_publish_authority -eq $false -and $contract.surface_rules.demand_radar_charge_authority -eq $false)
        sentinel_non_economic = ($contract.surface_rules.sentinel_publish_authority -eq $false -and $contract.surface_rules.sentinel_charge_authority -eq $false)
    }
    counts = [ordered]@{
        capabilities = @($ip.capabilities).Count
        offers = @($offers.offers).Count
        approved_offers = $approvedIds.Count
        public_surfaces = @($manifest.public_surfaces).Count
    }
    errors = @($Errors)
    doctrine = 'The website is an output of the compiler chain. Canonical catalogs define commercial truth. Public HTML must never become the economic source of truth.'
}

$parent = Split-Path -Parent $ProofPath
if ($parent -and -not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
$proof | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $ProofPath -Encoding ASCII

Write-Host "VERDICT: $($proof.verdict)"
Write-Host "PROOF: $ProofPath"
Write-Host "CAPABILITIES: $($proof.counts.capabilities)"
Write-Host "OFFERS: $($proof.counts.offers)"
Write-Host "APPROVED OFFERS: $($proof.counts.approved_offers)"
Write-Host "PUBLIC SURFACES: $($proof.counts.public_surfaces)"
if ($Errors.Count -gt 0) { $Errors | ForEach-Object { Write-Host "FAIL: $_" } }
exit $(if ($proof.verdict -eq 'PASS') { 0 } else { 1 })
