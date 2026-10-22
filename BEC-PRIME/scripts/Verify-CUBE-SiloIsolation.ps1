$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$registry = Join-Path $root 'cube\CUBE-SILO-REGISTRY.json'
$surface = Join-Path $root 'cube\CUBE-MONEY-SURFACES.json'
$factory = Join-Path $root 'cube\CUBE-SILO-FACTORY-CONTRACT.json'
$proof = Join-Path $root 'PROOF-CUBE-SILO-ISOLATION.json'
foreach ($p in @($registry,$surface,$factory)) { if (!(Test-Path $p)) { throw "Required CUBE contract missing: $p" } }
$r = Get-Content $registry -Raw | ConvertFrom-Json
$s = Get-Content $surface -Raw | ConvertFrom-Json
$f = Get-Content $factory -Raw | ConvertFrom-Json
if ($r.neutral_host -ne 'DreamLedger') { throw 'DreamLedger neutrality failed' }
if ($r.cross_silo_data -ne $false) { throw 'Cross-silo isolation policy failed' }
$ids = @($r.silos | ForEach-Object { $_.id })
$slugs = @($r.silos | ForEach-Object { $_.slug })
$expected = @($f.silos)
if ($ids.Count -lt $expected.Count) { throw "Registry has fewer silos ($($ids.Count)) than factory contract ($($expected.Count))" }
if (($ids | Sort-Object -Unique).Count -ne $ids.Count) { throw 'Duplicate silo IDs detected' }
if (($slugs | Sort-Object -Unique).Count -ne $slugs.Count) { throw 'Duplicate canonical silo slugs detected' }
foreach ($slug in $expected) {
  if ($slugs -notcontains $slug) { throw "Factory silo missing from registry: $slug" }
}
foreach ($item in $r.silos) {
  if ($item.provisioned -eq $true -and $item.status -like '*SCAFFOLD*') { throw "Silo cannot be both provisioned and scaffold-only: $($item.slug)" }
  if ($item.status -ne 'MASTER_REFERENCE_EXISTING_SURFACE' -and $item.rls_verified -eq $true) {
    throw "A candidate cannot claim live RLS proof without an explicit runtime evidence record: $($item.slug)"
  }
}
if ($r.economic_truth.verified_external_revenue_nzd -ne 0) { throw 'Registry must not set revenue without separate verified ledger evidence' }
$proofObj = [ordered]@{
  schema_version='CUBE-SILO-ISOLATION-PROOF-1.1'
  timestamp_utc=(Get-Date).ToUniversalTime().ToString('o')
  status='PASS'
  verification_scope='DECLARATIVE_REGISTRY_AND_FACTORY_CONSISTENCY_ONLY'
  neutral_host=$r.neutral_host
  silo_count=$ids.Count
  factory_silo_count=$expected.Count
  silos=$slugs
  cross_silo_data_policy=$r.cross_silo_data
  runtime_isolation_verified=$false
  database_rls_verified=$false
  custom_domains_verified=$false
  checkout_and_fulfillment_verified=$false
  production_worker_scaling_verified=$false
  verified_revenue_nzd=$r.economic_truth.verified_external_revenue_nzd
  commercial_ladder_status=$s.commercial_ladder_status
}
$proofObj | ConvertTo-Json -Depth 12 | Set-Content -Encoding UTF8 $proof
Write-Host '[PASS] CUBE registry and factory configuration are consistent.'
Write-Host '[SCOPE] This verifier does not prove live runtime isolation, RLS, checkout, fulfillment, or revenue.'
Write-Host "[PROOF] $proof"
