#requires -Version 5.1
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$StatePath = Join-Path $Root "OFFERS_STATE.json"
$ProofPath = Join-Path $Root "PROOF-CLOSED-LOOP.json"
$ScriptPath = Join-Path $Root "Invoke-BECClosedLoop.ps1"

function Fail([string]$Reason) {
    Write-Output "FAIL"
    Write-Output $Reason
    exit 1
}

if (-not (Test-Path -LiteralPath $ProofPath)) { Fail "Missing PROOF-CLOSED-LOOP.json" }
if (-not (Test-Path -LiteralPath $StatePath)) { Fail "Missing OFFERS_STATE.json" }
if (-not (Test-Path -LiteralPath $ScriptPath)) { Fail "Missing Invoke-BECClosedLoop.ps1" }

try {
    $proof = Get-Content -LiteralPath $ProofPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $state = Get-Content -LiteralPath $StatePath -Raw -Encoding UTF8 | ConvertFrom-Json
} catch {
    Fail "Invalid JSON proof or state: $($_.Exception.Message)"
}

if ($proof.schema_version -ne "BEC-CLOSED-LOOP-PROOF-1.0") { Fail "Unexpected proof schema" }
if ($proof.status -eq "FAIL") { Fail "Loop proof reports FAIL: $($proof.reason)" }
if ($proof.status -eq "BLOCKED") {
    Write-Output "PASS"
    Write-Output "Loop is safely blocked pending explicit BEC_PUBLIC_ACTION_APPROVED=YES"
    exit 0
}
if ($proof.status -ne "PASS") { Fail "Unknown proof status: $($proof.status)" }

$scriptHash = (Get-FileHash -LiteralPath $ScriptPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($proof.script_sha256 -ne $scriptHash) { Fail "Script SHA mismatch" }

foreach ($offer in @($state.offers)) {
    if ($offer.checkout_created -eq $true -and [string]::IsNullOrWhiteSpace([string]$offer.checkout_url)) {
        Fail "Offer $($offer.offer_id) says checkout_created=true but has no checkout_url"
    }
}

Write-Output "PASS"
Write-Output "Closed loop proof is valid; offer state is internally consistent"
exit 0
