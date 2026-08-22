$ErrorActionPreference = 'Stop'
$repo = 'https://raw.githubusercontent.com/KelpCoin/DreamLedger/main'
$proofUrl = "$repo/BEC-PRIME/economics/PROOF-CUBE-AUDIT001-2026-08-22.json"
$catalogUrl = "$repo/BEC-PRIME/economics/CUBE-ECONOMIC-EVENTS-100.json"

$proof = Invoke-RestMethod -Uri $proofUrl -Method Get
$catalog = Invoke-RestMethod -Uri $catalogUrl -Method Get

$checks = [ordered]@{
  ProofPass = ($proof.status -eq 'PASS_WITH_EXTERNAL_PAYMENT_PENDING')
  CatalogHas100Events = ($catalog.events.Count -eq 100)
  SupplyVerified = ($proof.checks.supply_verified -eq $true)
  SupplyNotRevenue = ($proof.checks.supply_is_revenue -eq $false)
  LivePaymentLink = ($proof.checks.live_stripe_payment_link -eq $true)
  PaymentStillPending = ($proof.checks.payment_settled -eq $false)
  RevenueStillZero = ($proof.checks.revenue_claimed -eq $false)
  PublicPostingBlocked = ($proof.checks.public_post_performed -eq $false)
}

$failed = @($checks.GetEnumerator() | Where-Object { -not $_.Value })
$checks.GetEnumerator() | ForEach-Object { '{0}={1}' -f $_.Key, $_.Value }

if ($failed.Count -gt 0) {
  Write-Error ('VERIFY_FAIL: ' + (($failed | ForEach-Object Key) -join ', '))
  exit 1
}

Write-Host 'VERIFY_PASS: CUBE AUDIT-001 gate is armed; external payment is the next economic gate.'
exit 0
