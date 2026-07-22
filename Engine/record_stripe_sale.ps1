param([Parameter(Mandatory)] [string]$PaymentIntentId)
$apiKey = Get-Content "C:\BrownEyeCortex\keys\stripe_secret.key" -Raw
$headers = @{ Authorization = "Bearer $apiKey" }
$pi = Invoke-RestMethod -Uri "https://api.stripe.com/v1/payment_intents/$PaymentIntentId" -Headers $headers
if ($pi.status -ne "succeeded") { Write-Error "Payment not succeeded. Status: $($pi.status)"; exit 1 }
$sku = Read-Host "Offer SKU"
$channel = Read-Host "Channel"
$buyer = Read-Host "Buyer"
$packet = @{ intent="buy"; offer=$sku; price=($pi.amount_received/100); channel=$channel; buyer=$buyer; stripe_pi=$PaymentIntentId }
& "$PSScriptRoot\decision_validator.ps1" $packet | Out-Null
& "$PSScriptRoot\event_writer.ps1" "sale_completed" $channel $packet
$proofDir = if (Test-Path "D:\Revenue\proof") { "D:\Revenue\proof" } else { "C:\BrownEyeCortex\proof" }
$proofFile = "$proofDir\sale_$(Get-Date -Format yyyyMMddHHmmss).txt"
"SALE|$sku|$($packet.price)|$channel|$buyer|stripe=$PaymentIntentId" | Out-File $proofFile
Write-Host "Sale logged. Proof: $proofFile" -ForegroundColor Green
