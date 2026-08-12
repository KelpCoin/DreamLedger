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
    [string]$SourceTemplate = 'DreamLedger-CUBE-v1'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$manifestDir = Join-Path $root 'cube\manifests'
$proofDir = Join-Path $root 'proofs'
New-Item -ItemType Directory -Force -Path $manifestDir,$proofDir | Out-Null

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
    created_utc = (Get-Date).ToUniversalTime().ToString('o')
}

$manifestPath = Join-Path $manifestDir ($SiloName + '.json')
$manifestJson = $manifest | ConvertTo-Json -Depth 10
if ($PSCmdlet.ShouldProcess($manifestPath,'Write CUBE clone manifest')) {
    Set-Content -LiteralPath $manifestPath -Value $manifestJson -Encoding UTF8
}

$proof = [ordered]@{
    schema = 'BEC-CUBE-CLONE-PROOF-1.0'
    event = 'CUBE_CLONE_MANIFEST_CREATED'
    silo_name = $SiloName
    product_name = $ProductName
    price_nzd = $PriceNZD
    repo_name = $RepoName
    domain = $Domain
    isolation = $true
    public_posting = 'approval_required'
    payment_claim = 'none'
    timestamp_utc = (Get-Date).ToUniversalTime().ToString('o')
}
$proofPath = Join-Path $proofDir ('PROOF-CUBE-' + $SiloName + '.json')
if ($PSCmdlet.ShouldProcess($proofPath,'Write CUBE proof artifact')) {
    Set-Content -LiteralPath $proofPath -Value ($proof | ConvertTo-Json -Depth 10) -Encoding UTF8
}

Write-Output "CUBE manifest ready: $manifestPath"
Write-Output "CUBE proof ready:    $proofPath"
Write-Output "No deployment performed. No public post performed. No payment claimed."
