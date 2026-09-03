$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$spec = Join-Path $root 'BEC-PRIME\compiler\universal-specs\3mv6-development-engine.v1.json'
$engine = Join-Path $root 'BEC-PRIME\compiler\3mv6\ThreeMV6DevelopmentEngine.js'
$proof = Join-Path $root 'BEC-PRIME\RUN-PROOFS\3MV6-DEVELOPMENT-ENGINE-PROOF.json'
$manifest = Join-Path $root 'BEC-PRIME\compiled\development\3mv6\asset-manifest.json'
$logDir = 'D:\BrownEyeCortex\Proofs\3MV6'
$log = Join-Path $logDir ('verify-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Log($m) {
    $line = "[$(Get-Date -Format s)] $m"
    $line | Tee-Object -FilePath $log -Append
}

Log '3MV6 verification start'
if (-not (Test-Path $spec)) { throw "Missing spec: $spec" }
if (-not (Test-Path $engine)) { throw "Missing engine: $engine" }

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { throw 'Node.js is required for the development engine proof.' }

Push-Location $root
try {
    $raw = & node $engine 2>&1
    $exit = $LASTEXITCODE
    $raw | Tee-Object -FilePath $log -Append | Out-Null
    if ($exit -ne 0) { throw "3MV6 engine failed with exit code $exit" }
} finally {
    Pop-Location
}

if (-not (Test-Path $proof)) { throw "Missing proof: $proof" }
if (-not (Test-Path $manifest)) { throw "Missing manifest: $manifest" }

$p = Get-Content -Raw $proof | ConvertFrom-Json
$m = Get-Content -Raw $manifest | ConvertFrom-Json

$checks = [ordered]@{
    status_pass = ($p.status -eq 'PASS')
    engine_3mv6 = ($p.engine -eq '3MV6')
    development_only = ($p.mode -eq 'DEVELOPMENT_ENGINE_ONLY')
    generated_assets = ([int]$p.generated_count -gt 0)
    deterministic_ids = ($p.deterministic_ids -eq $true)
    deterministic_seeds = ($p.deterministic_seeds -eq $true)
    ownership_classes = ($p.ownership_classes -eq $true)
    manifest_present = ($m.engine -eq '3mv6')
    manifest_count_matches = ([int]$m.count -eq [int]$p.generated_count)
}

foreach ($k in $checks.Keys) { Log ("{0}={1}" -f $k, $checks[$k]) }

if (($checks.Values | Where-Object { -not $_ }).Count -gt 0) {
    Log 'RESULT=FAIL'
    throw '3MV6 verification failed.'
}

Log 'RESULT=PASS'
Log "PROOF=$proof"
Log "MANIFEST=$manifest"
Log "LOG=$log"
Write-Output '3MV6 DEVELOPMENT ENGINE: PASS'
