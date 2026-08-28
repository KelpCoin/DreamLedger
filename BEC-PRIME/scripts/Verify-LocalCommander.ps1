$ErrorActionPreference = 'Stop'

$DataRoot = 'D:\BrownEyeCortex\Commander'
$Proof = Join-Path $DataRoot 'proofs\COMMANDER-LATEST.json'
$Log = Join-Path $DataRoot 'logs\commander-supervisor.log'

$fail = @()

if (-not (Test-Path $Proof)) {
    $fail += 'COMMANDER-LATEST.json missing'
}
if (-not (Test-Path $Log)) {
    $fail += 'commander-supervisor.log missing'
}

if (Test-Path $Proof) {
    $p = Get-Content $Proof -Raw | ConvertFrom-Json

    if ($p.orchestrator -ne 'BEC-LocalCommander') {
        $fail += 'wrong orchestrator'
    }

    if ($p.approval_boundary -ne 'REQUIRED') {
        $fail += 'approval boundary not REQUIRED'
    }

    if ($p.public_action -ne $false) {
        $fail += 'public action detected'
    }

    if ($p.irreversible_actions_enabled -ne $false) {
        $fail += 'irreversible actions enabled'
    }

    if (-not $p.lm_endpoint.StartsWith('http://127.0.0.1:1235')) {
        $fail += 'LM Studio endpoint is not 127.0.0.1:1235'
    }
}

$result = [ordered]@{
    schema = 'BEC-LOCAL-COMMANDER-VERIFY-1.0'
    verified_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    status = if ($fail.Count -eq 0) { 'PASS' } else { 'FAIL' }
    failures = $fail
    proof = $Proof
    log = $Log
}

$result | ConvertTo-Json -Depth 6
$result | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $DataRoot 'proofs\VERIFY-COMMANDER-LATEST.json') -Encoding ASCII

if ($fail.Count -gt 0) {
    exit 1
}

exit 0
