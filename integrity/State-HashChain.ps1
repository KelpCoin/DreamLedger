#Requires -Version 5.1
$ROOT       = 'C:\BrownEyeCortex'
$STATE_FILE = "$ROOT\data\state.json"
$CHAIN_FILE = "$ROOT\integrity\state_chain.jsonl"

if (-not (Test-Path $STATE_FILE)) { Write-Warning 'state.json not found'; exit 1 }

$currentHash = (Get-FileHash $STATE_FILE -Algorithm SHA256).Hash
$prevHash    = $null

if (Test-Path $CHAIN_FILE) {
    $lastLine = Get-Content $CHAIN_FILE -Encoding UTF8 | Select-Object -Last 1
    if ($lastLine) {
        try { $prevHash = ($lastLine | ConvertFrom-Json).current_hash } catch { }
    }
}

$entry = [ordered]@{
    timestamp_utc = [DateTimeOffset]::UtcNow.ToString('o')
    previous_hash = $prevHash
    current_hash  = $currentHash
} | ConvertTo-Json -Compress
Add-Content $CHAIN_FILE $entry -Encoding UTF8
Write-Host "Hash chain: $currentHash (prev: $prevHash)"