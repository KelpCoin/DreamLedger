[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)]
  [string]$DeckId,
  [string]$OutputRoot = "D:\BrownEyeCortex\distribution"
)

$ErrorActionPreference = "Stop"

if (-not $env:SUPABASE_URL) { throw "SUPABASE_URL is not set" }
if (-not $env:SUPABASE_ANON_KEY) { throw "SUPABASE_ANON_KEY is not set" }

$uri = "$($env:SUPABASE_URL)/rest/v1/mtg_decks?id=eq.$DeckId&select=*"
$headers = @{
  apikey = $env:SUPABASE_ANON_KEY
  Authorization = "Bearer $($env:SUPABASE_ANON_KEY)"
}

$rows = Invoke-RestMethod -Method Get -Uri $uri -Headers $headers
if (-not $rows -or $rows.Count -lt 1) { throw "DECK_NOT_FOUND: $DeckId" }
$d = $rows[0]

if ($d.status -ne "published") { throw "DECK_NOT_PUBLISHED: $DeckId status=$($d.status)" }

$deckDir = Join-Path $OutputRoot "DECK-$($d.id)"
New-Item -ItemType Directory -Force -Path $deckDir | Out-Null
$canonicalUrl = "https://dreamledger.org/mtg/deck/$($d.id)"

$facebook = @"
New Commander deck available: $($d.deck_name)
Commander: $($d.commander)
$($d.card_count) cards / $($d.unique_card_count) unique
Condition: $($d.condition)
Price: NZ$$([decimal]$d.price_nzd)

Deck: $canonicalUrl
"@

$patreon = @"
New Commander deck: $($d.deck_name)

Commander: $($d.commander)
Cards: $($d.card_count) / $($d.unique_card_count) unique
Condition: $($d.condition)
Price: NZ$$([decimal]$d.price_nzd)

Full listing: $canonicalUrl
"@

$reddit = @"
[SELLING] $($d.deck_name) | Commander: $($d.commander)

$($d.card_count) cards, $($d.condition), NZ$$([decimal]$d.price_nzd).
Full listing: $canonicalUrl
"@

$substack = @"
New deck listing: $($d.deck_name)

$($d.commander) Commander deck, $($d.card_count) cards, listed at NZ$$([decimal]$d.price_nzd).

Full listing: $canonicalUrl
"@

$facebook | Set-Content -LiteralPath (Join-Path $deckDir "facebook.txt") -Encoding UTF8
$patreon  | Set-Content -LiteralPath (Join-Path $deckDir "patreon.txt") -Encoding UTF8
$reddit   | Set-Content -LiteralPath (Join-Path $deckDir "reddit.txt") -Encoding UTF8
$substack | Set-Content -LiteralPath (Join-Path $deckDir "substack.txt") -Encoding UTF8

@{
  deck_id = [string]$d.id
  generated_at = (Get-Date).ToUniversalTime().ToString("o")
  canonical_url = $canonicalUrl
  channels = @("facebook","patreon","reddit","substack")
  external_publish = "NOT_PERFORMED"
} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $deckDir "manifest.json") -Encoding UTF8

Write-Output "DISTRIBUTION_PACK_GENERATED: $deckDir"
