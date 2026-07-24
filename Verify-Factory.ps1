Write-Host "`n===================================" -ForegroundColor Cyan
Write-Host " DREAMLEDGER COMMERCE KERNEL v1.2" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
$root = "D:\DreamLedger_Actual"
$checks = @()
$prodFile = "$root\silos\mtg\products\jaheira\product.json"
$prod = if (Test-Path $prodFile) { Get-Content $prodFile -Raw | ConvertFrom-Json } else { $null }
$checks += @{Name="Product (Jaheira)"; Pass=($prod -ne $null); Info=if($prod){"$($prod.name)  $($prod.status)"}else{"MISSING"}}
$checks += @{Name="robots.txt"; Pass=(Test-Path "$root\seo\robots.txt")}
$checks += @{Name="sitemap.xml"; Pass=(Test-Path "$root\seo\sitemap.xml")}
$payUrl = if ($prod) { $prod.payment_url } else { "" }
$checks += @{Name="Payment link"; Pass=($payUrl -ne ""); Info=if($payUrl){"$payUrl"}else{"MISSING (place PayPal/Stripe link)"}}
$checks += @{Name="Catalog (decks.json)"; Pass=(Test-Path "$root\catalog\decks.json")}
$evtDir = "$root\revenue\events"
$evtCount = (Get-ChildItem $evtDir -Filter "*.json" -ErrorAction SilentlyContinue).Count
$checks += @{Name="Revenue events"; Pass=($evtCount -gt 0); Info="$evtCount events"}
$checks += @{Name="Evidence ledger"; Pass=(Test-Path "$root\evidence\ledger.json")}
$checks += @{Name="Accounts skeleton"; Pass=(Test-Path "$root\accounts\users.json")}
$checks += @{Name="Storefront"; Pass=(Test-Path "$root\storefront\index.html")}
$checks += @{Name="Silo cloning"; Pass=(Test-Path "$root\silos\Clone-Silo.ps1")}
$checks += @{Name="Fossil manifest"; Pass=(Test-Path "$root\fossils\DL-FOSSIL-0001.json")}
Write-Host "`nSTATUS:" -ForegroundColor Yellow
$allPass = $true
foreach ($c in $checks) {
    $icon = if ($c.Pass) { "[PASS]" } else { "[FAIL]" }
    $color = if ($c.Pass) { "Green" } else { "Red"; $allPass = $false }
    Write-Host "  $icon $($c.Name)  $($c.Info)" -ForegroundColor $color
}
if ($allPass) { Write-Host "`nSYSTEM: ARMED`nFirst commercial fossil within reach." -ForegroundColor Green }
else { Write-Host "`nSYSTEM: BLOCKED`nFix FAIL items above." -ForegroundColor Red }
