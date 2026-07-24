$eventsDir = "D:\DreamLedger_Actual\revenue\events"
$files = Get-ChildItem $eventsDir -Filter "*.json" | Sort-Object LastWriteTime
if ($files.Count -eq 0) { Write-Host "VERIFY LOOP EMPTY"; exit }
$prevHash = $null; $ok = $true
foreach ($f in $files) {
    $ev = Get-Content $f.FullName -Raw | ConvertFrom-Json
    if ($prevHash -ne $ev.previous_hash) { Write-Host "CHAIN BREAK at $($ev.id)" -ForegroundColor Red; $ok = $false }
    $prevHash = $ev.hash
}
if ($ok) { Write-Host "VERIFY LOOP PASS ($($files.Count) events)" -ForegroundColor Green }
else { Write-Host "VERIFY LOOP FAIL" -ForegroundColor Red }
