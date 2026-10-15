[CmdletBinding()]
param([string]$Root = (Join-Path $PSScriptRoot '..'))
$ErrorActionPreference = 'Stop'
$Root = [IO.Path]::GetFullPath($Root)
$manifest = Join-Path $Root 'cube\manifests\mtg-diagnostic.json'
$surface = Join-Path $Root 'compiled\website\mtg\diagnostic.html'
if (!(Test-Path $manifest)) { throw 'CUBE MTG manifest missing' }
if (!(Test-Path $surface)) { throw 'CUBE MTG public surface missing' }
$m = Get-Content $manifest -Raw | ConvertFrom-Json
if ($m.silo_name -ne 'mtg') { throw 'Wrong silo' }
if ($m.isolation -ne $true) { throw 'Isolation flag is false' }
if ($m.status -ne 'deployed') { throw 'CUBE diagnostic status page is not compiled' }
if ($m.sale_status -ne 'held') { throw 'CUBE manifest must mark Commander diagnostic as held' }
if ($m.checkout_enabled -ne $false) { throw 'Held CUBE diagnostic must not enable checkout' }
if ($m.price_nzd -ne 29) { throw 'Reference price mismatch' }
$html = Get-Content $surface -Raw
$forbidden = @('Amplissa','HappyHomarid','CollectorsCoast','DreamMeez','adult')
foreach ($token in $forbidden) { if ($html -match [regex]::Escape($token)) { throw "Forbidden token leaked into MTG surface: $token" } }
if ($html -notmatch 'Commander Deck Diagnostic') { throw 'Diagnostic missing from MTG surface' }
if ($html -notmatch 'Currently held') { throw 'Held status missing from MTG surface' }
if ($html -notmatch 'not available for purchase') { throw 'Unavailable-for-purchase statement missing from MTG surface' }
if ($html -match 'NZ\$29') { throw 'Held diagnostic must not display an active sales price' }
if ($html -match '/api/mtg/diagnostic/intake') { throw 'Held diagnostic must not expose the checkout-intake route' }
if ($html -match 'buy\.stripe\.com') { throw 'Held diagnostic must not expose a direct Stripe link' }
Write-Host '[PASS] CUBE MTG reskin: compiled status page + isolation + held commerce state'
