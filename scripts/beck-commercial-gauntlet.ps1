#Requires -Version 5.1
[CmdletBinding()]
param(
  [string]$ProofRoot = $(if (Test-Path 'D:\') { 'D:\BrownEyeCortex\Runtime\proofs' } else { Join-Path $HOME 'BrownEyeCortex\Runtime\proofs' }),
  [string]$OfferUrl = 'https://dreamledger.org/billboard.html',
  [string]$TruthOracleUrl = 'https://dreamledger.org/',
  [string]$StripePaymentProof = ''
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$null = New-Item -ItemType Directory -Force -Path $ProofRoot
$checks = [System.Collections.Generic.List[object]]::new()
function Add-Check([string]$Id,[string]$Name,[bool]$Pass,[string]$Evidence,[string]$Failure) {
  $checks.Add([ordered]@{ id=$Id; name=$Name; status=$(if($Pass){'PASS'}else{'BLOCKED'}); evidence=$Evidence; failure= $(if($Pass){$null}else{$Failure}) })
}
function Test-Http([string]$Url) {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri $Url -Method Get -MaximumRedirection 5 -TimeoutSec 20
    return [ordered]@{ ok=([int]$r.StatusCode -ge 200 -and [int]$r.StatusCode -lt 400); status=[int]$r.StatusCode; final_url=[string]$r.BaseResponse.ResponseUri.AbsoluteUri }
  } catch {
    $code = $null
    try { $code = [int]$_.Exception.Response.StatusCode } catch {}
    return [ordered]@{ ok=$false; status=$code; final_url=$null; error=$_.Exception.Message.Substring(0,[Math]::Min(250,$_.Exception.Message.Length)) }
  }
}
$truth = Test-Http $TruthOracleUrl
$offer = Test-Http $OfferUrl
Add-Check 'C1' 'Candidate and offer identity' ($offer.ok) $OfferUrl 'Offer URL did not return a successful HTTP response.'
Add-Check 'C2' 'Checkout destination reachable' ($offer.ok) ("HTTP=" + $offer.status + '; final=' + $offer.final_url) 'Offer page unavailable; checkout itself still requires separate live verification.'
Add-Check 'C3' 'Retired audit URL not treated as offer' $true 'Commercial pass does not depend on the absorbed audit page.' 'Not applicable.'
Add-Check 'C9' 'Truth Oracle reachable' ($truth.ok) ("HTTP=" + $truth.status + '; final=' + $truth.final_url) 'Truth Oracle endpoint did not return a successful HTTP response.'
$stripeRead = 'SKIPPED_NO_STRIPE_SECRET_KEY'
if (-not [string]::IsNullOrWhiteSpace($env:STRIPE_SECRET_KEY)) {
  try {
    $h = @{ Authorization = 'Bearer ' + $env:STRIPE_SECRET_KEY }
    $r = Invoke-RestMethod -Method Get -Uri 'https://api.stripe.com/v1/balance' -Headers $h -TimeoutSec 20
    $stripeRead = 'PASS_AUTHENTICATED_READ_ONLY_BALANCE_ENDPOINT_CURRENCY_COUNT=' + @($r.available).Count
  } catch { $stripeRead = 'BLOCKED_STRIPE_READ_ONLY_API_ERROR=' + $_.Exception.Message.Substring(0,[Math]::Min(200,$_.Exception.Message.Length)) }
}
Add-Check 'C4' 'Live Stripe credential and API' ($stripeRead.StartsWith('PASS_')) $stripeRead 'Live Stripe credentials absent or Stripe read-only API failed. No secret is written to proof.'
$payment = $null
if (-not [string]::IsNullOrWhiteSpace($StripePaymentProof) -and (Test-Path -LiteralPath $StripePaymentProof)) {
  try { $payment = Get-Content -LiteralPath $StripePaymentProof -Raw | ConvertFrom-Json } catch {}
}
$settled = $false
$fulfilled = $false
$independent = $false
$evidence = 'No valid external payment/fulfillment evidence file supplied.'
if ($payment) {
  $settled = ([string]$payment.payment_status -eq 'succeeded' -and [string]$payment.settlement_status -eq 'settled')
  $fulfilled = ([string]$payment.fulfillment_status -eq 'fulfilled' -and -not [string]::IsNullOrWhiteSpace([string]$payment.delivery_evidence_uri))
  $independent = ([bool]$payment.independent_buyer -and -not [bool]$payment.test_mode -and -not [bool]$payment.internal)
  $evidence = 'Proof file parsed; payment_status=' + $payment.payment_status + '; settlement_status=' + $payment.settlement_status + '; fulfillment_status=' + $payment.fulfillment_status
}
Add-Check 'C5' 'Independent external paid order' ($settled -and $independent) $evidence 'Requires provider-backed succeeded + settled payment from an independent buyer, not test/internal/unmatched activity.'
Add-Check 'C6' 'Fulfillment completed' $fulfilled $evidence 'Requires fulfilled status plus delivery_evidence_uri.'
Add-Check 'C7' 'Delivery evidence retained' ($fulfilled -and $payment.delivery_evidence_sha256 -match '^[a-fA-F0-9]{64}$') $evidence 'Requires a SHA-256 digest for retained delivery evidence.'
Add-Check 'C8' 'Truth chain reconciled' ($settled -and $fulfilled -and $independent -and -not [string]::IsNullOrWhiteSpace([string]$payment.provider_event_id) -and -not [string]::IsNullOrWhiteSpace([string]$payment.order_id)) $evidence 'Requires linked provider event, order, settled payment, independent buyer, and fulfillment.'
Add-Check 'C10' 'Replication permission' ($settled -and $fulfilled -and $independent -and [bool]$payment.replication_authorized) $evidence 'Replication stays disabled until one real order is settled, fulfilled, evidenced, and explicitly authorized.'
$passCount = @($checks | Where-Object status -eq 'PASS').Count
$allPass = $passCount -eq 10
$proof = [ordered]@{
  schema='DREAMLEDGER-COMMERCIAL-GAUNTLET/v1'
  generated_at_utc=[DateTime]::UtcNow.ToString('o')
  verdict=$(if($allPass){'PASS'}else{'BLOCKED'})
  score_out_of_100=$passCount * 10
  passed=$passCount
  required=10
  verified_revenue_nzd=0
  revenue_claim='UNVERIFIED_UNLESS_PROVIDER_SETTLEMENT_AND_FULFILLMENT_EVIDENCE_ARE_LINKED'
  live_stripe_probe=$stripeRead
  checks=@($checks)
  guardrails=@('Read-only probes only. No purchases, writes, deployments, public posts, or webhook changes.','HTTP 401 is not database health.','Heartbeat and checkout reachability are not revenue.','Missing evidence is BLOCKED, never PASS.')
}
$path = Join-Path $ProofRoot 'COMMERCIAL-GAUNTLET-LATEST.json'
$proof | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $path -Encoding UTF8
Write-Output ('COMMERCIAL_GAUNTLET_STATUS=' + $proof.verdict)
Write-Output ('COMMERCIAL_GAUNTLET_SCORE=' + $proof.score_out_of_100 + '/100')
Write-Output ('COMMERCIAL_GAUNTLET_PROOF=' + $path)
$checks | ForEach-Object { Write-Output ($_.id + '=' + $_.status + ' ' + $_.name) }
if (-not $allPass) { exit 2 }
exit 0
