#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$RepoRoot = (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
)

$ErrorActionPreference = 'Stop'
$registryPath = Join-Path $RepoRoot 'BEC-PRIME\manifests\architecture-registry.json'
$proofPath = Join-Path $RepoRoot 'PROOF-REGISTRY-VERIFICATION.json'
$validStates = @('implemented','specified','backlog','external_blocked','approval_gated','unproven')
$errors = New-Object System.Collections.Generic.List[string]
$checked = New-Object System.Collections.Generic.List[string]

function Check-Path([string]$RelativePath) {
    $full = Join-Path $RepoRoot $RelativePath
    if (-not (Test-Path -LiteralPath $full)) {
        $script:errors.Add("MISSING_PATH:$RelativePath")
    } else {
        $script:checked.Add($RelativePath)
    }
}

try {
    if (-not (Test-Path -LiteralPath $registryPath)) {
        throw "Registry not found: $registryPath"
    }

    $registry = Get-Content -LiteralPath $registryPath -Raw | ConvertFrom-Json

    if ($registry.version -ne '1.0') { $errors.Add('INVALID_VERSION') }
    if ($registry.authority -ne 'repository') { $errors.Add('INVALID_AUTHORITY') }

    foreach ($name in $registry.components.PSObject.Properties.Name) {
        $component = $registry.components.$name
        if ($validStates -notcontains [string]$component.state) {
            $errors.Add("INVALID_STATE:$name:$($component.state)")
        }
        if ($component.path) { Check-Path ([string]$component.path) }
        if ($component.proof_artifact -and $component.state -eq 'implemented') {
            $proof = [string]$component.proof_artifact
            if ($proof -ne 'FIRST_PAYMENT_PROOF.json') {
                Check-Path $proof
            }
        }
    }

    $productPath = Join-Path $RepoRoot 'BEC-PRIME\catalog\products\COMMANDER-DECK-DIAGNOSTIC-001.json'
    if (-not (Test-Path -LiteralPath $productPath)) {
        $errors.Add('MISSING_COMMANDER_PRODUCT')
    } else {
        $product = Get-Content -LiteralPath $productPath -Raw | ConvertFrom-Json
        if ($product.id -ne 'COMMANDER-DECK-DIAGNOSTIC-001') { $errors.Add('COMMANDER_ID_MISMATCH') }
        if ([decimal]$product.price -ne 15) { $errors.Add('COMMANDER_PRICE_MISMATCH') }
        if ([bool]$product.approval_required -ne $true) { $errors.Add('APPROVAL_GATE_NOT_TRUE') }
    }

    if ($registry.components.x402_payment_adapter.state -ne 'backlog') {
        $errors.Add('X402_MUST_REMAIN_BACKLOG')
    }

    if ($registry.components.render_deployment.state -ne 'external_blocked') {
        $errors.Add('RENDER_MUST_REMAIN_EXTERNAL_BLOCKED_UNTIL_LIVE_VERIFIED')
    }

    if ($registry.components.first_payment_proof.state -ne 'unproven') {
        $errors.Add('FIRST_PAYMENT_PROOF_MUST_REMAIN_UNPROVEN')
    }

    $result = if ($errors.Count -eq 0) { 'PASS' } else { 'FAIL' }
    $artifact = [ordered]@{
        schema = 'BEC-PRIME/PROOF-REGISTRY-VERIFICATION/v1'
        result = $result
        registry = 'BEC-PRIME/manifests/architecture-registry.json'
        checked_paths = @($checked)
        errors = @($errors)
        policy_checks = [ordered]@{
            x402_backlog = ($registry.components.x402_payment_adapter.state -eq 'backlog')
            render_external_blocked = ($registry.components.render_deployment.state -eq 'external_blocked')
            first_payment_unproven = ($registry.components.first_payment_proof.state -eq 'unproven')
            commander_approval_required = ($registry.components.commander_deck_diagnostic.approval_required -eq $true)
        }
    }
    $artifact | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $proofPath -Encoding UTF8

    Write-Host "REGISTRY_VERIFICATION=$result"
    Write-Host "PROOF=$proofPath"
    if ($errors.Count -gt 0) {
        foreach ($errorText in $errors) { Write-Host "ERROR=$errorText" }
        exit 1
    }
    exit 0
}
catch {
    $failure = [ordered]@{
        schema = 'BEC-PRIME/PROOF-REGISTRY-VERIFICATION/v1'
        result = 'FAIL'
        error = $_.Exception.Message
    }
    $failure | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $proofPath -Encoding UTF8
    Write-Host "REGISTRY_VERIFICATION=FAIL"
    Write-Host "PROOF=$proofPath"
    Write-Host "ERROR=$($_.Exception.Message)"
    exit 1
}
