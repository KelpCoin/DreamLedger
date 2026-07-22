Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$stripeKey = $env:STRIPE_SECRET_KEY
$supaUrl   = $env:SUPABASE_URL
$supaKey   = $env:SUPABASE_SERVICE_KEY
if (-not $stripeKey) { Write-Error "STRIPE_SECRET_KEY missing"; exit 1 }
if (-not $supaUrl)   { Write-Error "SUPABASE_URL missing"; exit 1 }
if (-not $supaKey)   { Write-Error "SUPABASE_SERVICE_KEY missing"; exit 1 }
$auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${stripeKey}:"))
function Stripe-Get($ep,$qs="") {
    $uri = "https://api.stripe.com/v1/$ep" + $(if ($qs) { "?$qs" } else { "" })
    Invoke-RestMethod -Uri $uri -Headers @{Authorization="Basic $auth"} -ContentType "application/x-www-form-urlencoded"
}
function Stripe-Post($ep,$body) {
    Invoke-RestMethod -Uri "https://api.stripe.com/v1/$ep" -Method POST -Headers @{Authorization="Basic $auth"} -ContentType "application/x-www-form-urlencoded" -Body $body
}
Write-Host "Fetching Stripe products with SKU metadata..."
$products = @()
$hasMore = $true
$startingAfter = $null
while ($hasMore) {
    $params = "active=true&limit=100"
    if ($startingAfter) { $params += "&starting_after=$startingAfter" }
    $res = Stripe-Get "products" $params
    $products += $res.data | Where-Object { $_.metadata -and $_.metadata.PSObject.Properties['sku_id'] }
    $hasMore = $res.has_more
    if ($hasMore -and $res.data.Count -gt 0) { $startingAfter = $res.data[-1].id } else { break }
}
Write-Host "Products with SKU metadata: $($products.Count)"
$productMap = @{}
foreach ($prod in $products) {
    $skuId = $prod.metadata.sku_id
    $prices = Stripe-Get "prices" "product=$($prod.id)&active=true&limit=1"
    if (-not $prices.data -or $prices.data.Count -eq 0) { continue }
    $priceId = $prices.data[0].id
    Write-Host "Creating payment link for $skuId..."
    $linkRes = Stripe-Post "payment_links" "line_items[0][price]=$priceId&line_items[0][quantity]=1"
    $productMap[$prod.id] = @{ sku_id = $skuId; name = $prod.name; payment_link = $linkRes.url }
}
Write-Host "Reading purchase events from Supabase..."
$headers = @{ apikey = $supaKey; Authorization = "Bearer $supaKey" }
$uri = "$supaUrl/rest/v1/cortex_events?event_type=eq.payment_received&select=*"
try { $events = Invoke-RestMethod -Uri $uri -Headers $headers -Method Get } catch { $events = @() }
Write-Host "Purchase events found: $($events.Count)"
$skuSales = @{}
foreach ($evt in $events) {
    $payload = $evt.payload
    if (-not $payload -or -not $payload.line_items) { continue }
    $lineItems = $payload.line_items.data
    foreach ($item in $lineItems) {
        $productId = $item.price.product
        if ($productMap.ContainsKey($productId)) {
            $skuId = $productMap[$productId].sku_id
            if ($skuSales.ContainsKey($skuId)) { $skuSales[$skuId]++ } else { $skuSales[$skuId] = 1 }
        }
    }
}
$storeItems = @(foreach ($prodId in $productMap.Keys) {
    $info = $productMap[$prodId]
    $sales = if ($skuSales.ContainsKey($info.sku_id)) { $skuSales[$info.sku_id] } else { 0 }
    [pscustomobject]@{ Title = $info.name; SkuId = $info.sku_id; Link = $info.payment_link; Sales = $sales }
})
if ($storeItems.Count -eq 0) {
    Write-Warning "No products. Placeholder added."
    $storeItems = @([pscustomobject]@{ Title = "No products yet"; SkuId = ""; Link = "#"; Sales = 0 })
}
$storeItems = $storeItems | Sort-Object Sales -Descending

# ========== SAFE HTML RENDERER (NO $5 BUG) ==========
$cardsHtml = ""
foreach ($it in $storeItems) {
    $title = [System.Security.SecurityElement]::Escape($it.Title)
    $sales = [int]$it.Sales
    $link  = [System.Security.SecurityElement]::Escape($it.Link)
    $badge = if ($sales -gt 0) { " (Best Seller)" } else { "" }
    $cardsHtml += "<div class='card'><h2>$title$badge</h2><p>Sales: $sales</p><a class='buy' href='$link'>Buy Now - 5.00 USD</a></div>`r`n"
}
$html = @"
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>DreamLedger Store</title>
<style>
body{font-family:sans-serif;background:#0b0b0b;color:#e0e0e0;max-width:800px;margin:2rem auto}
.card{background:#1a1a1a;border:1px solid #333;padding:1.2rem;margin-bottom:1.5rem;border-radius:8px}
.card h2{color:#ffd966}
.card p{color:#aaa}
.buy{display:inline-block;background:#ffd966;color:#0b0b0b;font-weight:bold;padding:0.6rem 1.2rem;text-decoration:none;border-radius:6px}
</style>
</head>
<body>
<h1 style="color:#ffd966">DreamLedger Bestsellers</h1>
<p>Instant delivery. Secure checkout via Stripe.</p>
$cardsHtml
<p style="margin-top:2rem;color:#555">Powered by BrownEye Cortex. <a href="https://dreamledger.org">DreamLedger</a></p>
</body>
</html>
"@

$storePath = "D:\distro-tumblr\store\store.html"
[System.IO.File]::WriteAllText($storePath, $html, [System.Text.Encoding]::UTF8)
$publicDir = "C:\BrownEyeCortex\mtg-furnace-render\public"
New-Item -ItemType Directory -Force -Path $publicDir | Out-Null
Copy-Item $storePath "$publicDir\store.html" -Force
git -C "C:\BrownEyeCortex\mtg-furnace-render" add public/store.html
git -C "C:\BrownEyeCortex\mtg-furnace-render" commit -m "revenue loop: ranked store $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
git -C "C:\BrownEyeCortex\mtg-furnace-render" push origin main
Write-Host "=== DONE ==="
Write-Host "Top SKU: $($storeItems[0].Title) ($($storeItems[0].Sales) sales)"
Write-Host "Store: https://dreamledger.org/store.html"
