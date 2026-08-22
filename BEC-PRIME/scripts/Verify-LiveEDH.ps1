$ErrorActionPreference = 'Stop'
$Base = 'https://dreamledger.org'
$ExpectedProduct = 'BESPOKE-ARTISAN-EDH-DECK-001'
$ExpectedPrice = 'NZ$385'
$ExpectedLink = 'https://buy.stripe.com/fZuaEX3vn15r4Q74kAdwc1S'

function Get-Page([string]$Url) {
    try {
        $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 20 -ErrorAction Stop
        return [pscustomobject]@{ Code = [int]$r.StatusCode; Body = [string]$r.Content }
    } catch {
        return [pscustomobject]@{ Code = 0; Body = '' }
    }
}

$root = Get-Page $Base
$mtg = Get-Page "$Base/mtg"
$health = Get-Page "$Base/healthz"

$rootHasOffer = $root.Body -like "*$ExpectedProduct*" -or ($root.Body -like "*Bespoke Artisan EDH Commander Deck*" -and $root.Body -like "*$ExpectedPrice*" -and $root.Body -like "*$ExpectedLink*")
$mtgHasOffer = $mtg.Body -like '*Bespoke Artisan EDH Commander Deck*' -and $mtg.Body -like "*$ExpectedPrice*" -and $mtg.Body -like "*$ExpectedLink*"

Write-Host "ROOT   = $($root.Code)"
Write-Host "MTG    = $($mtg.Code)"
Write-Host "HEALTH = $($health.Code)"
Write-Host "ROOT_OFFER = $rootHasOffer"
Write-Host "MTG_OFFER  = $mtgHasOffer"

if ($root.Code -ne 200 -or $mtg.Code -ne 200 -or $health.Code -ne 200 -or -not $rootHasOffer -or -not $mtgHasOffer) {
    Write-Host 'LIVE_EDH_VERIFY_FAIL' -ForegroundColor Red
    exit 1
}

Write-Host 'LIVE_EDH_VERIFY_PASS: NZ$385 EDH offer is visible on the production website and points at the live Stripe payment link.' -ForegroundColor Green
exit 0
