param(
    [switch]$NoLaunch
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$proofDir = Join-Path $root 'RUN-PROOFS'
New-Item -ItemType Directory -Force -Path $proofDir | Out-Null

$started = Get-Date
node compiler/kelplantis/KelplantisTargetCompiler.js | Tee-Object -Variable compilerOutput
if ($LASTEXITCODE -ne 0) { throw 'Kelplantis target compiler failed.' }

$out = Join-Path $root 'compiled\universal\game\kelplantis-mvp\index.html'
if (-not (Test-Path -LiteralPath $out)) { throw "Generated game missing: $out" }

$proof = [ordered]@{
    schema = 'bec/kelplantis/windows-launch-proof/v1'
    status = 'GENERATED'
    generated_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    elapsed_seconds = ((Get-Date) - $started).TotalSeconds
    artifact = $out
    launch = if ($NoLaunch) { 'SKIPPED_BY_FLAG' } else { 'BROWSER_REQUESTED' }
    runtime_verification = 'NOT_PROVEN'
    compiler_output_tail = (($compilerOutput | Select-Object -Last 12) -join "`n")
}

$proofPath = Join-Path $proofDir 'KELPLANTIS-WINDOWS-LAUNCH-PROOF.json'
$proof | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $proofPath -Encoding UTF8

if (-not $NoLaunch) {
    Start-Process $out
}

Write-Host "Generated: $out" -ForegroundColor Green
Write-Host "Proof: $proofPath" -ForegroundColor Green
Write-Host "Runtime verification remains NOT_PROVEN until gameplay is observed." -ForegroundColor Yellow
