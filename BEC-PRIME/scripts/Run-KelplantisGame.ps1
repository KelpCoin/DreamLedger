param(
    [switch]$NoLaunch
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$proofDir = Join-Path $root 'RUN-PROOFS'
$outDir = Join-Path $root 'compiled\universal\game\kelplantis-mvp'
New-Item -ItemType Directory -Force -Path $proofDir | Out-Null

$started = Get-Date
node compiler/kelplantis/KelplantisTargetCompiler.js | Tee-Object -Variable compilerOutput
if ($LASTEXITCODE -ne 0) {
    $proof = [ordered]@{ schema='bec/kelplantis/windows-launch-proof/v2'; status='BLOCKED'; step='compile'; exit_code=$LASTEXITCODE; timestamp_utc=$started.ToUniversalTime().ToString('o') }
    $proof | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $proofDir 'KELPLANTIS-WINDOWS-LAUNCH-PROOF.json') -Encoding UTF8
    exit $LASTEXITCODE
}

$out = Join-Path $outDir 'index.html'
if (-not (Test-Path -LiteralPath $out)) {
    $proof = [ordered]@{ schema='bec/kelplantis/windows-launch-proof/v2'; status='BLOCKED'; step='artifact'; artifact=$out; timestamp_utc=$started.ToUniversalTime().ToString('o') }
    $proof | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $proofDir 'KELPLANTIS-WINDOWS-LAUNCH-PROOF.json') -Encoding UTF8
    exit 2
}

$proof = [ordered]@{ schema='bec/kelplantis/windows-launch-proof/v2'; status='GENERATED'; generated_at_utc=(Get-Date).ToUniversalTime().ToString('o'); artifact=(Resolve-Path $out).Path; launch=if ($NoLaunch) { 'SKIPPED_BY_FLAG' } else { 'BROWSER_REQUESTED' }; runtime_verification='NOT_PROVEN'; compiler_output_tail=(($compilerOutput | Select-Object -Last 12) -join "`n"); note='Artifact generation and browser launch request are not gameplay proof.' }
$proofPath = Join-Path $proofDir 'KELPLANTIS-WINDOWS-LAUNCH-PROOF.json'
$proof | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $proofPath -Encoding UTF8
if (-not $NoLaunch) { Start-Process $out }
Write-Host "Generated: $out" -ForegroundColor Green
Write-Host "Proof: $proofPath" -ForegroundColor Green
Write-Host "Runtime verification remains NOT_PROVEN until browser execution is observed." -ForegroundColor Yellow
exit 0
