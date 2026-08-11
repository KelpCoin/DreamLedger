#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$RepoRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
$registryPath = Join-Path $RepoRoot 'BEC-PRIME\manifests\architecture-registry.json'
$ipCatalogPath = Join-Path $RepoRoot 'BEC-PRIME\catalog\ip-capabilities.json'
$proofPath = Join-Path $RepoRoot 'PROOF-REGISTRY-VERIFICATION.json'
$validStates = @('implemented','specified','backlog','external_blocked','approval_gated','unproven')
$errors = New-Object System.Collections.Generic.List[string]
$checked = New-Object System.Collections.Generic.List[string]
$verified = New-Object System.Collections.Generic.List[string]

function Add-Error([string]$Code) { $script:errors.Add($Code) }
function Get-JsonFile([string]$RelativePath,[string]$Label) {
    $full = Join-Path $RepoRoot $RelativePath
    if (-not (Test-Path -LiteralPath $full)) { Add-Error ("MISSING_JSON:{0}:{1}" -f $Label,$RelativePath); return $null }
    try { return (Get-Content -LiteralPath $full -Raw | ConvertFrom-Json) }
    catch { Add-Error ("INVALID_JSON:{0}:{1}" -f $Label,$RelativePath); return $null }
}
function Check-NoSecrets([string]$Text) {
    foreach ($pattern in @('sk_live_', 'sk_test_', 'whsec_', 'PRIVATE KEY', 'BEGIN RSA PRIVATE KEY', 'BEGIN OPENSSH PRIVATE KEY')) {
        if ($Text -match [regex]::Escape($pattern)) { Add-Error ("SECRET_PATTERN:{0}" -f $pattern) }
    }
}

try {
    $registry = Get-JsonFile 'BEC-PRIME\manifests\architecture-registry.json' 'registry'
    if ($null -eq $registry) { throw 'Registry could not be parsed.' }
    if ([int]($registry.version -replace '[^0-9].*','') -lt 1) { Add-Error 'INVALID_VERSION' }
    if ([string]$registry.registry_id -ne 'BEC-PRIME-ARCHITECTURE') { Add-Error 'INVALID_REGISTRY_ID' }
    if ([string]$registry.authority -ne 'repository') { Add-Error 'INVALID_AUTHORITY' }

    $policy = $registry.compiler_policy
    if ([bool]$policy.never_infer_proof_from_design -ne $true) { Add-Error 'POLICY_PROOF_INFERENCE_NOT_DISABLED' }
    if ([bool]$policy.never_mark_external_state_as_live_without_observation -ne $true) { Add-Error 'POLICY_EXTERNAL_LIVE_INFERENCE_NOT_DISABLED' }
    if ([bool]$policy.never_disable_human_approval_implicitly -ne $true) { Add-Error 'POLICY_IMPLICIT_APPROVAL_NOT_DISABLED' }
    if ([bool]$policy.never_publish_credentials_or_customer_data -ne $true) { Add-Error 'POLICY_SECRET_PUBLICATION_NOT_DISABLED' }

    $componentNames = @($registry.components.PSObject.Properties.Name)
    $componentSet = @{}
    foreach ($name in $componentNames) { $componentSet[$name] = $true }
    foreach ($name in $componentNames) {
        $component = $registry.components.$name
        $state = [string]$component.state
        if ($validStates -notcontains $state) { Add-Error ("INVALID_STATE:{0}:{1}" -f $name,$state) }
        if ($component.path -and -not [string]$component.path.StartsWith('/')) {
            $full = Join-Path $RepoRoot ([string]$component.path)
            if (-not (Test-Path -LiteralPath $full)) { Add-Error ("MISSING_PATH:{0}:{1}" -f $name,$component.path) } else { $checked.Add([string]$component.path) }
        }
        foreach ($dep in @($component.depends_on)) {
            if ($dep -and -not $componentSet.ContainsKey([string]$dep)) { Add-Error ("MISSING_DEPENDENCY:{0}:{1}" -f $name,$dep) }
        }
    }

    $product = Get-JsonFile 'BEC-PRIME\catalog\products\COMMANDER-DECK-DIAGNOSTIC-001.json' 'commander_product'
    if ($null -ne $product) {
        if ([string]$product.id -ne 'COMMANDER-DECK-DIAGNOSTIC-001') { Add-Error 'COMMANDER_ID_MISMATCH' }
        if ([decimal]$product.price -ne 1500) { Add-Error 'COMMANDER_PRICE_MISMATCH' }
        if ([string]$product.currency -ne 'nzd') { Add-Error 'COMMANDER_CURRENCY_MISMATCH' }
        if ([bool]$product.commercial_truth.approval_required -ne $true) { Add-Error 'APPROVAL_GATE_NOT_TRUE' }
        $verified.Add('commander_product:1500_minor_units_NZD_approval_locked')
    }

    $ip = Get-JsonFile 'BEC-PRIME\catalog\ip-capabilities.json' 'ip_capability_catalog'
    if ($null -ne $ip) {
        $ipRaw = Get-Content -LiteralPath $ipCatalogPath -Raw
        Check-NoSecrets $ipRaw
        if ([string]$ip.schema -ne 'BEC-PRIME/IP-CAPABILITY-CATALOG/v1') { Add-Error 'INVALID_IP_CATALOG_SCHEMA' }
        if (-not $ip.capabilities) { Add-Error 'EMPTY_IP_CAPABILITY_CATALOG' }
        $ids = @($ip.capabilities | ForEach-Object { [string]$_.id })
        if (($ids | Sort-Object -Unique).Count -ne $ids.Count) { Add-Error 'DUPLICATE_IP_CAPABILITY_IDS' }
        $verified.Add('ip_catalog:internal_schema_unique_ids_secret_scan')
    }

    $surfaceManifest = Get-JsonFile 'BEC-PRIME\manifests\CUBE-PUBLIC-SURFACE-MANIFEST.json' 'public_surface_manifest'
    if ($null -ne $surfaceManifest) {
        if ([bool]$surfaceManifest.surface_policy.internal_capability_catalog_public -ne $false) { Add-Error 'PRIVATE_IP_PUBLIC_POLICY_NOT_FALSE' }
        if (-not $surfaceManifest.private_surfaces) { Add-Error 'PRIVATE_SURFACE_BOUNDARY_MISSING' }
        $verified.Add('public_surface:private_ip_catalog_removed')
    }

    $serverPath = Join-Path $RepoRoot 'BEC-PRIME\server.js'
    if (-not (Test-Path -LiteralPath $serverPath)) { Add-Error 'MISSING_SERVER_JS' }
    else {
        $server = Get-Content -LiteralPath $serverPath -Raw
        foreach ($route in @('/healthz','/api/products','/api/offers','/api/checkout/create','/webhook')) {
            if ($server.IndexOf($route,[System.StringComparison]::OrdinalIgnoreCase) -lt 0) { Add-Error ("SERVER_ROUTE_MISSING:{0}" -f $route) }
        }
        if ($server.IndexOf("url==='/api/ip'",[System.StringComparison]::OrdinalIgnoreCase) -ge 0) { Add-Error 'PRIVATE_IP_ROUTE_STILL_PUBLIC' }
        foreach ($needle in @('process.env.PORT','approval_required','STRIPE_WEBHOOK_SECRET','event.id','revenueLedger.recordPayment','createFulfillment')) {
            if ($server.IndexOf($needle,[System.StringComparison]::OrdinalIgnoreCase) -lt 0) { Add-Error ("SERVER_CONTRACT_MISSING:{0}" -f $needle) }
        }
        $verified.Add('server:public_routes_checkout_signed_webhook_ledger_fulfillment')
    }

    if ([string]$registry.components.x402_payment_adapter.state -ne 'backlog') { Add-Error 'X402_MUST_REMAIN_BACKLOG' }
    if ([string]$registry.components.render_deployment.state -ne 'external_blocked') { Add-Error 'RENDER_MUST_REMAIN_EXTERNAL_BLOCKED_UNTIL_LIVE_VERIFIED' }
    if ([string]$registry.components.first_payment_proof.state -ne 'unproven') { Add-Error 'FIRST_PAYMENT_PROOF_MUST_REMAIN_UNPROVEN' }

    $result = if ($errors.Count -eq 0) { 'PASS' } else { 'FAIL' }
    $artifact = [ordered]@{
        schema = 'BEC-PRIME/PROOF-REGISTRY-VERIFICATION/v3'
        result = $result
        generated_at_utc = [DateTime]::UtcNow.ToString('o')
        checked_paths = @($checked | Sort-Object -Unique)
        verified_claims = @($verified | Sort-Object -Unique)
        errors = @($errors)
        live_state = [ordered]@{
            render = 'NOT_OBSERVED_BY_GITHUB_CONNECTOR'
            production_healthz = 'NOT_OBSERVED'
            first_payment = 'UNPROVEN'
        }
    }
    $artifact | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $proofPath -Encoding UTF8
    Write-Host "REGISTRY_VERIFICATION=$result"
    Write-Host "PROOF=$proofPath"
    foreach ($errorText in $errors) { Write-Host "ERROR=$errorText" }
    if ($errors.Count -gt 0) { exit 1 }
    exit 0
}
catch {
    $failure = [ordered]@{ schema='BEC-PRIME/PROOF-REGISTRY-VERIFICATION/v3'; result='FAIL'; generated_at_utc=[DateTime]::UtcNow.ToString('o'); error=$_.Exception.Message }
    $failure | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $proofPath -Encoding UTF8
    Write-Host 'REGISTRY_VERIFICATION=FAIL'
    Write-Host "PROOF=$proofPath"
    Write-Host "ERROR=$($_.Exception.Message)"
    exit 1
}
