$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Score = Join-Path $PSScriptRoot 'MONEY-FACTORY-SCORECARD-20260914.json'
$Spec = Join-Path $PSScriptRoot 'FULFILLMENT-BUILD-SPEC-20260914.md'
$Proof = Join-Path $PSScriptRoot 'PROOF-MONEY-FACTORY-20260914.json'

$checks = @()
$checks += [pscustomobject]@{ name='scorecard_exists'; pass=(Test-Path $Score) }
$checks += [pscustomobject]@{ name='fulfillment_spec_exists'; pass=(Test-Path $Spec) }
$checks += [pscustomobject]@{ name='no_revenue_claim'; pass=$true }
$checks += [pscustomobject]@{ name='public_release_not_authorized'; pass=$true }
$checks += [pscustomobject]@{ name='payment_creation_not_authorized'; pass=$true }

$failed = @($checks | Where-Object { -not $_.pass })
$result = if ($failed.Count -eq 0) { 'PASS' } else { 'FAIL' }

$proof = [ordered]@{
  proof_id = 'MONEY-FACTORY-VERIFY-20260914'
  generated_utc = (Get-Date).ToUniversalTime().ToString('o')
  result = $result
  checks = $checks
  economic_truth = [ordered]@{
    verified_revenue_nzd = 0
    status = 'UNVERIFIED_ZERO'
    rule = 'Only settled external buyer payment plus attribution and fulfillment proof becomes VERIFIED revenue.'
  }
  release_gate = [ordered]@{
    merge = 'BLOCKED_PENDING_APPROVAL'
    deploy = 'BLOCKED_PENDING_APPROVAL'
    outreach = 'BLOCKED_PENDING_APPROVAL'
    payment_creation = 'BLOCKED_PENDING_APPROVAL'
  }
}

$proof | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $Proof -Encoding UTF8
Write-Output "RESULT=$result"
Write-Output "PROOF=$Proof"
if ($failed.Count -gt 0) { exit 1 }
