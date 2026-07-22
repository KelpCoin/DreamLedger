#Requires -Version 5.1
$ROOT = 'C:\BrownEyeCortex'
$ts   = [DateTimeOffset]::UtcNow.ToString('o')
Write-Host "=== INTELLIGENCE CYCLE $ts ==="

& powershell.exe -ExecutionPolicy Bypass -File "$ROOT\STATE-REDUCER.ps1"
& powershell.exe -ExecutionPolicy Bypass -File "$ROOT\intelligence\gauntlet-v6\gauntlet.ps1"

$state = Get-Content "$ROOT\data\state.json" -Raw | ConvertFrom-Json -ErrorAction SilentlyContinue
if ($null -ne $state -and [string]$state.intelligence_layer -eq 'active' -and $state.sales_count -gt 0) {
    Write-Host '[INTELLIGENCE ACTIVE] Running Elohim + Supervisor...'
    & powershell.exe -ExecutionPolicy Bypass -File "$ROOT\intelligence\elohim-v6\elohim.ps1"
    & powershell.exe -ExecutionPolicy Bypass -File "$ROOT\intelligence\supervisor-v6\supervisor.ps1"
    # Rebuild store after mutations
    & powershell.exe -ExecutionPolicy Bypass -File "$ROOT\Update-Store.ps1"
} else {
    Write-Host '[INTELLIGENCE DORMANT] Log a sale + run FirstSaleLatch.ps1 to activate.'
}

$ev = [ordered]@{
    event_id      = [guid]::NewGuid().ToString()
    event_type    = 'system'
    timestamp_utc = [DateTimeOffset]::UtcNow.ToString('o')
    source        = 'system'
    entity        = @{ sku_id = 'system'; type = 'system' }
    metrics       = @{ amount_nzd_cents = 0; quantity = 0 }
    flags         = @{ ignite = $false; test = $false }
    note          = 'intelligence_cycle'
} | ConvertTo-Json -Compress
# Atomic append
$LOCK = "$ROOT\ledger\ledger.lock"
while (Test-Path $LOCK) { Start-Sleep -Milliseconds 50 }
New-Item -ItemType File -Path $LOCK -Force | Out-Null
try { 
Write-Host "=== INTELLIGENCE CYCLE COMPLETE ==="
