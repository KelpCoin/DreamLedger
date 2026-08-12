#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$BaseUrl = 'https://dreamledger.org',
    [string]$ProductId = 'COMMANDER-DECK-DIAGNOSTIC-001',
    [string]$ProofPath = 'D:\BEC_CASH_NOW_PROOF.json'
)

$ErrorActionPreference = 'Stop'
$BaseUrl = $BaseUrl.TrimEnd('/')
$started = Get-Date
$result = [ordered]@{
    verifier = 'BEC-PRIME Verify-CashNow v1.0'
    checked_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    base_url = $BaseUrl
    product_id = $ProductId
    gates = [ordered]@{}
    verdict = 'BLOCKED'
    blocker = $null
    elapsed_seconds = 0
}

function Get-Json([string]$Url) {
    Invoke-RestMethod -Uri $Url -Method Get -Headers @{ 'Cache-Control' = 'no-cache' }
}

try {
    $health = Get-Json "$BaseUrl/healthz"
    $product = Get-Json "$BaseUrl/api/products/$ProductId"

    $result.gates.health_ok = ($health.status -eq 'ok')
    $result.gates.stripe_configured = [bool]$health.stripe_configured
    $result.gates.webhook_configured = [bool]$health.webhook_configured
    $result.gates.product_found = ($product.id -eq $ProductId)
    $result.gates.product_published = ($product.status -eq 'published')
    $result.gates.inventory_available = ([int]$product.inventory -gt 0)
    $result.gates.approval_off = (-not [bool]$product.approval_required)
    $result.gates.checkout_available = [bool]$product.checkout_available

    if (-not $result.gates.health_ok) { $result.blocker = 'healthz_not_ok' }
    elseif (-not $result.gates.product_found) { $result.blocker = 'product_not_found' }
    elseif (-not $result.gates.product_published) { $result.blocker = 'product_not_published' }
    elseif (-not $result.gates.inventory_available) { $result.blocker = 'inventory_unavailable' }
    elseif (-not $result.gates.approval_off) { $result.blocker = 'approval_gate_on' }
    elseif (-not $result.gates.stripe_configured) { $result.blocker = 'STRIPE_SECRET_KEY_not_configured' }
    elseif (-not $result.gates.webhook_configured) { $result.blocker = 'STRIPE_WEBHOOK_SECRET_not_configured' }
    elseif (-not $result.gates.checkout_available) { $result.blocker = 'checkout_not_available' }
    else {
        $result.verdict = 'CHECKOUT_READY_PAYMENT_UNPROVEN'
        $result.blocker = 'REAL_BUYER_REQUIRED'
    }
}
catch {
    $result.verdict = 'BLOCKED'
    $result.blocker = $_.Exception.Message
}
finally {
    $result.elapsed_seconds = [math]::Round(((Get-Date) - $started).TotalSeconds, 3)
    $parent = Split-Path -Parent $ProofPath
    if ($parent -and -not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    $result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ProofPath -Encoding ASCII
}

Write-Host "VERDICT: $($result.verdict)"
Write-Host "BLOCKER: $($result.blocker)"
Write-Host "PROOF: $ProofPath"
Write-Host "NEXT: remove the blocker, then send the checkout URL to a real buyer."
exit $(if ($result.verdict -eq 'CHECKOUT_READY_PAYMENT_UNPROVEN') { 0 } else { 1 })
