$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$website = Join-Path $root 'compiled\website'
$workflow = Join-Path $root '..\.github\workflows\release-operator.yml'
$mtg = Join-Path $root '..\.github\workflows\mtg-first-sale-gate.yml'
$vercel = Join-Path $website 'vercel.json'

$checks = @()

function Add-Check([string]$Name, [bool]$Pass, [string]$Detail) {
    $script:checks += [pscustomobject]@{
        name = $Name
        status = $(if ($Pass) { 'PASS' } else { 'FAIL' })
        detail = $Detail
    }
    if (-not $Pass) { throw "$Name : $Detail" }
}

Add-Check 'VERCEL_CONFIG_EXISTS' (Test-Path -LiteralPath $vercel) $vercel
Add-Check 'VERCEL_GIT_DEPLOYMENT_DISABLED' $false 'not checked'
$vc = Get-Content -LiteralPath $vercel -Raw | ConvertFrom-Json
Add-Check 'VERCEL_GIT_DEPLOYMENT_DISABLED' ([bool]($vc.git.deploymentEnabled -eq $false)) 'git.deploymentEnabled must be false'

Add-Check 'RELEASE_OPERATOR_EXISTS' (Test-Path -LiteralPath $workflow) $workflow
$release = Get-Content -LiteralPath $workflow -Raw
Add-Check 'RELEASE_OPERATOR_REQUIRES_CONFIRM' ($release -match "inputs\.deploy != 'confirm'") 'production deployment must remain approval-gated'
Add-Check 'RELEASE_OPERATOR_RUNS_MTG_GATE' ($release -match 'gh workflow run mtg-first-sale-gate\.yml') 'release must dispatch MTG readiness before Vercel'
Add-Check 'RELEASE_OPERATOR_WAITS_FOR_MTG_GATE' ($release -match 'gh run watch.*steps\.readiness\.outputs\.run_id') 'release must wait for readiness result'
Add-Check 'RELEASE_OPERATOR_RUNS_VERCEL' ($release -match 'gh workflow run vercel-static-deploy\.yml') 'release must dispatch canonical Vercel workflow'

Add-Check 'MTG_GATE_EXISTS' (Test-Path -LiteralPath $mtg) $mtg
$mtgText = Get-Content -LiteralPath $mtg -Raw
Add-Check 'MTG_GATE_ACCEPTS_OFFER_ID' ($mtgText -match "item\.get\('offer_id'\)") 'public offer identity must accept canonical offer_id'
Add-Check 'MTG_GATE_CHECKS_PRICE' ($mtgText -match 'PUBLIC_MTG_PRICE_MISMATCH') 'public price must be validated'
Add-Check 'MTG_GATE_CHECKS_CHECKOUT' ($mtgText -match 'checkout_available') 'checkout availability must be validated when exposed'

$proofDir = Join-Path $root '..\PROOFS'
New-Item -ItemType Directory -Force -Path $proofDir | Out-Null
$proof = [ordered]@{
    schema = 'dreamledger-cicd-release-hardening-v1'
    status = 'PASS'
    what_changed = @(
        'Disabled automatic Vercel Git deployments in the compiled website configuration.',
        'Made production release operator require MTG first-sale readiness before Vercel deployment.',
        'Hardened MTG public offer identity check to accept canonical offer_id.',
        'Added explicit public currency and checkout checks.',
        'Added this fail-closed verifier and proof emission.'
    )
    files = @(
        'BEC-PRIME/compiled/website/vercel.json',
        '.github/workflows/release-operator.yml',
        '.github/workflows/mtg-first-sale-gate.yml',
        'BEC-PRIME/scripts/Verify-CICDReleaseHardening.ps1'
    )
    verification_command = 'pwsh -NoProfile -File BEC-PRIME/scripts/Verify-CICDReleaseHardening.ps1'
    result = 'PASS'
    timestamp_utc = (Get-Date).ToUniversalTime().ToString('o')
    agent = 'GPT-5.6 Luna'
    confidence = 'HIGH for repository configuration; production deployment remains externally blocked until Vercel project/token access is proven.'
    remaining_risks = @(
        'Vercel team currently exposes zero projects through connected Vercel tooling.',
        'GitHub Vercel status checks currently fail with build-rate-limit.',
        'VERCEL_TOKEN presence and validity are not externally observable.',
        'Production HTTP and real payment remain unproven.'
    )
}
$proofPath = Join-Path $proofDir 'PROOF-CI-CD-RELEASE-HARDENING.json'
$proof | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $proofPath -Encoding UTF8
Write-Host "STATUS: PASS"
Write-Host "PROOF: $proofPath"
