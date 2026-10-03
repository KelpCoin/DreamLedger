[CmdletBinding()]
param(
  [string]$RepoRoot = (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)),
  [string]$BaseUrl = $env:LMSTUDIO_BASE_URL
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Find-Lms {
  $cmd = Get-Command lms.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $cmd = Get-Command lms -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $candidates = @(
    (Join-Path $env:USERPROFILE '.lmstudio\bin\lms.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\LM Studio\resources\app\.webpack\bin\lms.exe')
  )
  foreach ($p in $candidates) { if (Test-Path $p) { return $p } }
  throw 'LMS_EXECUTABLE_NOT_FOUND'
}
function Run-Lms([string[]]$Args) {
  $out = & $script:Lms @Args 2>&1
  if ($LASTEXITCODE -ne 0) { throw ('LMS_FAILED:' + ($out -join ' ')) }
  return ($out -join [Environment]::NewLine)
}
function Json-Lms([string[]]$Args) {
  $raw = Run-Lms $Args
  return $raw | ConvertFrom-Json
}
function Get-Models([string]$Url) {
  $r = Invoke-RestMethod -Uri ($Url + '/models') -Method Get -TimeoutSec 15
  if (-not $r.data) { throw 'NO_MODELS_RETURNED' }
  return @($r.data)
}

$Lms = Find-Lms
$daemon = Json-Lms @('daemon','status','--json')
if (-not $daemon.status -or $daemon.status -ne 'running') {
  Json-Lms @('daemon','up','--json') | Out-Null
  $daemon = Json-Lms @('daemon','status','--json')
}
$server = Json-Lms @('server','status','--json','--quiet')
if (-not $server.running) {
  Run-Lms @('server','start') | Out-Null
  $server = Json-Lms @('server','status','--json','--quiet')
}
$port = [int]$server.port
if ([string]::IsNullOrWhiteSpace($BaseUrl)) { $BaseUrl = "http://127.0.0.1:$port/v1" }
$BaseUrl = $BaseUrl.TrimEnd('/')
$models = Get-Models $BaseUrl
$model = [string]$models[0].id
if ([string]::IsNullOrWhiteSpace($model)) { throw 'MODEL_ID_MISSING' }

$ps = Json-Lms @('ps','--json')
$loaded = @($ps) | Where-Object {
  ([string]$_.identifier -eq $model) -or ([string]$_.id -eq $model) -or ([string]$_.modelKey -eq $model) -or ([string]$_.path -eq $model)
}
if (-not $loaded) {
  Run-Lms @('load',$model,'--gpu','max') | Out-Null
  $ps = Json-Lms @('ps','--json')
  $loaded = @($ps) | Where-Object {
    ([string]$_.identifier -eq $model) -or ([string]$_.id -eq $model) -or ([string]$_.modelKey -eq $model) -or ([string]$_.path -eq $model)
  }
}
if (-not $loaded) { throw 'MODEL_LOAD_NOT_CONFIRMED_BY_LMS_PS' }

$probeBody = @{
  model = $model
  messages = @(
    @{ role = 'system'; content = 'Return JSON only: {"ready":true}' },
    @{ role = 'user'; content = 'READY_INFERENCE' }
  )
  temperature = 0
  max_tokens = 32
  stream = $false
} | ConvertTo-Json -Depth 6
$probe = Invoke-RestMethod -Uri ($BaseUrl + '/chat/completions') -Method Post -ContentType 'application/json' -Body $probeBody -TimeoutSec 120
if (-not $probe.choices[0].message.content) { throw 'READY_INFERENCE_FAILED' }

$env:LMSTUDIO_BASE_URL = $BaseUrl
$worker = Join-Path $RepoRoot 'BEC-PRIME\scripts\economic-local-worker.js'
$raw = & node $worker --build 2>&1
$workerExit = $LASTEXITCODE
$workerText = $raw -join [Environment]::NewLine
$workerJson = $null
try { $workerJson = $workerText | ConvertFrom-Json } catch {}

[ordered]@{
  JOB_ID = if ($workerJson.job_id) { $workerJson.job_id } else { '' }
  SIGNAL_ID = if ($workerJson.signal_id) { $workerJson.signal_id } else { '' }
  MODEL_ID = $model
  SERVER_ENDPOINT = $BaseUrl
  INFERENCE_STATUS = 'READY_INFERENCE'
  ARTIFACT_PATH = if ($workerJson.artifact_reference) { $workerJson.artifact_reference } else { '' }
  INPUT_HASH = if ($workerJson.input_hash) { $workerJson.input_hash } else { '' }
  OUTPUT_HASH = if ($workerJson.artifact_sha256) { $workerJson.artifact_sha256 } else { '' }
  GPU_STATUS = 'UNOBSERVABLE'
  FAILURE_REASON = if ($workerExit -ne 0) { $workerText } elseif ($workerJson.status -eq 'IDLE') { 'NO_BUILD_JOB_AVAILABLE' } else { '' }
} | ConvertTo-Json -Depth 8

if ($workerExit -ne 0 -or $workerJson.status -eq 'IDLE') { exit 1 }
