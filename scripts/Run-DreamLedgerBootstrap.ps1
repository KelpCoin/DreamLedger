# DreamLedger Full Bootstrap Runner (corrected)
# 1. Generate checkout links (if Stripe module available)
# 2. Inject them into index.html
# 3. Push to GitHub from the site folder
# 4. Verify domain

$ROOT = "C:\BrownEyeCortex"
$SITE = "$ROOT\dreamledger\site"
$INDEX = "$SITE\index.html"
$LINK_JSON = "$ROOT\dreamledger\checkout_links.json"
$GENERATOR = "$ROOT\scripts\Generate-CheckoutLinks.ps1"

Write-Host "== DreamLedger Full Bootstrap ==" -ForegroundColor Cyan

# Generate checkout links (if Stripe key exists)
if (Get-Command New-StripeCheckoutSession -ErrorAction SilentlyContinue) {
    & $GENERATOR
    Write-Host "Checkout links generated." -ForegroundColor Green
} else {
    Write-Warning "Stripe module not loaded - checkout links will be placeholders."
    # Still run generator to create placeholders
    & $GENERATOR
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

# Push to GitHub from the site directory
cd $SITE
if (Test-Path ".git") {
    git add index.html products.json
    git commit -m "DreamLedger full bootstrap  $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    git push
    Write-Host "Pushed to GitHub." -ForegroundColor Green
} else {
    Write-Warning "Not a Git repo  skipping push."
}

# Health check
try {
    $r = Invoke-WebRequest -Uri "https://dreamledger.org" -UseBasicParsing -TimeoutSec 5
    if ($r.Content -match "DreamLedger" -and $r.Content -match "Commander Upgrade Pack") {
        Write-Host " DreamLedger.org is live and serving the catalog!" -ForegroundColor Green
    } else {
        Write-Host " Site is live but content may not be the latest." -ForegroundColor Yellow
    }
} catch {
    Write-Host " DreamLedger.org not reachable  DNS/SSL may still be propagating." -ForegroundColor Red
}

Write-Host "== Bootstrap complete ==" -ForegroundColor Cyan
