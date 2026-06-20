param([string]$StencilPath = "C:\BrownEyeCortex\stencils\EDH_Upgrade_MicroAudit.json")
$stencil = Get-Content $StencilPath | ConvertFrom-Json
$priceCents = [int]($stencil.price_band * 100)
$apiKey = Get-Content "C:\BrownEyeCortex\keys\stripe_secret.key" -Raw
$headers = @{ Authorization = "Bearer $apiKey"; "Content-Type" = "application/x-www-form-urlencoded" }
$currency = "nzd"
try {
    $priceBody = "unit_amount=$priceCents&currency=$currency&product_data[name]=$($stencil.name)"
    $priceObj = Invoke-RestMethod -Uri "https://api.stripe.com/v1/prices" -Method Post -Headers $headers -Body $priceBody
    $link = Invoke-RestMethod -Uri "https://api.stripe.com/v1/payment_links" -Method Post -Headers $headers -Body "line_items[0][price]=$($priceObj.id)&line_items[0][quantity]=1"
} catch {
    $currency = "usd"
    $priceBody = "unit_amount=$priceCents&currency=usd&product_data[name]=$($stencil.name)"
    $priceObj = Invoke-RestMethod -Uri "https://api.stripe.com/v1/prices" -Method Post -Headers $headers -Body $priceBody
    $link = Invoke-RestMethod -Uri "https://api.stripe.com/v1/payment_links" -Method Post -Headers $headers -Body "line_items[0][price]=$($priceObj.id)&line_items[0][quantity]=1"
}
$link.url | Out-File "C:\BrownEyeCortex\logs\stripe_latest_link.txt" -Encoding utf8
Write-Host "Stripe Payment Link: $($link.url)" -ForegroundColor Green
& "$PSScriptRoot\event_writer.ps1" "view" "stripe_link_generated" @{ offer=$stencil.name; link=$link.url }
