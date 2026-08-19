$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$proofDir = Join-Path $root 'PROOFS'
New-Item -ItemType Directory -Force -Path $proofDir | Out-Null
$proof = Join-Path $proofDir 'COMMERCE-SCALE-SMOKE.json'

Push-Location $root
try {
    $raw = node BEC-PRIME/scripts/scale-commerce-smoke.js
    if ($LASTEXITCODE -ne 0) { throw 'Scale smoke failed.' }
    $obj = $raw | ConvertFrom-Json
    if ($obj.status -ne 'PASS') { throw 'Scale smoke did not return PASS.' }
    if ([int64]$obj.generated_count -lt 100000) { throw 'Scale smoke generated fewer than 100000 fixtures.' }
    if ([int64]$obj.unique_skus -ne [int64]$obj.generated_count) { throw 'SKU uniqueness failed.' }
    if ([int64]$obj.unique_idempotency_keys -ne [int64]$obj.generated_count) { throw 'Idempotency uniqueness failed.' }
    if ([int64]$obj.stripe_objects_created -ne 0) { throw 'Scale smoke must not create Stripe objects.' }
    $obj | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 $proof
    Write-Host ('PASS: commerce scale smoke proof written to ' + $proof)
    Write-Host ('VERIFY: Get-Content "' + $proof + '" | ConvertFrom-Json | Select-Object status,generated_count,unique_skus,unique_idempotency_keys,stripe_objects_created')
}
finally {
    Pop-Location
}
