# DreamLedger Revenue Operator launcher
# PowerShell 5.1 compatible. Local-first. No public action.
$ErrorActionPreference = 'Stop'
$Repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$ProofRoot = 'D:\BrownEyeCortex\DreamLedger-Deploy\proof\revenue-operator'
$Run = Get-Date -Format 'yyyyMMdd-HHmmss'
$Out = Join-Path $ProofRoot $Run
New-Item -ItemType Directory -Force -Path $Out | Out-Null

$Models = if ($env:BEC_LM_MODELS) { $env:BEC_LM_MODELS } else { 'qwen2.5-coder-14b-instruct,phi-3-mini-4k-instruct,qwen2.5-coder-14b-instruct' }
$Url = if ($env:BEC_LM_URL) { $env:BEC_LM_URL } else { 'http://localhost:1234/v1/chat/completions' }
$Signal = if ($args.Count -gt 0) { $args -join ' ' } else { 'Find the smallest urgent paid wedge for verifiable evidence and adversarial AI-agent testing.' }

Set-Location $Repo
$sha = (git rev-parse HEAD).Trim()
$proof = Join-Path $Out 'launcher-proof.json'

& python BEC-PRIME/refinement/PersistentRevenueOperator.py `
  --signal $Signal `
  --url $Url `
  --models $Models `
  --out-dir 'BEC-PRIME/data/revenue-operator' `
  --memory 'BEC-PRIME/data/revenue-operator/MEMORY.jsonl'
$code = $LASTEXITCODE

$payload = [ordered]@{
  status = if ($code -eq 0) { 'READY_FOR_APPROVAL' } else { 'QUARANTINE_OR_ERROR' }
  repository = $Repo
  git_sha = $sha
  lm_url = $Url
  models = $Models.Split(',')
  public_execution = 'BLOCKED_UNTIL_HUMAN_APPROVAL'
  financial_execution = 'BLOCKED_UNTIL_HUMAN_APPROVAL'
  timestamp_utc = (Get-Date).ToUniversalTime().ToString('o')
}
$payload | ConvertTo-Json -Depth 10 | Set-Content -Path $proof -Encoding UTF8

Write-Host ''
Write-Host 'REVENUE OPERATOR PROOF:' $proof
Write-Host 'GIT SHA:' $sha
Write-Host 'STATUS:' $payload.status
Write-Host 'MEMORY:' (Join-Path $Repo 'BEC-PRIME/data/revenue-operator/MEMORY.jsonl')
Write-Host 'PUBLIC ACTION:' $payload.public_execution
Write-Host 'FINANCIAL ACTION:' $payload.financial_execution
exit $code
