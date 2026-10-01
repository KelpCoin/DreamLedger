#requires -Version 5.1
[CmdletBinding()]
param(
    [switch]$Live,
    [string]$WantedText = 'I want a FUBU jacket, XL or 2XL, vintage 1990s/2000s, black or red, under NZ$120'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$proofDir = Join-Path $repoRoot 'proof\ebay'
$proofPath = Join-Path $proofDir 'latest-wanted-hunt-proof.json'
New-Item -ItemType Directory -Force -Path $proofDir | Out-Null

if (-not $Live) {
    Write-Host 'REFUSED: live eBay proof requires -Live.' -ForegroundColor Yellow
    exit 2
}
if (-not $env:EBAY_APP_ID -or -not $env:EBAY_CERT_ID) {
    Write-Host 'FAIL: EBAY_APP_ID and EBAY_CERT_ID must exist in the process environment.' -ForegroundColor Red
    exit 1
}

$env:BECK_WANTED_TEXT = $WantedText
$env:BECK_PROOF_PATH = $proofPath

python (Join-Path $repoRoot 'beck\ebay\wanted_hunt.py')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

python (Join-Path $repoRoot 'beck\proof\verify_ebay_proof.py') $proofPath
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "PROOF=$proofPath" -ForegroundColor Green
Write-Host 'EBAY-001 remains UNPROVEN unless the verifier reports overall=true AND the artifact is independently reviewed.' -ForegroundColor Yellow
