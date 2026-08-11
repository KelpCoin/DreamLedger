#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$ProofRoot = 'D:\BrownEyeCortex\BEC-PRIME\proofs'
)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$NodeScript = Join-Path $Root 'scripts\verify-marketplace-dreamiez.js'
if (-not (Test-Path $NodeScript)) { throw "Missing verifier: $NodeScript" }
New-Item -ItemType Directory -Force -Path $ProofRoot | Out-Null
$Output = & node $NodeScript 2>&1
$Code = $LASTEXITCODE
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$Proof = Join-Path $ProofRoot "MARKETPLACE-DREAMIEZ-$Stamp.txt"
$Output | Set-Content -Path $Proof -Encoding ASCII
if ($Code -ne 0) { throw "Verifier failed. Proof: $Proof" }
Write-Host "PASS: $Proof"
Write-Host "60-second verifier: node `"$NodeScript`""
