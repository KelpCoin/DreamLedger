Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$key = $env:STRIPE_SECRET_KEY
if (-not $key) { throw "STRIPE_SECRET_KEY missing" }
$auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${key}:"))
function Invoke-Stripe($m,$e,$b) {
    Invoke-RestMethod -Uri "https://api.stripe.com/v1/$e" -Method $m -Headers @{Authorization="Basic $auth"} -ContentType "application/x-www-form-urlencoded" -Body $b
}
$staged = "D:\distro-tumblr\state\staged_records.json"
$storeDir = "D:\distro-tumblr\store"
$linkLog = "$storeDir\stripe_links.json"
New-Item -ItemType Directory -Force -Path $storeDir | Out-Null
$data = Get-Content $staged -Raw | ConvertFrom-Json
$approved = $data | Where-Object route -eq 'APPROVED'
$links = @{}
if (Test-Path $linkLog) { $links = Get-Content $linkLog -Raw | ConvertFrom-Json }
$items = @()
foreach ($i in $approved) {
    $id = $i.item_id
    $title = $i.title_candidate
    $summary = $i.caption_short
    if ($links.ContainsKey($id)) {
        $items += [pscustomobject]@{Title=$title;Summary=$summary;Link=$links[$id].url}
        continue
    }
    Write-Host "Provisioning Stripe product for $id..."
    $prod  = Invoke-Stripe POST "products" "name=$([uri]::EscapeDataString($title))&metadata[item_id]=$id"
    $price = Invoke-Stripe POST "prices" "product=$($prod.id)&unit_amount=500&currency=usd"
    $link  = Invoke-Stripe POST "payment_links" "line_items[0][price]=$($price.id)&line_items[0][quantity]=1"
    $links[$id] = @{url=$link.url;product=$prod.id;price=$price.id;utc=(Get-Date -Format o)}
    $items += [pscustomobject]@{Title=$title;Summary=$summary;Link=$link.url}
}
$links | ConvertTo-Json -Depth 5 | Out-File $linkLog -Encoding ascii

# Build store HTML
$html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>DreamLedger Store</title><style>body{font-family:sans-serif;background:#0b0b0b;color:#e0e0e0;max-width:800px;margin:2rem auto}.card{background:#1a1a1a;border:1px solid #333;padding:1.2rem;margin-bottom:1.5rem;border-radius:8px}.card h2{color:#ffd966}.card p{color:#aaa}.buy{display:inline-block;background:#ffd966;color:#0b0b0b;font-weight:bold;padding:0.6rem 1.2rem;text-decoration:none;border-radius:6px}</style></head><body><h1 style="color:#ffd966">ðŸŽ´ DreamLedger Tumblr Packs</h1><p>Instant delivery. Secure checkout via Stripe.</p>'
foreach ($it in $items) {
    $html += "<div class='card'><h2>$($it.Title)</h2><p>$($it.Summary)</p><a class='buy' href='$($it.Link)'>Buy Now - $5.00</a></div>"
}
$html += '<p style="margin-top:2rem;color:#555">Powered by BrownEye Cortex. <a href="https://dreamledger.org">DreamLedger</a></p></body></html>'
[System.IO.File]::WriteAllText("$storeDir\store.html", $html, [System.Text.Encoding]::UTF8)
Write-Host "Store updated with $($items.Count) products."
