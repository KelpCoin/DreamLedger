$Root = "C:\BrownEyeCortex\DreamLedger"
$registry = Get-Content "$Root\registry.json" -Raw | ConvertFrom-Json
$registry = @($registry)

$cards = foreach ($item in $registry) {
    $price = [math]::Round($item.price_nzd / 100, 2)
    $link = if ($item.payment_link) { $item.payment_link } else { "#" }

    "<div class='card'>
        <h2>$($item.name)</h2>
        <p>$($item.description)</p>
        <p><strong>NZD $price</strong></p>
        <a class='buy' href='$link'>Buy Now</a>
    </div>"
}

$html = @"
<!DOCTYPE html>
<html>
<head>
<meta charset='UTF-8'>
<title>DreamLedger Store</title>
<style>
body{font-family:sans-serif;background:#0b0b0b;color:#e0e0e0;max-width:900px;margin:2rem auto}
.card{background:#1a1a1a;border:1px solid #333;padding:1rem;margin-bottom:1rem;border-radius:8px}
.buy{background:#ffd966;color:#000;padding:0.5rem 1rem;display:inline-block;text-decoration:none}
</style>
</head>
<body>
<h1>DreamLedger Store</h1>
$($cards -join "`n")
</body>
</html>
"@

$pub = "C:\BrownEyeCortex\mtg-furnace-render\public"
New-Item -ItemType Directory -Force -Path $pub | Out-Null

[System.IO.File]::WriteAllText("$pub\store.html",$html)

Write-Host "STORE_BUILT_OK"
