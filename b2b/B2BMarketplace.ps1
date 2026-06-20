param($Action, $Email, $PlanId, $ProfileId)
$requiredSales = 3
$salesCount = 0
$ledgerPath = "C:\BrownEyeCortex\ledger\event_ledger.jsonl"
if (Test-Path $ledgerPath) {
    $salesCount = (Get-Content $ledgerPath -Tail 5000 | ForEach-Object { $_ | ConvertFrom-Json } | Where-Object { $_.type -eq "sale_completed" }).Count
}
if ($salesCount -lt $requiredSales) {
    Write-Warning "B2B Marketplace locked - need $requiredSales real sales. Currently: $salesCount"
    exit 1
}
Write-Host "B2B Marketplace active (keys needed). Use NewSubscription, Reconcile."
