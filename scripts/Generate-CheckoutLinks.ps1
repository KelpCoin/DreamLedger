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
