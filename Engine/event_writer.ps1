param($Type, $Source, $Payload)
$ledger = "C:\BrownEyeCortex\ledger\event_ledger.jsonl"
$event = @{ event_id=[guid]::NewGuid().ToString(); type=$Type; source=$Source; timestamp=(Get-Date).ToString("o"); payload=$Payload } | ConvertTo-Json -Depth 10 -Compress
Add-Content $ledger $event -Encoding UTF8
Write-Host "EVENT: $Type logged"
