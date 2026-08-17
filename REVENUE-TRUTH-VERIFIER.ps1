#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$proofDir = Join-Path $root 'artifacts'
New-Item -ItemType Directory -Force -Path $proofDir | Out-Null
$proof = [ordered]@{
  timestamp_utc = (Get-Date).ToUniversalTime().ToString('o')
  verified_revenue_nzd = 0
  payment_received = $false
  checkout_url = 'https://buy.stripe.com/28EcN54zraG13M3g3idwc1t'
  outbound_message_sent_by_agent = $false
  status = 'UNPROVEN'
}
$path = Join-Path $proofDir 'revenue-truth.json'
$proof | ConvertTo-Json | Set-Content -Encoding UTF8 -Path $path
Write-Host ('PROOF=' + $path)
Write-Host 'VERIFIED_REVENUE_NZD=0'
Write-Host 'PAYMENT_RECEIVED=NO'
Write-Host 'STATUS=UNPROVEN'
