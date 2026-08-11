param(
    [string]$Task = "dreamledger-readiness",
    [string]$Prompt = "Review this DreamLedger commerce system for agent-readiness. Identify evidence-backed blockers and the highest-value next action. Do not invent evidence.",
    [string[]]$Models = @(),
    [switch]$HealthOnly
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$proofDir = Join-Path $root 'data\proofs'
New-Item -ItemType Directory -Force -Path $proofDir | Out-Null

$base = if ($env:LMSTUDIO_BASE_URL) { $env:LMSTUDIO_BASE_URL } else { 'http://localhost:1234/v1' }
$env:KELPLANTIS_PROOF_DIR = $proofDir

Write-Host "Kelplantis local bridge" -ForegroundColor Cyan
Write-Host "LM Studio: $base"

try {
    $health = Invoke-RestMethod -Uri "$base/models" -Method Get -TimeoutSec 10
    $available = @($health.data | ForEach-Object { $_.id })
    Write-Host "Models discovered: $($available.Count)" -ForegroundColor Green
    $available | ForEach-Object { Write-Host " - $_" }
} catch {
    Write-Host "LM Studio unavailable: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "Commerce remains independent. State: external_blocked" -ForegroundColor Yellow
    exit 2
}

if ($HealthOnly) { exit 0 }

$modelsJson = ($Models | ConvertTo-Json -Compress)
$promptJson = $Prompt | ConvertTo-Json -Compress
$taskJson = $Task | ConvertTo-Json -Compress

$node = @"
const { runPipeline } = require('./kelplantis/KelplantisPipeline');
const task = $taskJson;
const prompt = $promptJson;
const models = $modelsJson;
runPipeline({ task, prompt, models }).then(({ proof, file }) => {
  console.log(JSON.stringify({ proof_id: proof.proof_id, state: proof.state, models: proof.selected_models, aggregate: proof.aggregate, file }, null, 2));
}).catch(err => { console.error(err.stack || err.message); process.exit(1); });
"@

node -e $node
if ($LASTEXITCODE -ne 0) { throw "Kelplantis pipeline failed" }

Write-Host "Proofs: $proofDir" -ForegroundColor Green
Write-Host "Verify: Get-ChildItem '$proofDir\KELP-*.json' | Sort-Object LastWriteTime -Descending | Select-Object -First 5 FullName,Length,LastWriteTime" -ForegroundColor Cyan
