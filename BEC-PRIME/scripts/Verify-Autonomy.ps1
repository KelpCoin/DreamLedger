$ErrorActionPreference = 'Stop'
$DataRoot = 'D:\BrownEyeCortex\Autonomy'
$Proof = Join-Path $DataRoot 'proofs\AUTONOMY-LATEST.json'
$RunProof = Join-Path $DataRoot 'proofs\POWERSHELL-RUN-PROOF.json'
$State = Join-Path $DataRoot 'state.json'
$fail = @()
if (-not (Test-Path $Proof)) { $fail += 'AUTONOMY-LATEST.json missing' }
if (-not (Test-Path $RunProof)) { $fail += 'POWERSHELL-RUN-PROOF.json missing' }
if (-not (Test-Path $State)) { $fail += 'state.json missing' }
if (Test-Path $Proof) {
    $p = Get-Content $Proof -Raw | ConvertFrom-Json
    if ($p.status -ne 'PASS') { $fail += ('autonomy status is {0}' -f $p.status) }
    if ($p.approval_boundary -ne 'REQUIRED') { $fail += 'approval boundary is not REQUIRED' }
    if ($p.public_actions_executed -ne $false) { $fail += 'public action execution detected' }
}
if (Test-Path $State) {
    $s = Get-Content $State -Raw | ConvertFrom-Json
    if ($null -eq $s.paid_events) { $fail += 'paid_events missing' }
    if ($s.rabbit_mode -notin @('LOCKED','ARMED')) { $fail += 'invalid rabbit_mode' }
}
$result = [ordered]@{
    schema = 'BEC-AUTONOMY-VERIFY-1.0'
    verified_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    status = if ($fail.Count -eq 0) { 'PASS' } else { 'FAIL' }
    failures = $fail
    proof = $Proof
    state = $State
}
$result | ConvertTo-Json -Depth 6
$result | ConvertTo-Json -Depth 6 | Set-Content -Encoding ASCII (Join-Path $DataRoot 'proofs\VERIFY-AUTONOMY-LATEST.json')
if ($fail.Count -gt 0) { exit 1 }
exit 0
