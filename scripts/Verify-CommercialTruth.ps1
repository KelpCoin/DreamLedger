#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$BaseUrl = 'https://dreamledger.org',
    [string]$ProductId = 'MTG-URZAS-LEGACY-PALINCHRON-FOIL-001',
    [string]$ProofPath = 'D:\BEC_COMMERCIAL_TRUTH.json'
)

$ErrorActionPreference = 'Stop'
$BaseUrl = $BaseUrl.TrimEnd('/')
$Started = Get-Date

function Get-Json([string]$Url) {
    Invoke-RestMethod -Uri $Url -Method Get -Headers @{ 'Cache-Control' = 'no-cache' }
}

$Result = [ordered]@{
    verifier = 'BEC-PRIME Verify-CommercialTruth v1.0'
    checked_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    base_url = $BaseUrl
    product_id = $ProductId
    health = $null
    product = $null
    gates = [ordered]@{}
    verdict = 'UNKNOWN'
    elapsed_seconds = 0
}

try {
    $health = Get-Json "$BaseUrl/healthz"
    $product = Get-Json "$BaseUrl/api/products/$ProductId"

    $Result.health = $health
    $Result.product = $product
    $Result.gates.health_ok = ($health.status -eq 'ok')
    $Result.gates.stripe_configured = [bool]$health.stripe_configured
    $Result.gates.webhook_configured = [bool]$health.webhook_configured
    $Result.gates.product_found = ($product.id -eq $ProductId)
    $Result.gates.product_published = ($product.status -eq 'published')
    $Result.gates.inventory_available = ([int]$product.inventory -gt 0)
    $Result.gates.payment_surface_exists = ($Result.gates.stripe_configured -and $Result.gates.webhook_configured -and $Result.gates.product_published)

    $required = @(
        $Result.gates.health_ok,
        $Result.gates.product_found,
        $Result.gates.product_published,
        $Result.gates.inventory_available,
        $Result.gates.payment_surface_exists
    )

    if (($required | Where-Object { -not $_ }).Count -eq 0) {
        $Result.verdict = 'READY_FOR_HUMAN_APPROVAL'
    } else {
        $Result.verdict = 'BLOCKED'
    }
}
catch {
    $Result.verdict = 'BLOCKED'
    $Result.gates.error = $_.Exception.Message
}
finally {
    $Result.elapsed_seconds = [math]::Round(((Get-Date) - $Started).TotalSeconds, 3)
    $parent = Split-Path -Parent $ProofPath
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    $Result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ProofPath -Encoding ASCII
}

Write-Host "VERDICT: $($Result.verdict)"
Write-Host "PRODUCT: $ProductId"
Write-Host "PROOF: $ProofPath"
Write-Host "PAYMENT SURFACE: $($Result.gates.payment_surface_exists)"
Write-Host "REAL PAYMENT: NOT CLAIMED"
Write-Host "DELIVERY: NOT CLAIMED"
exit $(if ($Result.verdict -eq 'READY_FOR_HUMAN_APPROVAL') { 0 } else { 1 })
