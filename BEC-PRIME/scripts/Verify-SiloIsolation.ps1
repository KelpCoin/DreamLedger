$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Repo = Split-Path -Parent $Root
$PolicyPath = Join-Path $Root 'policy\silo-boundary-policy.json'
$RegistryPath = Join-Path $Root 'manifests\architecture-registry.json'
$WebPath = Join-Path $Root 'compiled\website\index.html'
$ProofDir = Join-Path $Root 'proofs'
$ProofPath = Join-Path $ProofDir 'PROOF-SILO-ISOLATION.json'

New-Item -ItemType Directory -Force -Path $ProofDir | Out-Null
$policy = Get-Content -Raw -LiteralPath $PolicyPath | ConvertFrom-Json
$registry = Get-Content -Raw -LiteralPath $RegistryPath | ConvertFrom-Json
$web = Get-Content -Raw -LiteralPath $WebPath
$fail = @()

foreach ($silo in $policy.silos) {
    $manifest = Join-Path $Root ('silos\' + $silo + '\manifest.json')
    if (-not (Test-Path -LiteralPath $manifest)) { $fail += "Missing manifest: $silo" }
}

$forbiddenFrontDoor = @('Magic: The Gathering','Commander Deck Diagnostic','MTG','Dreamiez','crypto.dreamledger.org','media.dreamledger.org','digital.dreamledger.org')
foreach ($term in $forbiddenFrontDoor) {
    if ($web -match [regex]::Escape($term)) { $fail += "Neutral front door contains silo-specific term: $term" }
}

$products = Get-ChildItem -LiteralPath (Join-Path $Root 'catalog\products') -Filter '*.json' -File
foreach ($file in $products) {
    $p = Get-Content -Raw -LiteralPath $file.FullName | ConvertFrom-Json
    foreach ($field in $policy.required_product_fields) {
        if (-not ($p.PSObject.Properties.Name -contains $field)) { $fail += "Missing product field $field in $($file.Name)" }
    }
}

$result = [ordered]@{
    schema_version = 'BEC-PROOF-1.0'
    proof_type = 'silo_isolation'
    checked_utc = (Get-Date).ToUniversalTime().ToString('o')
    front_door = 'dreamledger.org'
    silo_count = $policy.silos.Count
    product_count = $products.Count
    status = if ($fail.Count -eq 0) { 'PASS' } else { 'FAIL' }
    failures = $fail
}
$result | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $ProofPath -Encoding UTF8

if ($fail.Count -gt 0) {
    Write-Host '[FAIL] Silo isolation verification failed.'
    $fail | ForEach-Object { Write-Host " - $_" }
    exit 1
}

Write-Host '[PASS] DreamLedger front door is neutral and silo manifests/products are structurally isolated.'
Write-Host "[PROOF] $ProofPath"
exit 0
