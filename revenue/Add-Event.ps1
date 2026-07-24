param([string]$EventType, [hashtable]$Payload)
$eventsDir = "D:\DreamLedger_Actual\revenue\events"
New-Item -ItemType Directory -Force -Path $eventsDir | Out-Null
$timestamp = Get-Date -Format s
$eventId = "evt-$((Get-Date).ToString('yyyyMMddHHmmssfff'))"
$prevHash = $null
$lastFile = Get-ChildItem $eventsDir -Filter "*.json" | Sort-Object LastWriteTime | Select-Object -Last 1
if ($lastFile) {
    $last = Get-Content $lastFile.FullName -Raw | ConvertFrom-Json
    $prevHash = $last.hash
}
$event = [ordered]@{
    id = $eventId
    timestamp = $timestamp
    type = $EventType
    payload = $Payload
    previous_hash = $prevHash
}
$canon = $event | ConvertTo-Json -Compress
$sha = [System.Security.Cryptography.SHA256]::Create()
$hash = [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($canon))).Replace("-","").ToLower()
$event.hash = $hash
$event | ConvertTo-Json -Depth 10 | Set-Content "$eventsDir\$eventId.json" -Encoding ASCII
Write-Host "EVENT CREATED: $eventId"
