Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

$Root = "C:\BrownEyeCortex\DreamLedger"
$Log  = "D:\BrownEyeCortex_Logs\DreamLedger\cortex_run.log"

function log($m){ Add-Content $Log "[$(Get-Date)] $m" }

log "CYCLE_START"

# HARD CHECK: Stripe key must exist
if (-not $env:STRIPE_SECRET_KEY) {
    throw "STRIPE_SECRET_KEY missing"
}

$merge   = "$Root\merge_registry.ps1"
$pricing = "$Root\attach_payment_links.ps1"
$build   = "$Root\build_store.ps1"

foreach ($p in @($merge,$pricing,$build)) {
    if (!(Test-Path $p)) { throw "Missing script: $p" }
}

log "RUN_MERGE"
powershell -ExecutionPolicy Bypass -File $merge

log "RUN_PRICING"
powershell -ExecutionPolicy Bypass -File $pricing

log "RUN_BUILD"
powershell -ExecutionPolicy Bypass -File $build

log "CYCLE_DONE"

"OK $(Get-Date)" | Set-Content "$Root\CORTEX_PROOF.txt"
Write-Host "CORTEX OK"
