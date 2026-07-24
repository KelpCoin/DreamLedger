param(
    [string]$EventType,
    [hashtable]$Payload
)
$root = "D:\DreamLedger_Actual\revenue\events"
$event = [ordered]@{
    timestamp = (Get-Date -Format s)
    type      = $EventType
    payload   = $Payload
}
$file = "$root\event_$((Get-Date).ToString('yyyyMMdd_HHmmssfff')).json"
$event | ConvertTo-Json -Depth 10 | Set-Content $file -Encoding UTF8
Write-Host "EVENT CREATED: $file"
