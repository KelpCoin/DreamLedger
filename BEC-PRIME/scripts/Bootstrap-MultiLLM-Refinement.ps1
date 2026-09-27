#Requires -Version 5.1

$ErrorActionPreference = 'Stop'

$Prime = Split-Path -Parent $PSScriptRoot
$Runtime = Join-Path $Prime 'runtime'
$ConfigPath = Join-Path $Runtime 'multi-model.json'

Write-Host ''
Write-Host '=== BEC THREE-MODEL REFINEMENT BOOTSTRAP ===' -ForegroundColor White

if (-not (Test-Path $Runtime)) {
  throw "BEC-PRIME runtime directory not found: $Runtime"
}

$Node = Get-Command node -ErrorAction SilentlyContinue
if (-not $Node) {
  throw 'Node.js is required.'
}

$Version = (& node --version).Trim()
Write-Host "Node: $Version" -ForegroundColor Gray

$BaseUrl = $env:BEC_LM_URL
if (-not $BaseUrl) {
  $BaseUrl = 'http://127.0.0.1:1235/v1/chat/completions'
}

$config = [ordered]@{
  schema_version = 'BEC-MULTI-MODEL-CONFIG-1.0'
  mode = 'THREE_MODEL_ITERATIVE_REFINEMENT'
  scout = [ordered]@{
    role = 'scout'
    model = $(if ($env:BEC_SCOUT_MODEL) { $env:BEC_SCOUT_MODEL } else { 'phi-3-mini-4k-instruct' })
    url = $(if ($env:BEC_SCOUT_LM_URL) { $env:BEC_SCOUT_LM_URL } else { $BaseUrl })
  }
  critic = [ordered]@{
    role = 'critic'
    model = $(if ($env:BEC_CRITIC_MODEL) { $env:BEC_CRITIC_MODEL } else { 'qwen2.5-7b-instruct' })
    url = $(if ($env:BEC_CRITIC_LM_URL) { $env:BEC_CRITIC_LM_URL } else { $BaseUrl })
  }
  synthesis = [ordered]@{
    role = 'synthesis'
    model = $(if ($env:BEC_SYNTHESIS_MODEL) { $env:BEC_SYNTHESIS_MODEL } else { 'qwen2.5-coder-14b-instruct' })
    url = $(if ($env:BEC_SYNTHESIS_LM_URL) { $env:BEC_SYNTHESIS_LM_URL } else { $BaseUrl })
  }
}

$models = @(
  [string]$config.scout.model,
  [string]$config.critic.model,
  [string]$config.synthesis.model
)

if (($models | Select-Object -Unique).Count -ne 3) {
  throw 'Three distinct model identifiers are required.'
}

$config | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ConfigPath -Encoding UTF8

[Environment]::SetEnvironmentVariable('BEC_MULTI_MODEL_CONFIG', $ConfigPath, 'User')
$env:BEC_MULTI_MODEL_CONFIG = $ConfigPath

Write-Host ''
Write-Host 'Configuration written:' -ForegroundColor Green
Write-Host $ConfigPath

Write-Host ''
Write-Host 'SCOUT     =' $config.scout.model
Write-Host 'CRITIC    =' $config.critic.model
Write-Host 'SYNTHESIS =' $config.synthesis.model

Write-Host ''
Write-Host 'Validating three-model runtime...' -ForegroundColor Gray
& node -e "const r=require('./runtime/MultiModelRefinement'); r.validateConfig(r.loadConfig()); console.log('MULTI_MODEL_CONFIG=PASS')"

if ($LASTEXITCODE -ne 0) {
  throw 'Multi-model runtime validation failed.'
}

Write-Host ''
Write-Host 'Checking LM Studio API...' -ForegroundColor Gray

$ModelsUrl = $BaseUrl -replace '/v1/chat/completions$', '/v1/models'

try {
  $api = Invoke-RestMethod -Uri $ModelsUrl -Method Get -TimeoutSec 8
  Write-Host 'LM_STUDIO_API=REACHABLE' -ForegroundColor Green
  if ($api.data) {
    $api.data | Select-Object id,object,owned_by | Format-Table -AutoSize
  }
}
catch {
  Write-Host "LM_STUDIO_API=NOT_REACHABLE: $($_.Exception.Message)" -ForegroundColor Yellow
  Write-Host 'Configuration is installed. Live refinement remains blocked until the API is reachable.'
}

Write-Host ''
Write-Host 'Scheduler route:' -ForegroundColor Gray
& node -e "const s=require('./runtime/Scheduler'); console.log(JSON.stringify(s.choose({kind:'lm_refinement',worker_preference:'multi_model_diverse'}),null,2))"

Write-Host ''
Write-Host '=== BEC THREE-MODEL REFINEMENT READY ===' -ForegroundColor White
