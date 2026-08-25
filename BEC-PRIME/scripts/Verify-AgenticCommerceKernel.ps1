#requires -Version 5.1
[CmdletBinding()]
param([string]$Root = "BEC-PRIME")
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$enginePath = Join-Path $repo "AGENTIC-COMMERCE-ENGINE.json"
$catalogPath = Join-Path $repo "catalog\offers.json"
$engine = Get-Content -Raw -Path $enginePath | ConvertFrom-Json
$catalog = Get-Content -Raw -Path $catalogPath | ConvertFrom-Json
$checks = [ordered]@{}
$checks.engine_json = $true
$checks.catalog_json = $true
$checks.event_order = @($engine.event_order).Count -ge 9
$checks.external_payment_gate = $engine.truth_rules.revenue_requires -eq "verified_external_payment"
$checks.public_approval_gate = $engine.truth_rules.public_outreach_requires_approval -eq $true
$checks.silo_rules = ($engine.silos.mtg -eq "isolated" -and $engine.silos.adult -eq "isolated" -and $engine.silos.commerce -eq "isolated")
$offers = @($catalog.offers)
$approved = @($offers | Where-Object { $_.status -eq "APPROVED" -and $_.approval_required -eq $false })
$checks.catalog_has_offers = $offers.Count -gt 0
$checks.approved_sellable_offers = $approved.Count -gt 0
$checks.no_approved_offer_without_price = (@($approved | Where-Object { [int]$_.price -le 0 }).Count -eq 0)
$checks.no_approved_offer_without_delivery = (@($approved | Where-Object { [string]::IsNullOrWhiteSpace([string]$_.delivery_method) }).Count -eq 0)
$result = if (@($checks.Values | Where-Object { -not $_ }).Count -eq 0) { "PASS" } else { "FAIL" }
Write-Host ("RESULT=" + $result)
Write-Host ("APPROVED_OFFERS=" + $approved.Count)
if ($result -ne "PASS") { exit 1 }
exit 0
