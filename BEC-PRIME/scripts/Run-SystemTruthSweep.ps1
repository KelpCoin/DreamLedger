$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

$Base = if ($env:DREAMLEDGER_BASE_URL) { $env:DREAMLEDGER_BASE_URL } else { 'https://dreamledger.org' }
$Expected = if ($env:EXPECTED_SHA) { $env:EXPECTED_SHA } else { '' }
$Root = Split-Path -Parent $PSScriptRoot
$ProofDir = Join-Path $Root 'RUN-PROOFS'
New-Item -ItemType Directory -Force -Path $ProofDir | Out-Null

$env:DREAMLEDGER_BASE_URL = $Base
$env:EXPECTED_SHA = $Expected
$env:PROOF_DIR = $ProofDir

Push-Location $Root
try {
    & node (Join-Path $Root 'scripts\SystemTruthSweep.js')
    $code = $LASTEXITCODE
    if ($code -eq 0) {
        Write-Host 'SYSTEM_TRUTH_PASS' -ForegroundColor Green
    } else {
        Write-Host "SYSTEM_TRUTH_FAIL exit=$code" -ForegroundColor Red
    }
    Write-Host "Proof: $(Join-Path $ProofDir 'SYSTEM-TRUTH-LATEST.json')"
    exit $code
}
finally {
    Pop-Location
}
