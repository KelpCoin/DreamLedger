$ledger = "C:\BrownEyeCortex\ledger\event_ledger.jsonl"
$proof = "C:\BrownEyeCortex\proof\watchdog.txt"
while ($true) {
    $count = if (Test-Path $ledger) { (Get-Content $ledger | Measure-Object).Count } else { 0 }
    "$(Get-Date -Format o) | events=$count | status=OK" | Add-Content $proof
    Start-Sleep -Seconds 60
}
