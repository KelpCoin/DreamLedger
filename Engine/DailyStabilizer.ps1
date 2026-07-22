& "C:\BrownEyeCortex\engine\SystemGuard.ps1"
$root = "C:\BrownEyeCortex"
$ledgerPath = "$root\ledger\event_ledger.jsonl"
$linkFile   = "$root\logs\stripe_latest_link.txt"
$htmlFile   = "$root\public\happyhomarid\index.html"
$buyersFile = "$root\data\buyers.csv"
$stencil = Get-Content "$root\stencils\EDH_Upgrade_MicroAudit.json" | ConvertFrom-Json

$apiKey = Get-Content "$root\keys\stripe_secret.key" -Raw
if (!(Test-Path $linkFile) -or ((Get-Date) - (Get-Item $linkFile).LastWriteTime).TotalHours -gt 23) {
    $priceCents = [int]($stencil.price_band * 100)
    $headers = @{ Authorization = "Bearer $apiKey"; "Content-Type" = "application/x-www-form-urlencoded" }
    try {
        $priceObj = Invoke-RestMethod -Uri "https://api.stripe.com/v1/prices" -Method Post -Headers $headers -Body "unit_amount=$priceCents&currency=nzd&product_data[name]=$($stencil.name)"
        $link = Invoke-RestMethod -Uri "https://api.stripe.com/v1/payment_links" -Method Post -Headers $headers -Body "line_items[0][price]=$($priceObj.id)&line_items[0][quantity]=1"
        $link.url | Out-File $linkFile -Encoding utf8
    } catch {
        $priceObj = Invoke-RestMethod -Uri "https://api.stripe.com/v1/prices" -Method Post -Headers $headers -Body "unit_amount=$priceCents&currency=usd&product_data[name]=$($stencil.name)"
        $link = Invoke-RestMethod -Uri "https://api.stripe.com/v1/payment_links" -Method Post -Headers $headers -Body "line_items[0][price]=$($priceObj.id)&line_items[0][quantity]=1"
        $link.url | Out-File $linkFile -Encoding utf8
    }
}
$stripeLink = Get-Content $linkFile -Raw

$html = Get-Content $htmlFile -Raw
if ($html -match 'data-stripe-link="REPLACE_ME"') {
    $html = $html -replace 'data-stripe-link="REPLACE_ME"', "data-stripe-link=""$stripeLink"""
    Set-Content $htmlFile -Value $html -Encoding UTF8
    Write-Host "Stripe link injected into $htmlFile" -ForegroundColor Cyan
}

if (!(Test-Path $buyersFile)) { "name,contact_method,last_contact,notes" | Out-File $buyersFile -Encoding utf8 }
$buyers = Import-Csv $buyersFile
$today = Get-Date
$queue = $buyers | Where-Object {
    if ([string]::IsNullOrWhiteSpace($_.last_contact)) { return $true }
    try { [datetime]$_.last_contact -lt $today.AddDays(-7) } catch { $true }
} | Select-Object -First 5

$salesCount = 0
if (Test-Path $ledgerPath) {
    $salesCount = (Get-Content $ledgerPath -Tail 5000 | ForEach-Object { $_ | ConvertFrom-Json } | Where-Object { $_.type -eq "sale_completed" }).Count
}

Write-Host "`n======================================" -ForegroundColor Cyan
Write-Host "   HAPPY HOMARID DAILY STABILIZER - $(Get-Date -Format 'yyyy-MM-dd')" -ForegroundColor Cyan
Write-Host "======================================"
Write-Host "LEDGER: $salesCount sales logged" -ForegroundColor Yellow
Write-Host "OFFER: $($stencil.name) - NZD $($stencil.price_band)" -ForegroundColor Green
Write-Host "PAYMENT LINK: $stripeLink" -ForegroundColor White
Write-Host "OUTREACH QUEUE ($($queue.Count) contacts):"
if ($queue.Count -eq 0) { Write-Host "  No one due. Add buyers to $buyersFile." } else { $queue | Format-Table name, contact_method, @{Label="Last Contact"; Expression={$_.last_contact}} -AutoSize }
Write-Host "`nYOUR 3 STEPS TODAY:"
Write-Host "1. DM each: 'Hey [name], I'm doing $15 deck audits  5 cuts, 5 upgrades, 1 synergy fix. Want one? $stripeLink'"
Write-Host "2. After payment: powershell -File $root\engine\record_stripe_sale.ps1 -PaymentIntentId pi_xxx"
Write-Host "3. Update their last_contact in $buyersFile"
Write-Host "`nWatchdog last:" (Get-Content "$root\proof\watchdog.txt" -Tail 1 -ErrorAction SilentlyContinue)
Write-Host "======================================`n"
