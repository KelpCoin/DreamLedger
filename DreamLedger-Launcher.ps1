Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

$Root = "C:\BrownEyeCortex\DreamLedger"

$merge = "$Root\merge_registry.ps1"
$pricing = "$Root\attach_payment_links.ps1"
$build = "$Root\build_store.ps1"

Write-Host "=== DREAMLEDGER ORCHESTRATION START ==="

if (!(Test-Path $merge)) { throw "Missing merge_registry.ps1" }
if (!(Test-Path $pricing)) { throw "Missing attach_payment_links.ps1" }
if (!(Test-Path $build)) { throw "Missing build_store.ps1" }

powershell -ExecutionPolicy Bypass -File $merge
powershell -ExecutionPolicy Bypass -File $pricing
powershell -ExecutionPolicy Bypass -File $build

Write-Host "=== DREAMLEDGER COMPLETE ==="
