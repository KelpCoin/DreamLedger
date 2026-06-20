if (Test-Path "D:\Revenue\EMERGENCY_STOP.txt") { Write-Host "EMERGENCY STOP ACTIVE" -ForegroundColor Red; exit }
$root = "C:\BrownEyeCortex"
$stencil = & "$root\engine\stencil_engine.ps1" "$root\stencils\EDH_Upgrade_MicroAudit.json"
Write-Host "OFFER: $($stencil.offer) | PRICE: `$$($stencil.price)" -ForegroundColor Cyan
$channel = Read-Host "Channel (dm/facebook/discord)"
$buyer = Read-Host "Buyer identifier"
& "$root\engine\event_writer.ps1" "view" $channel @{ offer=$stencil.sku }
$packet = @{ intent="buy"; offer=$stencil.sku; price=$stencil.price; channel=$channel; buyer=$buyer }
& "$root\engine\decision_validator.ps1" $packet | Out-Null
& "$root\engine\event_writer.ps1" "sale_completed" $channel $packet
$proofDir = if (Test-Path "D:\Revenue\proof") { "D:\Revenue\proof" } else { "$root\proof" }
if (!(Test-Path $proofDir)) { New-Item -ItemType Directory -Force -Path $proofDir }
$proofFile = "$proofDir\sale_$(Get-Date -Format yyyyMMddHHmmss).txt"
"SALE|$($stencil.sku)|$($stencil.price)|$channel|$buyer" | Out-File $proofFile
Write-Host "SALE LOGGED -> $proofFile" -ForegroundColor Green
