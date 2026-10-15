[CmdletBinding()]
param([string]$Root = (Join-Path $PSScriptRoot '..'))
$ErrorActionPreference = 'Stop'
$Root = [IO.Path]::GetFullPath($Root)
$manifest = Join-Path $Root 'cube\manifests\mtg-diagnostic.json'
$surface = Join-Path $Root 'compiled\website\mtg\diagnostic.html'
if (!(Test-Path $manifest)) { throw 'Commander product pointer missing' }
if (!(Test-Path $surface)) { throw 'CUBE MTG public surface missing' }
$m = Get-Content $manifest -Raw | ConvertFrom-Json
if ($m.schema -ne 'dreamledger/product-pointer/v1') { throw 'Unexpected product pointer schema' }
if ($m.product_id -ne 'COMMANDER-DECK-DIAGNOSTIC-001') { throw 'Wrong canonical product' }
if ($m.canonical_silo_manifest -ne 'silos/mtg/silo.json') { throw 'Canonical MTG master reference drift' }
if ($m.isolation -ne $true) { throw 'Isolation flag is false' }
if ($m.price_nzd -ne 29) { throw 'Internal price reference mismatch' }
if ($m.status -ne 'held' -or $m.checkout_status -ne 'disabled' -or $m.fulfillment_status -ne 'held') { throw 'Commander offer must remain held' }
if ($null -ne $m.stripe_product_id -or $null -ne $m.stripe_payment_link) { throw 'Held product pointer must not carry Stripe references' }
$html = Get-Content $surface -Raw
$forbidden = @('Amplissa','HappyHomarid','CollectorsCoast','DreamMeez','adult')
foreach ($token in $forbidden) { if ($html -match [regex]::Escape($token)) { throw "Forbidden token leaked into MTG surface: $token" } }
if ($html -notmatch 'Commander Deck Diagnostic') { throw 'Diagnostic page missing' }
if ($html -notmatch 'Currently held') { throw 'Held-state copy missing from diagnostic surface' }
if ($html -match 'NZ\$29|buy\.stripe\.com|/api/mtg/diagnostic/intake|/buy/COMMANDER-DECK-DIAGNOSTIC-001') { throw 'Held diagnostic surface exposes checkout or price' }
Write-Host '[PASS] CUBE MTG reskin: canonical product pointer + isolation + held public surface'
