#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$RepoRoot = (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)),
    [string]$Python = "python",
    [string]$Fixture = (Join-Path $PSScriptRoot "..\..\runtime\lm_studio\fixtures\supplier_quote_signal.json")
)
$ErrorActionPreference = "Stop"
$proofDir = Join-Path $RepoRoot "runtime\lm_studio\runs"
New-Item -ItemType Directory -Force -Path $proofDir | Out-Null
$out = & $Python (Join-Path $RepoRoot "runtime\lm_studio\local_cortex_lmstudio_ingest.py") --signal-file $Fixture 2>&1
if ($LASTEXITCODE -ne 0) { throw "Local Cortex verification failed: $out" }
$result = $out | ConvertFrom-Json
if (-not $result.audit.'10_NEXT_ACTION') { throw "Missing 10-point audit output" }
if (-not $result.gauntlet.decision) { throw "Existing CORTEX Gauntlet was not reached" }
if ($result.external_action_taken -ne $false) { throw "External action invariant violated" }
if ($result.revenue_claim -ne $false) { throw "Revenue claim invariant violated" }
$proof = [ordered]@{
    schema = "BEC/LOCAL-CORTEX-LMSTUDIO-VERIFICATION/v1"
    verified_at_utc = (Get-Date).ToUniversalTime().ToString("o")
    status = "PASS"
    gauntlet_decision = $result.gauntlet.decision
    checkout_decision = $result.checkout_decision
    external_action_taken = $result.external_action_taken
    revenue_claim = $result.revenue_claim
}
$path = Join-Path $proofDir "LOCAL-CORTEX-LMSTUDIO-VERIFICATION-LATEST.json"
$proof | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $path -Encoding ASCII
Write-Host "PASS"
Write-Host "PROOF=$path"
Write-Host "GAUNTLET_DECISION=$($result.gauntlet.decision)"
Write-Host "CHECKOUT_DECISION=$($result.checkout_decision.status)"
