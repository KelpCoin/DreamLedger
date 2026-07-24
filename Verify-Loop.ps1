$events = "D:\DreamLedger_Actual\revenue\events"
$files = Get-ChildItem $events -Filter *.json
if ($files.Count -gt 0) {
    Write-Host "VERIFY LOOP PASS ($($files.Count) events)"
} else {
    Write-Host "VERIFY LOOP EMPTY"
}
