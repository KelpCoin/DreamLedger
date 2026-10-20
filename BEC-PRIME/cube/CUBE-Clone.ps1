[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-z0-9_-]+$')][string]$SiloName,
    [Parameter(Mandatory=$true)][string]$ProductName,
    [Parameter(Mandatory=$true)][ValidateRange(1,1000000)][int]$PriceNZD,
    [Parameter(Mandatory=$true)][string]$StripeProductId,
    [Parameter(Mandatory=$true)][string]$Domain,
    [Parameter(Mandatory=$true)][string]$RepoName,
    [string]$Surface = 'commerce',
    [ValidateSet('template','approved','deployed','retired')][string]$Status = 'template',
    [string]$SourceTemplate = 'DreamLedger-CUBE-v1',
    [switch]$EnforceCloneContract
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$manifestDir = Join-Path $root 'cube\manifests'
$proofDir = Join-Path $root 'proofs'
New-Item -ItemType Directory -Force -Path $manifestDir,$proofDir | Out-Null

$policyPath = Join-Path $root 'cube\CUBE-CLONE-CONTRACT.json'
$validatorPath = Join-Path $root 'scripts\validate-silo-clone-manifest.js'
if (-not (Test-Path -LiteralPath $policyPath)) { throw "Clone policy missing: $policyPath" }
if (-not (Test-Path -LiteralPath $validatorPath)) { throw "Clone contract validator missing: $validatorPath" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js is required to run the silo clone contract gate.' }

$policy = Get-Content -LiteralPath $policyPath -Raw | ConvertFrom-Json
if (-not $policy.clone_contract_defaults) { throw 'Canonical clone policy has no clone_contract_defaults.' }
$cloneContract = $policy.clone_contract_defaults | ConvertTo-Json -Depth 20 | ConvertFrom-Json
$cloneContract | Add-Member -NotePropertyName silo_id -NotePropertyValue $SiloName -Force
$overrides = $policy.silo_overrides
if ($overrides) {
    $siloProperty = $overrides.PSObject.Properties[$SiloName]
    if ($siloProperty -and $siloProperty.Value.fee_policy) {
        $cloneContract.fee_policy = $siloProperty.Value.fee_policy
    }
}
if ($SiloName -eq 'mtg' -and ($cloneContract.fee_policy.platform_fee_bps -ne 0 -or $cloneContract.fee_policy.zero_fee_override -ne $true)) {
    throw 'Canonical policy must preserve MTG permanent 0% platform-fee override.'
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$manifestPath = Join-Path $manifestDir ($SiloName + '.json')
$proofPath = Join-Path $proofDir ('PROOF-CUBE-' + $SiloName + '.json')
$verdictPath = Join-Path $proofDir ("CUBE-CLONE-VERDICT-" + $SiloName + "-" + $stamp + ".json")

$manifest = [ordered]@{
    cube_version = '1.0'
    silo_name = $SiloName
    product_name = $ProductName
    price_nzd = $PriceNZD
    stripe_product_id = $StripeProductId
    domain = $Domain
    repo_name = $RepoName
    surface = $Surface
    status = $Status
    source_template = $SourceTemplate
    isolation = $true
    clone_contract = $cloneContract
    created_utc = (Get-Date).ToUniversalTime().ToString('o')
}
$manifestJson = $manifest | ConvertTo-Json -Depth 20
if ($PSCmdlet.ShouldProcess($manifestPath,'Write CUBE clone manifest')) {
    Set-Content -LiteralPath $manifestPath -Value $manifestJson -Encoding UTF8
}

# Advisory is the default. It emits a durable verdict but does not block generating
# a reversible template. Enforcement requires an Ed25519 key and an explicit switch.
$gateMode = if ($EnforceCloneContract) { 'enforce' } else { 'advisory' }
$gateArgs = @($validatorPath, $manifestPath, "--mode=$gateMode")
if ($EnforceCloneContract) { $gateArgs += '--require-signature' }
$verdictText = & node @gateArgs
$nodeExit = $LASTEXITCODE
if ($nodeExit -ne 0) {
    throw "Clone contract validator exited $nodeExit. Review validator output before retrying."
}
$verdict = $verdictText | ConvertFrom-Json
if ($PSCmdlet.ShouldProcess($verdictPath,'Write clone contract verdict')) {
    Set-Content -LiteralPath $verdictPath -Value ($verdict | ConvertTo-Json -Depth 20) -Encoding UTF8
}
if ($verdict.verdict.status -ne 'PASS') {
    Write-Warning ("CLONE_CONTRACT_ADVISORY_BLOCK: " + (($verdict.verdict.errors | ForEach-Object { $_.code }) -join ', '))
    if ($EnforceCloneContract) { throw 'Clone blocked by fail-closed contract enforcement.' }
}
if ($EnforceCloneContract -and $verdict.signing.status -ne 'SIGNED') {
    throw 'Enforced clone gate requires a signed Ed25519 verdict.'
}

$proofState = if ($verdict.verdict.status -eq 'PASS') { 'PASS' } else { 'ADVISORY_BLOCK' }
$proof = [ordered]@{
    schema = 'BEC-CUBE-CLONE-PROOF-1.1'
    event = 'CUBE_CLONE_MANIFEST_CREATED'
    status = $proofState
    silo_name = $SiloName
    product_name = $ProductName
    price_nzd = $PriceNZD
    repo_name = $RepoName
    domain = $Domain
    isolation = $true
    clone_contract_verdict_path = [System.IO.Path]::GetRelativePath($root, $verdictPath).Replace('\','/')
    clone_contract_status = $verdict.verdict.status
    clone_contract_mode = $gateMode.ToUpperInvariant()
    clone_contract_signing_status = $verdict.signing.status
    public_posting = 'approval_required'
    payment_claim = 'none'
    public_activation = 'NOT_CLAIMED'
    timestamp_utc = (Get-Date).ToUniversalTime().ToString('o')
}
if ($PSCmdlet.ShouldProcess($proofPath,'Write CUBE proof artifact')) {
    Set-Content -LiteralPath $proofPath -Value ($proof | ConvertTo-Json -Depth 20) -Encoding UTF8
}

Write-Output "CUBE manifest ready: $manifestPath"
Write-Output "CUBE contract verdict: $verdictPath"
Write-Output "CUBE proof ready: $proofPath"
Write-Output "Contract status: $($verdict.verdict.status) ($gateMode)"
Write-Output "No deployment performed. No public post performed. No payment claimed."
