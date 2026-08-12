[CmdletBinding()]
param([string]$ManifestPath)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not $ManifestPath) { $ManifestPath = Join-Path $root 'cube\manifests' }

$files = @()
if (Test-Path -LiteralPath $ManifestPath -PathType Leaf) { $files = @(Get-Item -LiteralPath $ManifestPath) }
else { $files = @(Get-ChildItem -LiteralPath $ManifestPath -Filter '*.json' -File -ErrorAction Stop) }
if ($files.Count -eq 0) { throw 'No CUBE manifests found.' }

$schemaPath = Join-Path $root 'cube\CUBE-CLONE-MANIFEST.schema.json'
if (-not (Test-Path $schemaPath)) { throw 'CUBE manifest schema missing.' }

$fail = 0
foreach ($file in $files) {
    $m = Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json
    $required = 'cube_version','silo_name','product_name','price_nzd','stripe_product_id','domain','repo_name','surface','status'
    foreach ($key in $required) {
        if ($null -eq $m.$key -or [string]::IsNullOrWhiteSpace([string]$m.$key)) { Write-Output "[FAIL] $($file.Name): missing $key"; $fail++ }
    }
    if ($m.isolation -ne $true) { Write-Output "[FAIL] $($file.Name): isolation is not true"; $fail++ }
    if ([int]$m.price_nzd -lt 1) { Write-Output "[FAIL] $($file.Name): invalid price"; $fail++ }
    else { Write-Output "[PASS] $($file.Name): $($m.silo_name) / $($m.product_name) / NZD $($m.price_nzd) / isolated" }
}

$proofPath = Join-Path $root ('proofs\PROOF-CUBE-VERIFY.json')
$proof = [ordered]@{
    schema = 'BEC-CUBE-VERIFY-PROOF-1.0'
    manifests_checked = $files.Count
    result = if ($fail -eq 0) { 'PASS' } else { 'FAIL' }
    failures = $fail
    timestamp_utc = (Get-Date).ToUniversalTime().ToString('o')
}
$proof | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $proofPath -Encoding UTF8
if ($fail -gt 0) { exit 1 }
Write-Output "[PASS] CUBE verification complete. Proof: $proofPath"
