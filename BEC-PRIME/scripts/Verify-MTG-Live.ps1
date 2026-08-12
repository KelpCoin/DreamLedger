#requires -Version 5.1
[CmdletBinding()]
param([string]$BaseUrl='https://dreamledger.org')
$ErrorActionPreference='Stop'
$base=$BaseUrl.TrimEnd('/')
$p=Invoke-WebRequest -Uri ($base+'/commander-diagnostic.html') -UseBasicParsing -TimeoutSec 20
if($p.StatusCode -ne 200){throw "Sales page failed: HTTP $($p.StatusCode)"}
if($p.Content -notmatch 'NZD \$25'){throw 'Price mismatch: NZD $25 not found.'}
if($p.Content -notmatch 'COMMANDER-DECK-DIAGNOSTIC-001'){throw 'Canonical product ID missing from checkout wiring.'}
$api=Invoke-WebRequest -Uri ($base+'/api/marketplace?silo=mtg') -UseBasicParsing -TimeoutSec 20
if($api.StatusCode -ne 200){throw "Marketplace API failed: HTTP $($api.StatusCode)"}
$data=$api.Content|ConvertFrom-Json
$mtg=@($data.products|Where-Object{$_.id -eq 'COMMANDER-DECK-DIAGNOSTIC-001'})|Select-Object -First 1
if(-not $mtg){throw 'Canonical MTG product is not visible in the published marketplace.'}
if(-not $mtg.checkout_available){throw 'Product is published but checkout_available=false. Payment rail is not ready.'}
if([decimal]$mtg.price -ne 25){throw "Marketplace price is $($mtg.price), expected 25."}
$proof=[ordered]@{status='PASS';timestamp_utc=(Get-Date).ToUniversalTime().ToString('o');sales_page=$base+'/commander-diagnostic.html';product_id=$mtg.id;price_nzd=$mtg.price;checkout_available=$mtg.checkout_available;verified_revenue_nzd=0;payment_proof_required=$true}
$dir='D:\BrownEyeCortex\Proof\Fossils';New-Item -ItemType Directory -Force -Path $dir|Out-Null
$file=Join-Path $dir ('MTG-LIVE-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.json')
$proof|ConvertTo-Json -Depth 10|Set-Content -Encoding UTF8 $file
Write-Host "PASS: MTG live surface verified. Revenue remains NZD 0 until a real payment clears. Proof: $file"
