$eventsDir = "D:\DreamLedger_Actual\revenue\events"
$events = Get-ChildItem $eventsDir -Filter "*.json" | Sort-Object LastWriteTime
$payments = 0; $deliveries = 0
foreach ($f in $events) {
    $ev = Get-Content $f.FullName -Raw | ConvertFrom-Json
    if ($ev.type -eq "PAYMENT_RECEIVED") { $payments++ }
    if ($ev.type -eq "DELIVERY_COMPLETED") { $deliveries++ }
}
$state = @{
    events = $events.Count
    last_event = if ($events) { $events[-1].Name } else { $null }
    payments = $payments
    deliveries = $deliveries
    status = "PASS"
    updated = Get-Date -Format s
}
$state | ConvertTo-Json | Set-Content "D:\DreamLedger_Actual\revenue\loops\STATE.json" -Encoding ASCII
Write-Host "STATE REDUCED ($($events.Count) events)"
