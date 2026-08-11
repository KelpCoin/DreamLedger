$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$proofDir = Join-Path $root 'data\proofs'
$files = @(Get-ChildItem -Path $proofDir -Filter 'KELP-*.json' -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending)
if ($files.Count -eq 0) { throw "No Kelplantis proof artifacts found in $proofDir" }

$latest = Get-Content $files[0].FullName -Raw | ConvertFrom-Json
$checks = [ordered]@{
    proof_id = [bool]$latest.proof_id
    local_only = ($latest.execution_boundary -eq 'local_only')
    schema_valid = ($latest.gauntlet.schema_valid_models -ge 1)
    checkout_untouched = ($latest.gauntlet.checkout_untouched -eq $true)
    public_state_untouched = ($latest.gauntlet.public_state_untouched -eq $true)
    aggregate_present = [bool]$latest.aggregate
}

$checks.GetEnumerator() | ForEach-Object {
    Write-Host ("{0}={1}" -f $_.Key, $_.Value)
}
if ($checks.Values -contains $false) { throw "Kelplantis proof verification FAILED" }
Write-Host "PASS: $($files[0].FullName)" -ForegroundColor Green
