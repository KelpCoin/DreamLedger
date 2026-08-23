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
if ($html -notmatch 'NZ\$29') { throw 'Price missing from MTG surface' }
if ($html -notmatch '/api/mtg/diagnostic/intake') { throw 'Automated checkout route missing' }
Write-Host '[PASS] CUBE MTG reskin: manifest + isolation + public surface + automated checkout route'
