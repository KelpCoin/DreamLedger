#requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$ProofPath
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Fail([string]$Message) {
    Write-Host ('FAIL: ' + $Message)
    exit 1
}

if (-not (Test-Path -LiteralPath $ProofPath -PathType Leaf)) {
    Fail ('Proof file not found: ' + $ProofPath)
}

$raw = [IO.File]::ReadAllText($ProofPath)
if ([string]::IsNullOrWhiteSpace($raw)) {
    Fail 'Proof file is empty.'
}

try {
    $proof = $raw | ConvertFrom-Json
} catch {
    Fail 'Proof is not valid JSON.'
}

if ([string]::IsNullOrWhiteSpace([string]$proof.schema_version)) {
    Fail 'schema_version missing.'
}

if ([string]$proof.source_feasibility -ne 'PASS') {
    Fail ('source_feasibility is not PASS: ' + [string]$proof.source_feasibility)
}

$required = @(
    'G01_CONFIG_PRESENT',
    'G02_CREDENTIALS_AVAILABLE',
    'G03_OAUTH_REQUESTED',
    'G04_OAUTH_ACCEPTED',
    'G05_ACCESS_TOKEN_OBTAINED',
    'G06_SEARCH_REQUEST_CAPTURED',
    'G07_SEARCH_RESPONSE_CAPTURED',
    'G08_HTTP_SUCCESS',
    'G09_RESULTS_RETURNED',
    'G10_CANDIDATES_NORMALIZED',
    'G11_ITEM_DETAIL_CAPTURED',
    'G12_SOURCE_CURRENCY_VERIFIED',
    'G13_SHIPPING_DATA_VERIFIED',
    'G14_NZ_DELIVERY_ASSESSED',
    'G15_PRICE_CAP_ASSESSED',
    'G16_MATCH_DIMENSIONS_COMPUTED',
    'G17_PROOF_HASHED',
    'G18_PROOF_VERIFIED'
)

foreach ($gate in $required) {
    $value = [string]$proof.gates.$gate
    if ($value -ne 'PASS') {
        Fail ($gate + ' is not PASS.')
    }
}

if ([string]::IsNullOrWhiteSpace([string]$proof.wanted_id)) {
    Fail 'wanted_id missing.'
}

if ([string]$proof.actual_response.http_status -ne '200') {
    Fail 'actual_response.http_status is not 200.'
}

if ([int]$proof.actual_response.result_count -lt 1) {
    Fail 'No source results recorded.'
}

if ([string]::IsNullOrWhiteSpace([string]$proof.actual_response.raw_hash)) {
    Fail 'Raw response hash missing.'
}

if ([string]$proof.commercial_signal -eq 'PROVEN') {
    Write-Host 'WARNING: commercial_signal=PROVEN must be backed by independent payment evidence.'
}

Write-Host 'PASS: economic source proof structure is internally consistent.'
Write-Host ('PROOF: ' + (Resolve-Path -LiteralPath $ProofPath).Path)
exit 0
