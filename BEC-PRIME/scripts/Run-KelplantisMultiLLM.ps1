param(
  [string]$Task = 'Design and implement the next safe Kelplantis integration step for DreamLedger.',
  [string]$BaseUrl = 'http://localhost:1234/v1',
  [string[]]$Models = @()
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$integrationRoot = Join-Path $PSScriptRoot '..\integrations\kelplantis'
$proofDir = Join-Path $root 'proofs\kelplantis'
New-Item -ItemType Directory -Force -Path $proofDir | Out-Null

function Invoke-LMStudio([string]$Model, [string]$System, [string]$User) {
  $body = @{
    model = $Model
    messages = @(
      @{ role = 'system'; content = $System },
      @{ role = 'user'; content = $User }
    )
    temperature = 0.2
    stream = $false
  } | ConvertTo-Json -Depth 8
  $r = Invoke-RestMethod -Method Post -Uri "$BaseUrl/chat/completions" -ContentType 'application/json' -Body $body
  return $r.choices[0].message.content
}

$modelsResponse = Invoke-RestMethod -Method Get -Uri "$BaseUrl/models"
$available = @($modelsResponse.data | ForEach-Object { $_.id })
if ($Models.Count -eq 0) { $Models = $available | Select-Object -First 3 }
if ($Models.Count -eq 0) { throw 'No LM Studio models available. Start the LM Studio server first.' }

$config = Get-Content (Join-Path $integrationRoot 'multi-llm.config.json') -Raw | ConvertFrom-Json
$reports = @()
for ($i = 0; $i -lt $config.roles.Count; $i++) {
  $role = $config.roles[$i]
  $model = $Models[$i % $Models.Count]
  $system = "You are the $($role.name) worker in a local DreamLedger build pipeline. $($role.instruction)"
  $user = "Task: $Task`n`nRepository boundary: DreamLedger. External integration: Kelplantis. There is no authoritative public Kelplantis API available to assume. Return actionable engineering output only."
  $reports += [pscustomobject]@{ role = $role.name; model = $model; report = (Invoke-LMStudio $model $system $user) }
}

$synthesisModel = $Models[0]
$bundle = ($reports | ConvertTo-Json -Depth 8)
$synthesis = Invoke-LMStudio $synthesisModel 'You are the senior synthesizer. Reconcile worker reports into one deterministic implementation plan. Never invent an external API. Preserve human approval gates.' "$($config.synthesis)`n`nTask: $Task`n`nWorker reports:`n$bundle"

$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$proof = [ordered]@{
  proof_type = 'KELPLANTIS_MULTI_LLM_RUN'
  timestamp = (Get-Date).ToUniversalTime().ToString('o')
  task = $Task
  base_url = $BaseUrl
  models = $Models
  worker_reports = $reports
  synthesis = $synthesis
  approval_required = $true
  publish_allowed = $false
  charge_allowed = $false
}
$out = Join-Path $proofDir "PROOF-KELPLANTIS-$stamp.json"
$proof | ConvertTo-Json -Depth 12 | Set-Content -Encoding UTF8 $out
Write-Host "Proof: $out"
Write-Host "Models: $($Models -join ', ')"
Write-Host 'Approval gate: LOCKED'
