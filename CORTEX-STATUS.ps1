#Requires -Version 5.1
$ROOT = 'C:\BrownEyeCortex'
Write-Host ""
Write-Host "" -ForegroundColor Cyan
Write-Host "           BROWN EYE CORTEX  STATUS CHECK           " -ForegroundColor Cyan
Write-Host "" -ForegroundColor Cyan
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') UTC" -ForegroundColor DarkGray
Write-Host ""

function Show-Check { param([string]$Label, [bool]$OK, [string]$Detail = '')
    $icon = if ($OK) { "" } else { "" }
    $col  = if ($OK) { "Green" } else { "Red" }
    Write-Host "  $icon $Label" -ForegroundColor $col -NoNewline
    if ($Detail) { Write-Host "  $Detail" -ForegroundColor DarkGray } else { Write-Host "" }
}

# State
$state = $null
if (Test-Path "$ROOT\data\state.json") {
    $state = Get-Content "$ROOT\data\state.json" -Raw | ConvertFrom-Json -ErrorAction SilentlyContinue
}
Show-Check "state.json"           ($null -ne $state) (if ($state) { "phase=$($state.market_phase) sales=$($state.sales_count) revenue=NZD$$($state.revenue_nzd)" } else { "MISSING" })
Show-Check "Intelligence layer"   ($null -ne $state -and $state.intelligence_layer -eq 'active') (if ($state) { $state.intelligence_layer } else { "unknown" })

# Registry
$registry = @()
if (Test-Path "$ROOT\data\registry.json") {
    $raw = Get-Content "$ROOT\data\registry.json" -Raw -ErrorAction SilentlyContinue
    if ($raw) { $registry = @($raw | ConvertFrom-Json -ErrorAction SilentlyContinue) }
}
$withLinks = @($registry | Where-Object { $_.stripe_link -and $_.stripe_link -ne '' })
Show-Check "Registry"             ($registry.Count -gt 0) "$($registry.Count) SKUs, $($withLinks.Count) with Stripe links"

# Ledger
$ledgerSize = (Get-Item "$ROOT\ledger\event.log" -ErrorAction SilentlyContinue).Length
Show-Check "Event ledger"         ($ledgerSize -gt 0) "$ledgerSize bytes"

# Store HTML
$storeExists = Test-Path "$ROOT\output\store.html"
$storeAge    = if ($storeExists) { [Math]::Round(((Get-Date) - (Get-Item "$ROOT\output\store.html").LastWriteTime).TotalHours, 1) } else { -1 }
Show-Check "Store HTML"           $storeExists (if ($storeExists) { "last built ${storeAge}h ago" } else { "NOT BUILT" })

# Repo
$repoExists = Test-Path "C:\mtg-furnace-render\public\store.html"
Show-Check "Repo store.html"      $repoExists

# GitHub Pages
try {
    $r = Invoke-WebRequest -Uri "https://kelpcoin.github.io/mtg-furnace-render/store.html" -UseBasicParsing -TimeoutSec 8 -ErrorAction Stop
    Show-Check "GitHub Pages"     ($r.StatusCode -eq 200) "HTTP $($r.StatusCode)"
} catch {
    Show-Check "GitHub Pages"     $false $_.Exception.Message
}

# Custom domain
try {
    $r2 = Invoke-WebRequest -Uri "https://dreamledger.org/store.html" -UseBasicParsing -TimeoutSec 8 -ErrorAction Stop
    Show-Check "dreamledger.org"  ($r2.StatusCode -eq 200) "HTTP $($r2.StatusCode)  LIVE"
} catch {
    Show-Check "dreamledger.org"  $false "HTTP error  check GitHub Pages folder setting"
}

# Stripe
$stripeKey = $env:STRIPE_SECRET_KEY
Show-Check "STRIPE_SECRET_KEY"    (-not [string]::IsNullOrEmpty($stripeKey)) (if ($stripeKey) { $stripeKey.Substring(0,8) + '...' } else { "NOT SET" })

# Intelligence files
Show-Check "Gauntlet metrics"     (Test-Path "$ROOT\intelligence\gauntlet-v6\metrics_report.json")
Show-Check "Elohim proposals"     (Test-Path "$ROOT\intelligence\elohim-v6\proposals.json")
Show-Check "Supervisor applied"   (Test-Path "$ROOT\intelligence\supervisor-v6\applied.json")

# First sale latch
Show-Check "First sale triggered" (Test-Path "$ROOT\signals\flags\FIRST_SALE_TRIGGERED.flag") (if (Test-Path "$ROOT\signals\flags\FIRST_SALE_TRIGGERED.flag") { Get-Content "$ROOT\signals\flags\FIRST_SALE_TRIGGERED.flag" } else { "not yet" })

Write-Host ""
Write-Host "COMMANDS:" -ForegroundColor Yellow
Write-Host "  Drop deck file  run Update-Store.ps1"
Write-Host "  Log a sale:       .\Log-Sale.ps1 -sku_id 'edh-x' -amount_nzd_cents 8500"
Write-Host "  Run intelligence: .\RUN-INTELLIGENCE.ps1"
Write-Host "  Full rebuild:     .\Update-Store.ps1"
Write-Host ""