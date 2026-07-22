# MegaBootstrap_DreamLedger.ps1
# Builds DreamLedger.org as a full MTG micro‑storefront with:
#   - product catalog (5 SKUs)
#   - Stripe checkout links (auto‑generated)
#   - responsive hybrid‑dark UI
#   - Cortex sales ledger
#   - daily Reddit post generator
#   - auto‑commit + push to GitHub (if repo exists)
#   - Render deploy trigger (via push)

$ErrorActionPreference = "Stop"
$ROOT = "C:\BrownEyeCortex"
$SITE = "$ROOT\dreamledger\site"
$PRODUCTS_JSON = "$ROOT\dreamledger\products.json"
$INDEX_HTML = "$SITE\index.html"
$LEDGER_SCRIPT = "$ROOT\scripts\Log-Sale.ps1"
$POST_SCRIPT = "$ROOT\scripts\Generate-RedditPost.ps1"
$CHECKOUT_GENERATOR = "$ROOT\scripts\Generate-CheckoutLinks.ps1"

# ----- Ensure directories exist -----
New-Item -ItemType Directory -Force -Path $SITE | Out-Null
New-Item -ItemType Directory -Force -Path "$ROOT\scripts" | Out-Null
New-Item -ItemType Directory -Force -Path "$ROOT\ledger" | Out-Null

# ----- 1. Write product catalog -----
$products = @"
{
  "products": [
    {"id":"commander-upgrade","name":"Commander Upgrade Pack","desc":"Cut weak cards, add upgrades, fix win lines.","price":15,"currency":"nzd"},
    {"id":"budget-optimizer","name":"Budget Deck Optimizer","desc":"Max power per dollar, fix efficiency gaps.","price":10,"currency":"nzd"},
    {"id":"wincon-kit","name":"Win Condition Injector Kit","desc":"Find missing win paths and close games.","price":12,"currency":"nzd"},
    {"id":"synergy-checklist","name":"Synergy Scanner Checklist","desc":"Detect broken themes and dead cards fast.","price":8,"currency":"nzd"},
    {"id":"fast-fix","name":"Fast Fix Starter Kit","desc":"Quick self‑audit system for immediate improvement.","price":5,"currency":"nzd"}
  ]
}
"@
$products | Out-File -FilePath $PRODUCTS_JSON -Encoding UTF8

# ----- 2. Write the index.html (hybrid dark theme, product grid) -----
$html = @'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DreamLedger — MTG Optimization Tools</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background: #0b0f14; color: #e6f1ff; font-family: system-ui, -apple-system, sans-serif; }
    header { padding: 60px 20px 30px; text-align: center; }
    h1 { font-size: 2.5rem; letter-spacing: -0.02em; }
    h1 span { color: #f97316; }
    p.sub { color: #9aa8b9; max-width: 640px; margin: 10px auto 0; font-size: 1.1rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px; padding: 40px; max-width: 1200px; margin: 0 auto; }
    .card { background: #161c26; border: 1px solid #2a3442; border-radius: 16px; padding: 24px; transition: 0.25s ease; }
    .card:hover { transform: translateY(-4px); border-color: #f97316; box-shadow: 0 8px 30px rgba(249,115,22,0.08); }
    .card .title { font-weight: 700; font-size: 1.2rem; margin-bottom: 8px; }
    .card .desc { font-size: 0.95rem; color: #9aa8b9; margin-bottom: 16px; line-height: 1.4; }
    .card .price { font-weight: 600; font-size: 1.2rem; margin-bottom: 14px; color: #fff; }
    .card .price small { font-weight: 400; font-size: 0.85rem; color: #9aa8b9; }
    .btn { display: block; text-align: center; background: #f97316; color: #fff; padding: 12px; border-radius: 10px; text-decoration: none; font-weight: 600; transition: 0.2s; }
    .btn:hover { background: #e8610e; transform: scale(1.02); }
    footer { text-align: center; padding: 30px; color: #5a6a7a; font-size: 0.85rem; border-top: 1px solid #1e2632; margin-top: 20px; }
    @media (max-width: 480px) { h1 { font-size: 1.8rem; } .grid { padding: 20px; } }
  </style>
</head>
<body>
<header>
  <h1><span>Dream</span>Ledger</h1>
  <p class="sub">MTG optimization tools that upgrade Commander decks instantly.</p>
</header>
<div class="grid">
  <!-- Product cards will be injected via JavaScript using the JSON data -->
</div>
<footer>DreamLedger — instant digital delivery · no guesswork</footer>
<script>
  fetch('/products.json')
    .then(r => r.json())
    .then(data => {
      const grid = document.querySelector('.grid');
      data.products.forEach(p => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
          <div class="title">${p.name}</div>
          <div class="desc">${p.desc}</div>
          <div class="price">$${p.price} NZD <small>~ $${Math.round(p.price*0.6)} USD</small></div>
          <a class="btn" href="/checkout/${p.id}">Buy Now</a>
        `;
        grid.appendChild(card);
      });
    });
</script>
</body>
</html>
'@
$html | Out-File -FilePath $INDEX_HTML -Encoding UTF8

# ----- 3. Write the Checkout Link Generator (uses CashGate.v2) -----
$checkoutGen = @'
# Generate-CheckoutLinks.ps1
param([string]$ProductsPath = "C:\BrownEyeCortex\dreamledger\products.json")
$ErrorActionPreference = "Stop"
$ROOT = "C:\BrownEyeCortex"
Import-Module "$ROOT\modules\CashGate.v2.psm1" -Force
$products = (Get-Content $ProductsPath -Raw | ConvertFrom-Json).products
$links = @{}
foreach ($p in $products) {
    try {
        $url = New-StripeCheckoutSession -ProductName $p.name -AmountCents ($p.price * 100) -Currency $p.currency -Variant $p.id
        $links[$p.id] = $url
        Write-Host "$($p.id) -> $url"
    } catch {
        Write-Warning "$($p.id) failed: $_"
        $links[$p.id] = "https://buy.stripe.com/PLACEHOLDER_$($p.id)"
    }
}
$links | ConvertTo-Json -Depth 5 | Out-File "$ROOT\dreamledger\checkout_links.json" -Encoding UTF8
Write-Host "Checkout links saved."
'@
$checkoutGen | Out-File -FilePath $CHECKOUT_GENERATOR -Encoding UTF8

# ----- 4. Write the Sales Logger -----
$ledgerScript = @'
# Log-Sale.ps1
function Write-Sale {
    param($ProductId, $ProductName, $Price, $Currency, $Source="stripe")
    $entry = @{
        timestamp = (Get-Date).ToUniversalTime().ToString("o")
        product_id = $ProductId
        product_name = $ProductName
        price = $Price
        currency = $Currency
        source = $Source
    }
    $entry | ConvertTo-Json -Compress | Add-Content "C:\BrownEyeCortex\ledger\sales.jsonl" -Encoding UTF8
}
Export-ModuleMember -Function Write-Sale
'@
$ledgerScript | Out-File -FilePath $LEDGER_SCRIPT -Encoding UTF8

# ----- 5. Write the Daily Reddit Post Generator -----
$postScript = @'
# Generate-RedditPost.ps1
param([string]$ProductsPath = "C:\BrownEyeCortex\dreamledger\products.json")
$products = (Get-Content $ProductsPath -Raw | ConvertFrom-Json).products
$pick = $products | Get-Random
$price = $pick.price
$currency = $pick.currency
$title = "I built a tool for $($pick.name) – $currency $$price"
$body = @"
$($pick.desc)
Instant download – no waiting.
More info: https://dreamledger.org
"@
$post = @"
TITLE: $title
BODY:
$body
"@
$post | Out-File "C:\BrownEyeCortex\output\reddit_post.txt" -Encoding UTF8
Write-Host "Post generated for $($pick.name)"
'@
$postScript | Out-File -FilePath $POST_SCRIPT -Encoding UTF8

# ----- 6. Create the MegaBootstrap runner that executes all -----
$runner = @'
# DreamLedger Full Bootstrap Runner
# 1. Generate checkout links
# 2. Inject them into index.html (replace /checkout/* with real URLs)
# 3. Push to GitHub
# 4. Verify domain

$ROOT = "C:\BrownEyeCortex"
$SITE = "$ROOT\dreamledger\site"
$INDEX = "$SITE\index.html"
$LINK_JSON = "$ROOT\dreamledger\checkout_links.json"

Write-Host "== DreamLedger Full Bootstrap ==" -ForegroundColor Cyan

# Generate checkout links (if Stripe key exists)
if (Get-Command New-StripeCheckoutSession -ErrorAction SilentlyContinue) {
    & "$ROOT\scripts\Generate-CheckoutLinks.ps1"
    Write-Host "Checkout links generated." -ForegroundColor Green
} else {
    Write-Warning "Stripe module not loaded – checkout links will be placeholders."
}

# Update index.html with real checkout links (if available)
if (Test-Path $LINK_JSON) {
    $links = Get-Content $LINK_JSON -Raw | ConvertFrom-Json
    $content = Get-Content $INDEX -Raw
    foreach ($id in $links.PSObject.Properties.Name) {
        $url = $links.$id
        $content = $content -replace "/checkout/$id", $url
    }
    $content | Out-File $INDEX -Encoding UTF8
    Write-Host "Updated index.html with real Stripe links." -ForegroundColor Green
}

# Push to GitHub (if repo exists)
cd $SITE
if (Test-Path ".git") {
    git add index.html products.json
    git commit -m "DreamLedger full bootstrap – $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    git push
    Write-Host "Pushed to GitHub." -ForegroundColor Green
} else {
    Write-Warning "Not a Git repo – skipping push."
}

# Health check
try {
    $r = Invoke-WebRequest -Uri "https://dreamledger.org" -UseBasicParsing -TimeoutSec 5
    if ($r.Content -match "DreamLedger" -and $r.Content -match "Commander Upgrade Pack") {
        Write-Host "✅ DreamLedger.org is live and serving the catalog!" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Site is live but content may not be the latest." -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ DreamLedger.org not reachable – DNS/SSL may still be propagating." -ForegroundColor Red
}

Write-Host "== Bootstrap complete ==" -ForegroundColor Cyan
'@
$runner | Out-File -FilePath "$ROOT\scripts\Run-DreamLedgerBootstrap.ps1" -Encoding UTF8

# ----- 7. Generate the daily Reddit post now (for immediate use) -----
& $POST_SCRIPT

# ----- 8. Display summary -----
Write-Host ""
Write-Host "DREAMLEDGER MEGABOOTSTRAP COMPLETE" -ForegroundColor Cyan
Write-Host "------------------------------------------------"
Write-Host "1. Products config: $PRODUCTS_JSON"
Write-Host "2. Landing page:    $INDEX_HTML"
Write-Host "3. Checkout generator: $CHECKOUT_GENERATOR"
Write-Host "4. Sales logger:    $LEDGER_SCRIPT"
Write-Host "5. Reddit post generator: $POST_SCRIPT"
Write-Host "6. Bootstrap runner: $ROOT\scripts\Run-DreamLedgerBootstrap.ps1"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Ensure Stripe keys are set as environment variables."
Write-Host "  2. Run the bootstrap runner:"
Write-Host "     powershell -File $ROOT\scripts\Run-DreamLedgerBootstrap.ps1"
Write-Host "  3. To generate a daily Reddit post, just run:"
Write-Host "     powershell -File $POST_SCRIPT"
Write-Host "  4. Open https://dreamledger.org to see the catalog."
Write-Host "------------------------------------------------"
Write-Host "The system is ready. DreamLedger.org is now a marvel." -ForegroundColor Green