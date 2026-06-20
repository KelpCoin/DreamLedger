param(
    [string]$ProductName = "DreamLedger Starter Pack",
    [string]$Description = "Instant digital delivery. Test offer.",
    [int]$PriceCents = 100,
    [string]$SkuId = "starter-pack",
    [string]$RepoPath = "C:\mtg-furnace-render",
    [string]$OutputDir = "C:\BrownEyeCortex\output"
)
$STRIPE_KEY = $env:STRIPE_SECRET_KEY
$product = Invoke-RestMethod -Uri 'https://api.stripe.com/v1/products' -Method Post -Headers @{ Authorization = "Bearer $STRIPE_KEY" } -Body "name=$ProductName&metadata[sku_id]=$SkuId" -ContentType 'application/x-www-form-urlencoded'
$price = Invoke-RestMethod -Uri 'https://api.stripe.com/v1/prices' -Method Post -Headers @{ Authorization = "Bearer $STRIPE_KEY" } -Body "unit_amount=$PriceCents&currency=nzd&product=$($product.id)" -ContentType 'application/x-www-form-urlencoded'
$checkout = Invoke-RestMethod -Uri 'https://api.stripe.com/v1/payment_links' -Method Post -Headers @{ Authorization = "Bearer $STRIPE_KEY" } -Body "line_items[0][price]=$($price.id)&line_items[0][quantity]=1" -ContentType 'application/x-www-form-urlencoded'
$paymentLink = $checkout.url
Write-Host "Payment link: $paymentLink"
$html = "<!DOCTYPE html><html><head><meta charset='UTF-8'><title>$ProductName</title><style>body{font-family:system-ui,sans-serif;background:#0a0a0a;color:#eee;text-align:center;padding:3rem}h1{color:#ffd966}.price{font-size:2rem;color:#4caf50}a{display:inline-block;margin-top:1rem;background:#ffd966;color:#000;padding:1rem 2rem;border-radius:8px;text-decoration:none;font-weight:700}</style></head><body><h1>$ProductName</h1><p>$Description</p><p class='price'>NZD $([Math]::Round($PriceCents/100,2))</p><a href='$paymentLink'>Buy Now  Instant Delivery</a></body></html>"
$html | Set-Content "$OutputDir\minimal-store.html" -Encoding UTF8
if (Test-Path $RepoPath) { Copy-Item "$OutputDir\minimal-store.html" "$RepoPath\index.html" -Force; Push-Location $RepoPath; git add -A; git commit -m "first sale launch"; git push origin main; Pop-Location }
Write-Host "Deployed. Store: https://dreamledger.org"
