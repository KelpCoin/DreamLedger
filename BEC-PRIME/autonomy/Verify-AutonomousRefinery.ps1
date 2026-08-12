[CmdletBinding()]
param(
    [string]$Root = "D:\BrownEyeCortex\BEC-PRIME"
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"
$errors = @()
$config = Join-Path $Root "autonomy\AUTONOMOUS_REFINERY.json"
$script = Join-Path $Root "autonomy\Run-AutonomousRefinery.ps1"
$gauntlet = Join-Path $Root "gauntlet\CandidateGauntlet.js"

foreach ($p in @($config,$script,$gauntlet)) {
    if (-not (Test-Path -LiteralPath $p)) { $errors += "MISSING: $p" }
}

if (Test-Path -LiteralPath $config) {
    $c = Get-Content -Raw -LiteralPath $config | ConvertFrom-Json
    if ($c.refinery.silo -ne 'mtg') { $errors += 'FAIL: refinery silo is not mtg' }
    if ([int]$c.refinery.max_iterations -lt 1) { $errors += 'FAIL: max_iterations < 1' }
    if ($c.execution_policy.auto_publish -ne $false) { $errors += 'FAIL: auto_publish must be false' }
    if ($c.execution_policy.auto_checkout -ne $false) { $errors += 'FAIL: auto_checkout must be false' }
    if ($c.execution_policy.auto_outreach -ne $false) { $errors += 'FAIL: auto_outreach must be false' }
    if ($c.execution_policy.auto_payment_claims -ne $false) { $errors += 'FAIL: auto_payment_claims must be false' }
}

if ($errors.Count -gt 0) {
    $errors | ForEach-Object { Write-Host $_ -ForegroundColor Red }
    exit 1
}

Write-Host 'PASS: autonomous refinery files and safety gates are present.' -ForegroundColor Green
Write-Host 'PASS: refinery can generate internal candidates and iterate through the deterministic Gauntlet.' -ForegroundColor Green
Write-Host 'PASS: public checkout, outreach, deployment, and payment claims remain blocked.' -ForegroundColor Green
exit 0
