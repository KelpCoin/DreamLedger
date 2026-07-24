param([hashtable]$Entry)
$ledger = "D:\DreamLedger_Actual\evidence\ledger.json"
New-Item -ItemType Directory -Force -Path (Split-Path $ledger) | Out-Null
$prevHash = $null
if (Test-Path $ledger) {
    $lines = Get-Content $ledger
    if ($lines.Count -gt 0) { $prevHash = ($lines[-1] | ConvertFrom-Json).hash }
}
$Entry["timestamp"] = Get-Date -Format s
$Entry["previous_hash"] = $prevHash
$canon = $Entry | ConvertTo-Json -Compress
$sha = [System.Security.Cryptography.SHA256]::Create()
$Entry["hash"] = [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($canon))).Replace("-","").ToLower()
$Entry | ConvertTo-Json -Compress | Add-Content $ledger -Encoding ASCII
Write-Host "EVIDENCE ADDED"
