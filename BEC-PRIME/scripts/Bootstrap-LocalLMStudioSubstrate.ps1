#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Windows 11 local-first LM Studio substrate.
# This script never installs providers, spends money, or calls cloud inference.
# It verifies the installed CLI, starts the server, and records observed proof.

$Root = 'D:\BrownEyeCortex\ARTIFACTS\LM-STUDIO'
$LogDir = Join-Path $Root 'LOGS'
$ConfigDir = Join-Path $Root 'CONFIG'
$Proof = Join-Path $Root 'LM-STUDIO-SUBSTRATE-PROOF.json'
New-Item -ItemType Directory -Force -Path $Root,$LogDir,$ConfigDir | Out-Null

$lms = Get-Command lms -ErrorAction SilentlyContinue
if (-not $lms) {
  $proof = [ordered]@{
    status = 'BLOCKED'
    reason = 'LMS_CLI_NOT_FOUND'
    checked_utc = [DateTime]::UtcNow.ToString('o')
    endpoint = 'http://127.0.0.1:1234/v1'
    action = 'Install or expose LM Studio lms CLI, then rerun.'
  }
  $proof | ConvertTo-Json -Depth 8 | Set-Content -Path $Proof -Encoding UTF8
  exit 2
}

$lmsPath = $lms.Source
# "lms daemon up" is not a supported command on the installed CLI.
# Use the documented CLI version probe, then start the local server directly.
& $lmsPath version | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'LM_STUDIO_CLI_VERSION_CHECK_FAILED' }

& $lmsPath server start --port 1234 | Out-Null
# A non-zero start result can mean the server is already running.
# The HTTP probe below is the source of truth, not the CLI exit code.

try {
  $models = Invoke-RestMethod -Uri 'http://127.0.0.1:1234/v1/models' -Method Get -TimeoutSec 10
  $visible = @($models.data | ForEach-Object { [string]$_.id })
} catch {
  $proof = [ordered]@{
    status = 'BLOCKED'
    reason = 'LM_STUDIO_SERVER_NOT_REACHABLE'
    checked_utc = [DateTime]::UtcNow.ToString('o')
    endpoint = 'http://127.0.0.1:1234/v1'
  }
  $proof | ConvertTo-Json -Depth 8 | Set-Content -Path $Proof -Encoding UTF8
  exit 3
}

if ($visible.Count -eq 0) {
  $proof = [ordered]@{
    status = 'BLOCKED'
    reason = 'NO_MODELS_VISIBLE'
    checked_utc = [DateTime]::UtcNow.ToString('o')
    endpoint = 'http://127.0.0.1:1234/v1'
    visible_model_count = 0
  }
  $proof | ConvertTo-Json -Depth 8 | Set-Content -Path $Proof -Encoding UTF8
  exit 4
}

$config = [ordered]@{
  schema_version = 'BEC-LOCAL-LMSTUDIO-1.0'
  endpoint = 'http://127.0.0.1:1234/v1'
  local_only = $true
  jit_strategy = 'REQUEST_LOAD / RUN / IDLE_EVICT'
  parallelism = 1
  visible_models = $visible
  cloud_fallback = 'OFF_BY_DEFAULT'
  truth_authority = 'TRUTH_ORACLE'
  settlement_authority = 'STRIPE'
  public_action = 'APPROVAL_GATED'
}
$config | ConvertTo-Json -Depth 8 | Set-Content -Path (Join-Path $ConfigDir 'local.json') -Encoding UTF8

$proof = [ordered]@{
  status = 'PASS'
  checked_utc = [DateTime]::UtcNow.ToString('o')
  endpoint = 'http://127.0.0.1:1234/v1'
  visible_model_count = $visible.Count
  visible_models = $visible
  config = (Join-Path $ConfigDir 'local.json')
}
$proof | ConvertTo-Json -Depth 8 | Set-Content -Path $Proof -Encoding UTF8
Write-Host ('LM Studio substrate PASS. Models visible: ' + $visible.Count)
