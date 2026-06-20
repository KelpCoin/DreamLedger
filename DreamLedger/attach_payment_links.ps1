# attach_payment_links.ps1

$stripeKey = $env:STRIPE_SECRET_KEY
if (-not $stripeKey) { throw "Missing STRIPE_SECRET_KEY" }

$registryPath = "C:\BrownEyeCortex\DreamLedger\registry.json"
$registry = Get-Content $registryPath -Raw | ConvertFrom-Json
$registry = @($registry)

foreach ($item in $registry) {

    if ($item.payment_link) { continue }

    $priceCents = [int]$item.price_nzd
    $nameEnc = [uri]::EscapeDataString($item.name)

    $prod = Invoke-RestMethod -Uri "https://api.stripe.com/v1/products" `
        -Method Post -Headers @{Authorization="Bearer $stripeKey"} `
        -Body "name=$nameEnc&metadata[registry_id]=$($item.id)" `
        -ContentType "application/x-www-form-urlencoded"

    $price = Invoke-RestMethod -Uri "https://api.stripe.com/v1/prices" `
        -Method Post -Headers @{Authorization="Bearer $stripeKey"} `
        -Body "unit_amount=$priceCents&currency=nzd&product=$($prod.id)" `
        -ContentType "application/x-www-form-urlencoded"

    $link = Invoke-RestMethod -Uri "https://api.stripe.com/v1/payment_links" `
        -Method Post -Headers @{Authorization="Bearer $stripeKey"} `
        -Body "line_items[0][price]=$($price.id)&line_items[0][quantity]=1" `
        -ContentType "application/x-www-form-urlencoded"

    $item | Add-Member -NotePropertyName "payment_link" -NotePropertyValue $link.url -Force

    Write-Host "LINK: $($item.name)"
}

$registry | ConvertTo-Json -Depth 10 | Set-Content $registryPath -Encoding UTF8
Write-Host "Stripe linking complete"
