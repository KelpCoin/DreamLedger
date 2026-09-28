#requires -Version 5.1
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$Lms = Get-Command lms -ErrorAction SilentlyContinue
if (-not $Lms) { throw "LM Studio CLI 'lms' is not installed or not on PATH." }

$lmsBase = "http://localhost:1234"
try { $null = Invoke-RestMethod -Uri "$lmsBase/v1/models" -TimeoutSec 3 } catch {
  & $Lms.Source server start --port 1234 | Out-Host
  Start-Sleep -Seconds 3
}

$models = Invoke-RestMethod -Uri "$lmsBase/v1/models" -TimeoutSec 10
$data = @($models.data)
if ($data.Count -eq 0) { throw "No LM Studio model is available. Install/download a model in LM Studio first." }

$preferred = $env:BECK_LM_MODEL
if (-not $preferred) { $preferred = $env:DREAMLEDGER_LM_MODEL }
if (-not $preferred) { $preferred = [string]$data[0].id }

$loaded = @()
try {
  $ps = & $Lms.Source ps 2>$null
  if ($ps) { $loaded = $ps | Out-String }
} catch {}

if ($loaded -notmatch [regex]::Escape($preferred)) {
  & $Lms.Source load $preferred --gpu=max | Out-Host
}

$env:LM_STUDIO_BASE_URL = $lmsBase
$env:DREAMLEDGER_LM_MODEL = $preferred
$env:DREAMLEDGER_ROOT = $Root

python "$PSScriptRooteconomic_swarm_controller.py"
