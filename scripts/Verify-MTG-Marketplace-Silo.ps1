#Requires -Version 5.1
[CmdletBinding()]
param(
  [string]$BaseUrl = 'https://dreamledger.org',
  [int]$TimeoutSeconds = 8
)
$ErrorActionPreference = 'Stop'
$root = if (Test-Path 'D:\') { 'D:\BrownEyeCortex\PROOF\MTG' } else { 'C:\BrownEyeCortex\PROOF\MTG' }
New-Item -Path $root -ItemType Directory -Force | Out-Null
$proofPath = Join-Path $root 'MTG_MARKETPLACE_LIVE_PROOF.json'
$checklist = @(
  @{Name='mtg_home'; Path='/mtg/'},
  @{Name='mtg_search'; Path='/mtg-search.html'},
  @{Name='mtg_list'; Path='/mtg-list.html'},
  @{Name='mtg_marketplace'; Path='/mtg-marketplace.html'},
  @{Name='mtg_catalog'; Path='/data/mtg-catalog.json'},
  @{Name='mtg_api'; Path='/api/mtg/marketplace/listings'}
)
$results = @()
foreach ($test in $checklist) {
  $uri = $BaseUrl.TrimEnd('/') + $test.Path
  $row = [ordered]@{name=$test.Name; url=$uri; status=0; pass=$false; reason=''; sample_size=0}
  try {
    $response = Invoke-WebRequest -Method Get -Uri $uri -UseBasicParsing -TimeoutSec $TimeoutSeconds -Headers @{'Cache-Control'='no-cache'}
    $row.status = [int]$response.StatusCode
    $body = [string]$response.Content
    $row.sample_size = $body.Length
    $row.pass = ($row.status -eq 200)
    if ($test.Name -eq 'mtg_home') { $row.pass = $row.pass -and ($body -notmatch 'FALLBACK') -and ($body -match 'mtg-search\.html') }
    if ($test.Name -eq 'mtg_search') { $row.pass = $row.pass -and ($body -match '/api/mtg/marketplace/listings') -and ($body -notmatch 'var SEED=') }
    if ($test.Name -eq 'mtg_list') { $row.pass = $row.pass -and ($body -match '/mtg-marketplace\.html#list-card') }
    if ($test.Name -eq 'mtg_marketplace') { $row.pass = $row.pass -and ($body -match '/api/mtg/marketplace/listings') }
    if ($test.Name -eq 'mtg_catalog') {
      $catalog = $body | ConvertFrom-Json
      $row.pass = $row.pass -and ($catalog.silo -eq 'mtg') -and ($null -ne $catalog.products)
    }
    if ($test.Name -eq 'mtg_api') {
      $payload = $body | ConvertFrom-Json
      $row.pass = $row.pass -and ($payload.PSObject.Properties.Name -contains 'listings')
    }
    if (-not $row.pass) { $row.reason = 'HTTP response or current marketplace contract check failed.' }
  } catch {
    $row.reason = $_.Exception.Message
    if ($null -ne $_.Exception.Response) {
      try { $row.status = [int]$_.Exception.Response.StatusCode } catch {}
    }
  }
  $results += [pscustomobject]$row
}
$pass = (@($results | Where-Object { -not $_.pass }).Count -eq 0)
$report = [ordered]@{
  schema = 'BECK-MTG-LIVE-VERIFIER/v1'
  observed_utc = (Get-Date).ToUniversalTime().ToString('o')
  base_url = $BaseUrl
  status = if ($pass) { 'PASS_PUBLIC_READ_CONTRACT' } else { 'BLOCKED' }
  results = $results
  not_verified = @('Account login','Seller submission','Settled payment','Fulfilment','Physical inventory ownership')
}
$report | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath $proofPath -Encoding ASCII
$hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $proofPath).Hash.ToLowerInvariant()
Set-Content -LiteralPath ($proofPath + '.sha256') -Value $hash -Encoding ASCII
Write-Host ('STATUS: ' + $report.status)
Write-Host ('PROOF: ' + $proofPath)
Write-Host ('SHA256: ' + $hash)
if (-not $pass) { exit 1 }
exit 0
