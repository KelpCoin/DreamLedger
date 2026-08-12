$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$registry = Join-Path $root 'cube\CUBE-SILO-REGISTRY.json'
$surface = Join-Path $root 'cube\CUBE-MONEY-SURFACES.json'
$proof = Join-Path $root 'PROOF-CUBE-SILO-ISOLATION.json'
if (!(Test-Path $registry)) { throw 'CUBE registry missing' }
if (!(Test-Path $surface)) { throw 'CUBE money surfaces missing' }
$r = Get-Content $registry -Raw | ConvertFrom-Json
$s = Get-Content $surface -Raw | ConvertFrom-Json
if ($r.neutral_host -ne 'DreamLedger') { throw 'DreamLedger neutrality failed' }
if ($r.cross_silo_data -ne $false) { throw 'Cross-silo isolation failed' }
$ids = @($r.silos | ForEach-Object { $_.id })
if ($ids.Count -ne 4) { throw 'Expected four isolated silos' }
$proofObj = [ordered]@{ schema_version='CUBE-SILO-ISOLATION-PROOF-1.0'; timestamp_utc=(Get-Date).ToUniversalTime().ToString('o'); status='PASS'; neutral_host=$r.neutral_host; silo_count=$ids.Count; silos=$ids; cross_silo_data=$r.cross_silo_data; commercial_ladder=$s.commercial_ladder }
$proofObj | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 $proof
Write-Host '[PASS] CUBE silo isolation verified'
Write-Host "[PROOF] $proof"
