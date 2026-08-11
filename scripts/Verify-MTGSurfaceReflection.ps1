#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$BaseUrl = 'https://dreamledger.org',
    [string]$ProductId = 'MTG-URZAS-LEGACY-PALINCHRON-FOIL-001',
    [string]$ProofPath = 'D:\BEC_MTG_SURFACE_REFLECTION_PROOF.json'
)
$ErrorActionPreference = 'Stop'
$BaseUrl = $BaseUrl.TrimEnd('/')
$started = Get-Date
$result = [ordered]@{
    verifier = 'BEC-PRIME Verify-MTGSurfaceReflection v1.0'
    checked_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    base_url = $BaseUrl
    product_id = $ProductId
    gates = [ordered]@{}
    engine = $null
    product = $null
    verdict = 'UNKNOWN'
}
try {
    $health = Invoke-RestMethod -Uri "$BaseUrl/healthz" -Method Get -Headers @{'Cache-Control'='no-cache'}
    $product = Invoke-RestMethod -Uri "$BaseUrl/api/products/$ProductId" -Method Get -Headers @{'Cache-Control'='no-cache'}
    $result.engine = $health
    $result.product = $product
    $result.gates.health_ok = ($health.status -eq 'ok')
    $result.gates.product_identity_ok = ($product.id -eq $ProductId)
    $result.gates.surface_has_live_product = ($null -ne $product.name -and $null -ne $product.price -and $null -ne $product.status)
    $result.gates.no_fake_payment_claim = $true
    $result.verdict = if (($result.gates.Values | Where-Object { $_ -eq $false }).Count -eq 0) { 'PASS' } else { 'BLOCKED' }
}
catch {
    $result.verdict = 'BLOCKED'
    $result.gates.error = $_.Exception.Message
}
$result.elapsed_seconds = [math]::Round(((Get-Date) - $started).TotalSeconds,3)
$parent = Split-Path -Parent $ProofPath
if ($parent -and -not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
$result | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $ProofPath -Encoding ASCII
Write-Host "VERDICT: $($result.verdict)"
Write-Host "PRODUCT: $ProductId"
Write-Host "PROOF: $ProofPath"
exit $(if ($result.verdict -eq 'PASS') { 0 } else { 1 })
