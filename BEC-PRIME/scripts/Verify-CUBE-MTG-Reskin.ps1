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
if ($m.status -ne 'deployed') { throw 'CUBE manifest is not deployed' }
if ($m.price_nzd -ne 29) { throw 'Price mismatch' }
$html = Get-Content $surface -Raw
$forbidden = @('Amplissa','HappyHomarid','CollectorsCoast','DreamMeez','adult')
foreach ($token in $forbidden) { if ($html -match [regex]::Escape($token)) { throw "Forbidden token leaked into MTG surface: $token" } }
if ($html -notmatch 'Commander Deck Diagnostic') { throw 'Diagnostic missing from MTG surface' }
if ($html -notmatch 'Currently held') { throw 'Held status missing from MTG diagnostic surface' }
if ($html -notmatch 'not available for purchase') { throw 'Held purchase state missing from MTG diagnostic surface' }
if ($html -notmatch '<button[^>]+disabled') { throw 'Held checkout control must be present and disabled' }
if ($html -match 'buy\.stripe\.com|checkout\.stripe\.com|/api/mtg/diagnostic/intake') { throw 'Held diagnostic surface exposes checkout' }
Write-Host '[PASS] CUBE MTG reskin: manifest + isolation + visible hold + no checkout bypass'
