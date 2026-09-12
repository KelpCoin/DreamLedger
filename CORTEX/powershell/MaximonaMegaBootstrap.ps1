[CmdletBinding()]
param(
  [string]$RepoRoot = 'C:\BrownEyeCortex\DreamLedger',
  [string]$DataRoot = 'D:\BrownEyeCortex\Maximona\Experiment001'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Write-Utf8([string]$Path, [string]$Text) {
  $dir = Split-Path -Parent $Path
  if ($dir) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  [System.IO.File]::WriteAllText($Path, $Text, [System.Text.UTF8Encoding]::new($false))
}

New-Item -ItemType Directory -Force -Path $DataRoot | Out-Null
$runId = 'MAXIMONA-001-' + (Get-Date).ToUniversalTime().ToString('yyyyMMddHHmmss')
$runDir = Join-Path $DataRoot $runId
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

$contract = Join-Path $RepoRoot 'MAXIMONA\EXPERIMENT-001.json'
$verifier = Join-Path $RepoRoot 'BEC-PRIME\scripts\Verify-MaximonaExperiment001.js'

if (-not (Test-Path -LiteralPath $contract)) { throw "Missing contract: $contract" }
if (-not (Test-Path -LiteralPath $verifier)) { throw "Missing verifier: $verifier" }

$env:MAXIMONA_DATA_ROOT = $DataRoot
$env:MAXIMONA_PROOF_DIR = $runDir

Push-Location $RepoRoot
try {
  $result = & node $verifier 2>&1
  $exitCode = $LASTEXITCODE
  $result | Tee-Object -FilePath (Join-Path $runDir 'verifier.txt')
  if ($exitCode -ne 0) {
    Write-Output "MAXIMONA_STATUS=INCOMPLETE_OR_UNVERIFIED"
    Write-Output "MAXIMONA_RUN_DIR=$runDir"
    exit $exitCode
  }
} finally {
  Pop-Location
}

$manifest = [ordered]@{
  schema = 'MAXIMONA-001-BOOTSTRAP/1.0'
  run_id = $runId
  created_utc = (Get-Date).ToUniversalTime().ToString('o')
  repo_root = (Resolve-Path $RepoRoot).Path
  data_root = (Resolve-Path $DataRoot).Path
  proof_dir = (Resolve-Path $runDir).Path
  next_action = 'MARKET_CONTACT_ONLY_AFTER_OPERATOR_APPROVAL'
  external_contact_sent = $false
  settled_revenue_nzd = 0
}
$manifestPath = Join-Path $runDir 'run-manifest.json'
$manifest | ConvertTo-Json -Depth 8 | Write-Utf8 $manifestPath

Write-Output "MAXIMONA_STATUS=PASS"
Write-Output "MAXIMONA_RUN_DIR=$runDir"
Write-Output "MAXIMONA_MANIFEST=$manifestPath"
Write-Output "VERIFY_60S=powershell -NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -RepoRoot `"$RepoRoot`" -DataRoot `"$DataRoot`""
