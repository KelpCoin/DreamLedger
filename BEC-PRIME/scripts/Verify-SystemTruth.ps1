$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

$Proof = Join-Path (Split-Path -Parent $PSScriptRoot) 'RUN-PROOFS\SYSTEM-TRUTH-LATEST.json'
if (-not (Test-Path $Proof)) {
    Write-Host "FAIL: proof not found: $Proof" -ForegroundColor Red
    exit 1
}

try {
    $data = Get-Content $Proof -Raw | ConvertFrom-Json
} catch {
    Write-Host 'FAIL: proof is not valid JSON' -ForegroundColor Red
    exit 1
}

$required = @('schema','run_id','timestamp_utc','repository','local','production','compiler','economic','status','failures')
foreach ($name in $required) {
    if (-not ($data.PSObject.Properties.Name -contains $name)) {
        Write-Host "FAIL: missing field $name" -ForegroundColor Red
        exit 1
    }
}

$failureCount = @($data.failures).Count
if ($data.status -eq 'SYSTEM_TRUTH_PASS' -and $failureCount -ne 0) {
    Write-Host 'FAIL: PASS status contains failures' -ForegroundColor Red
    exit 1
}

if ($data.status -eq 'SYSTEM_TRUTH_FAIL' -and $failureCount -eq 0) {
    Write-Host 'FAIL: FAIL status contains no failures' -ForegroundColor Red
    exit 1
}

Write-Host 'SYSTEM_TRUTH_PROOF_STRUCTURE_PASS' -ForegroundColor Green
Write-Host "Status: $($data.status)"
Write-Host "Live SHA: $($data.production.live_sha)"
Write-Host "Proof: $Proof"
exit 0
