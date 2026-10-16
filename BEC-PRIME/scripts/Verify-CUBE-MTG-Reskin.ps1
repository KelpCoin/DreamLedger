[CmdletBinding()]
param([string]$Root = (Join-Path $PSScriptRoot '..'))
$ErrorActionPreference = 'Stop'
$Root = [IO.Path]::GetFullPath($Root)
$manifest = Join-Path $Root 'cube\manifests\mtg-diagnostic.json'
$surface = Join-Path $Root 'compiled\website\mtg\diagnostic.html'
$digital = Join-Path $Root '..\digital-products.html'
if (!(Test-Path $manifest)) { throw 'CUBE MTG manifest missing' }
if (!(Test-Path $surface)) { throw 'CUBE MTG public surface missing' }
$m = Get-Content $manifest -Raw | ConvertFrom-Json
if ($m.silo_name -ne 'mtg') { throw 'Wrong silo' }
if ($m.isolation -ne $true) { throw 'Isolation flag is false' }
if ($m.status -ne 'held') { throw 'CUBE MTG diagnostic must remain held until evidence gates pass' }
if ($m.checkout_state -ne 'disabled') { throw 'CUBE MTG diagnostic checkout must remain disabled' }
if (!$m.hold_reason) { throw 'CUBE MTG hold reason is missing' }
if ($m.price_nzd -ne 29) { throw 'Price mismatch' }
$html = Get-Content $surface -Raw
$forbidden = @('Amplissa','HappyHomarid','CollectorsCoast','DreamMeez','adult')
foreach ($token in $forbidden) { if ($html -match [regex]::Escape($token)) { throw "Forbidden token leaked into MTG surface: $token" } }
if ($html -notmatch 'Commander Deck Diagnostic') { throw 'Diagnostic missing from MTG surface' }
if ($html -notmatch 'Currently held') { throw 'Held diagnostic status missing from MTG surface' }
if ($html -notmatch 'not available for purchase') { throw 'Public held notice missing from MTG surface' }
if ($html -match '/api/mtg/diagnostic/intake|buy\.stripe\.com|checkout\.stripe\.com|/buy/COMMANDER-DECK-DIAGNOSTIC-001') { throw 'Held diagnostic still exposes a checkout route' }
Write-Host '[PASS] CUBE MTG reskin: isolated manifest + held checkout + no direct payment bypass'
