#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$Root = (Split-Path -Parent $PSScriptRoot)
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$proofDir = Join-Path $Root 'Proof'
New-Item -ItemType Directory -Force -Path $proofDir | Out-Null
$approvedPath = Join-Path $Root 'catalog\offers\approved.json'
$approved = Get-Content -Raw -Path $approvedPath | ConvertFrom-Json
$errors = New-Object System.Collections.Generic.List[string]
foreach ($offer in @($approved.approved)) {
    foreach ($field in @('offer_id','product_id','name','payment_link_url','fulfillment_route','proof_of_delivery')) {
        if ([string]::IsNullOrWhiteSpace([string]$offer.$field)) { $errors.Add("$($offer.offer_id): missing $field") }
    }
    if ([string]$offer.fulfillment_route -notmatch 'stripe_webhook') { $errors.Add("$($offer.offer_id): fulfillment is not webhook-driven") }
    if ([string]$offer.fulfillment_route -notmatch 'automatic') { $errors.Add("$($offer.offer_id): fulfillment is not explicitly automatic") }
    if (@($offer.verification_rules) -notcontains 'payment_paid') { $errors.Add("$($offer.offer_id): payment_paid gate missing") }
    if (@($offer.verification_rules) -notcontains 'durable_fulfillment_proof') { $errors.Add("$($offer.offer_id): durable_fulfillment_proof gate missing") }
    if (@($offer.verification_rules) -notcontains 'automatic_publication') { $errors.Add("$($offer.offer_id): automatic_publication gate missing") }
}
$result = if ($errors.Count -eq 0) { 'PASS' } else { 'FAIL' }
$proof = [ordered]@{
    timestamp = (Get-Date).ToString('o')
    approved_offer_count = @($approved.approved).Count
    result = $result
    errors = @($errors)
    rule = 'No publicly approved offer may exist without verified zero-human fulfillment.'
}
$path = Join-Path $proofDir ('OFFER-FULFILLMENT-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.json')
$proof | ConvertTo-Json -Depth 8 | Set-Content -Path $path -Encoding UTF8
Write-Host "RESULT=$result"
Write-Host "APPROVED_OFFERS=$(@($approved.approved).Count)"
Write-Host "PROOF=$path"
if ($errors.Count) { $errors | ForEach-Object { Write-Host "ERROR=$_" } ; exit 1 }
exit 0
