#requires -Version 5.1
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Root = 'D:\BrownEyeCortex\Cortex'
$ProofRoot = 'D:\BrownEyeCortex\InverseShopping\proof'
$Log = 'D:\BECK-HARDENING-PAYLOAD-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log'

New-Item -ItemType Directory -Force -Path $Root,$ProofRoot | Out-Null

function Log([string]$Message) {
    $line = '[' + (Get-Date -Format 's') + '] ' + $Message
    Add-Content -Path $Log -Value $line -Encoding ASCII
    Write-Host $line
}

Log 'BECK/DreamLedger hardening payload start'

$required = @(
    "$Root\scripts\Verify-Cortex.ps1",
    'D:\BrownEyeCortex\Kelplantis\public\index.html',
    'D:\BrownEyeCortex\3MV6\compiler\compiler.py'
)

$checks = @()
foreach ($path in $required) {
    $exists = Test-Path -LiteralPath $path
    $checks += [ordered]@{ path = $path; exists = [bool]$exists }
    if ($exists) { Log "PASS existing artifact: $path" }
    else { Log "WARN missing artifact: $path" }
}

$proof = [ordered]@{
    schema_version = 'beck-payload-proof-1'
    bootstrap_version = '6.0-H'
    timestamp_utc = (Get-Date).ToUniversalTime().ToString('o')
    public_actions_performed = $false
    commercial_signal = 'UNPROVEN'
    verified_revenue_nzd = 0
    checkout = 'Commander Deck Diagnostic NZD 29 one-time'
    github_branch = 'hardening/kelplantis-revenue-gate-6-0-h'
    checks = $checks
}

$proofPath = Join-Path $ProofRoot ('BECK-PAYLOAD-PROOF-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.json')
$proof | ConvertTo-Json -Depth 10 | Set-Content -Path $proofPath -Encoding ASCII
Log "PROOF=$proofPath"
Log 'PUBLIC_ACTIONS=False'
Log 'COMMERCIAL_SIGNAL=UNPROVEN'
Log 'VERIFIED_REVENUE_NZD=0'
Log 'BECK PAYLOAD COMPLETE'

Write-Host ''
Write-Host '60-SECOND VERIFY:' -ForegroundColor Cyan
Write-Host "powershell -NoProfile -ExecutionPolicy Bypass -File `"$Root\scripts\Verify-Cortex.ps1`""
Write-Host ''
Write-Host "PROOF: $proofPath" -ForegroundColor Green
