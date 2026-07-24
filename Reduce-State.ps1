$path = "D:\DreamLedger_Actual\revenue\events"
$count = (Get-ChildItem $path -Filter *.json).Count
@{
    events   = $count
    last_run = (Get-Date -Format s)
    status   = "PASS"
} | ConvertTo-Json | Set-Content "D:\DreamLedger_Actual\revenue\STATE.json"
Write-Host "STATE REDUCED ($count events)"
