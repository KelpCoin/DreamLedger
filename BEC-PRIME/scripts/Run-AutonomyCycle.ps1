$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$DataRoot = 'D:\BrownEyeCortex\Autonomy'
$LogRoot = Join-Path $DataRoot 'logs'
$ProofRoot = Join-Path $DataRoot 'proofs'
New-Item -ItemType Directory -Force -Path $DataRoot,$LogRoot,$ProofRoot | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$log = Join-Path $LogRoot ("cycle-{0}.log" -f $stamp)
$env:LM_STUDIO_BASE_URL = if ($env:LM_STUDIO_BASE_URL) { $env:LM_STUDIO_BASE_URL } else { 'http://127.0.0.1:1234' }
if (-not $env:LM_STUDIO_MODEL) { $env:LM_STUDIO_MODEL = 'local-model' }
if (-not $env:RABBIT_MIN_PAID_EVENTS) { $env:RABBIT_MIN_PAID_EVENTS = '3' }
$node = (Get-Command node.exe -ErrorAction Stop).Source
Push-Location $RepoRoot
try {
    & $node (Join-Path $RepoRoot 'autonomy\RevenueAutonomy.js') *>&1 | Tee-Object -FilePath $log
    $exitCode = $LASTEXITCODE
    $latest = Join-Path $RepoRoot 'data\autonomy\proofs\AUTONOMY-LATEST.json'
    if (Test-Path $latest) { Copy-Item $latest (Join-Path $ProofRoot 'AUTONOMY-LATEST.json') -Force }
    $state = Join-Path $RepoRoot 'data\autonomy\state.json'
    if (Test-Path $state) { Copy-Item $state (Join-Path $DataRoot 'state.json') -Force }
    $audit = Join-Path $RepoRoot 'data\autonomy\autonomy.jsonl'
    if (Test-Path $audit) { Copy-Item $audit (Join-Path $DataRoot 'autonomy.jsonl') -Force }
    $result = [ordered]@{
        schema = 'BEC-AUTONOMY-PS-1.0'
        timestamp_utc = (Get-Date).ToUniversalTime().ToString('o')
        exit_code = $exitCode
        repo_root = $RepoRoot
        proof = (Join-Path $ProofRoot 'AUTONOMY-LATEST.json')
        log = $log
    }
    $result | ConvertTo-Json -Depth 5 | Set-Content -Encoding ASCII (Join-Path $ProofRoot 'POWERSHELL-RUN-PROOF.json')
    exit $exitCode
}
finally {
    Pop-Location
}
