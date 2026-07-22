# Update-Store.ps1  hardened production pipeline
param([string]$Root = 'C:\BrownEyeCortex')
$incoming    = "$Root\DeckDrops\incoming"
$archive     = "$Root\DeckDrops\archive"
$regPath     = "$Root\data\registry.json"
$outPath     = "$Root\output\store.html"
$repoPath    = 'C:\mtg-furnace-render'
$eventLog    = "$Root\ledger\event.log"
$lockFile    = "$Root\ledger\ledger.lock"
$deployFolder = 'public'

$registry = if (Test-Path $regPath) { Get-Content $regPath -Raw | ConvertFrom-Json -ErrorAction SilentlyContinue } else { @() }
if (-not $registry) { $registry = @() }

$added = 0
Get-ChildItem $incoming -File -ErrorAction SilentlyContinue | ? { $_.Extension -in '.csv','.txt','.json' } | % {
    $f = $_
    $base = $f.BaseName
    $priceCents = 8500
    $deckId = ($base -replace '_\d+$','').ToLower() -replace '\s+','-' -replace '[^a-z0-9-]',''
    if ($base -match '^(.+?)_(\d+)$') { $deckId = $Matches[1].ToLower() -replace '\s+','-'; $priceCents = [int]$Matches[2] }
    $skuId = 'edh-' + $deckId
    if ($registry | ? { $_.id -eq $skuId }) { Move-Item $f.FullName $archive -Force; return }
    $deckName = $base -replace '_\d+$','' -replace '-',' '
    $cardCount = 0
    try {
        switch ($f.Extension.ToLower()) {
            '.csv' { $rows = Import-Csv $f.FullName; $cardCount = ($rows | ? { $_.Name }).Count }
            '.txt' { $lines = Get-Content $f.FullName -Encoding UTF8; $cardCount = ($lines | ? { $_ -match '^\d+\s+' }).Count }
        }
    } catch {}
    $desc = if ($cardCount -gt 0) { "$cardCount-card Commander deck. Ships fast NZ-wide." } else { "Commander deck. Ready to play." }
    $stripeLink = ''
    $key = $env:STRIPE_SECRET_KEY
    if ($key) {
        try {
            $n = [Uri]::EscapeDataString($deckName)
            $prod  = Invoke-RestMethod -Uri 'https://api.stripe.com/v1/products' -Method Post -Headers @{Authorization="Bearer $key"} -Body "name=$n&metadata[sku_id]=$skuId" -ContentType 'application/x-www-form-urlencoded'
            $price = Invoke-RestMethod -Uri 'https://api.stripe.com/v1/prices' -Method Post -Headers @{Authorization="Bearer $key"} -Body "unit_amount=$priceCents&currency=nzd&product=$($prod.id)" -ContentType 'application/x-www-form-urlencoded'
            $link  = Invoke-RestMethod -Uri 'https://api.stripe.com/v1/payment_links' -Method Post -Headers @{Authorization="Bearer $key"} -Body "line_items[0][price]=$($price.id)&line_items[0][quantity]=1" -ContentType 'application/x-www-form-urlencoded'
            $stripeLink = $link.url
        } catch { Write-Warning "Stripe: $_" }
    }
    $sku = [PSCustomObject]@{ id=$skuId; name=$deckName; price_nzd=$priceCents; description=$desc; type='commander_deck'; stripe_link=$stripeLink; card_count=$cardCount; listed_utc=[DateTimeOffset]::UtcNow.ToString('o') }
    $registry += $sku
    $added++
    $ev = @{ event_id=[guid]::NewGuid().ToString(); event_type='inventory'; timestamp_utc=[DateTimeOffset]::UtcNow.ToString('o'); source='pipeline'; entity=@{sku_id=$skuId;type='sku'}; metrics=@{amount_nzd_cents=0;quantity=1}; flags=@{ignite=$false;test=$false} } | ConvertTo-Json -Compress
    while (Test-Path $lockFile) { Start-Sleep -Milliseconds 50 }
    New-Item -ItemType File -Path $lockFile -Force | Out-Null
    try { Add-Content $eventLog $ev -Encoding UTF8 } finally { Remove-Item $lockFile -Force -EA 0 }
    Move-Item $f.FullName $archive -Force
    Write-Host "Added: $skuId  $deckName  NZD $([math]::Round($priceCents/100,2))"
}

$registry | ConvertTo-Json -Depth 10 | Set-Content $regPath -Encoding UTF8

$cards = foreach ($sku in $registry) {
    $p = [math]::Round($sku.price_nzd / 100.0, 2)
    $l = if ($sku.stripe_link) { $sku.stripe_link } else { '#' }
    $btn = if ($l -ne '#') { "<a class='btn' href='$l'>Buy Now  NZD `$$p</a>" } else { '<span class="pending">Payment link pending</span>' }
    "<div class='card'><h2>$($sku.name)</h2><p>$($sku.description)</p>$btn</div>"
}
$updated = [DateTime]::UtcNow.ToString('yyyy-MM-dd HH:mm') + ' UTC'
$html = @"
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>DreamLedger  Commander Decks</title><meta name="description" content="Pre-built Commander decks. NZD pricing. Ready to play.">
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a0a;color:#e0e0e0;padding:2rem 1rem}.wrap{max-width:960px;margin:0 auto}h1{color:#ffd966;font-size:2rem;margin-bottom:.25rem}.sub{color:#666;margin-bottom:2rem}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem}.card{background:#141414;border:1px solid #222;border-radius:8px;padding:1.2rem}.card h2{color:#ffd966;font-size:1rem;margin-bottom:.5rem}.card p{color:#999;font-size:.85rem;line-height:1.5;margin-bottom:1rem}.btn{display:block;background:#ffd966;color:#000;text-align:center;padding:.6rem 1rem;border-radius:6px;text-decoration:none;font-weight:700;font-size:.9rem}.btn:hover{background:#ffe580}.pending{color:#555;font-size:.8rem}footer{text-align:center;color:#333;font-size:.75rem;padding:3rem 0 1rem}</style></head>
<body><div class="wrap"><h1>DreamLedger</h1><p class="sub">Commander decks. Ready to play. NZD pricing. Fast shipping NZ-wide.</p>
<div class="grid">$($cards -join "`n")</div>
<footer>Updated $updated  Secure checkout via Stripe  Questions? DM me.</footer></div></body></html>
"@
Set-Content $outPath $html -Encoding UTF8

if (Test-Path $repoPath) {
    $dest = Join-Path $repoPath $deployFolder
    New-Item -Force -ItemType Directory -Path $dest | Out-Null
    Copy-Item $outPath "$dest\store.html" -Force
    Push-Location $repoPath
    git add public/store.html 2>$null
    git commit -m "cortex: store update $([DateTime]::UtcNow.ToString('yyyy-MM-dd HH:mm'))" 2>$null
    try { git push origin main 2>&1 } catch { Write-Warning "Git push failed  repo may not exist on GitHub yet." }
    Pop-Location
}
& "$Root\STATE-REDUCER.ps1"
& "$Root\Exposure-Engine.ps1"
& "$Root\RUN-INTELLIGENCE.ps1"
Write-Host "Pipeline complete. Total SKUs: $($registry.Count) | Added this run: $added"
