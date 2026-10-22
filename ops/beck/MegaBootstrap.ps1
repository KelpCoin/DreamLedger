# BECK MegaBootstrap (Windows) — idempotent local side
# Does not block cloud. Produces evidence. No revenue claims.
# Requires: PowerShell 5.1+

param(
  [string]$EvidenceDir = "$PSScriptRoot\..\..\proof\local",
  [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'
$observed = (Get-Date).ToUniversalTime().ToString('o')
New-Item -ItemType Directory -Force -Path $EvidenceDir | Out-Null

function Write-Evidence($name, $obj) {
  $path = Join-Path $EvidenceDir $name
  $obj | ConvertTo-Json -Depth 8 | Set-Content -Path $path -Encoding UTF8
  Write-Host "EVIDENCE=$path"
}

$report = [ordered]@{
  schema = 'DREAMLEDGER-BECK-MEGABOOTSTRAP/v1'
  observed_at_utc = $observed
  host = $env:COMPUTERNAME
  what_if = [bool]$WhatIf
  steps = @()
  verified_external_revenue_nzd = 0
  production_mutation = $false
}

function Add-Step($id, $status, $detail) {
  $script:report.steps += [ordered]@{ id = $id; status = $status; detail = $detail }
}

# 1. Evidence root
try {
  if (-not $WhatIf) { New-Item -ItemType Directory -Force -Path $EvidenceDir | Out-Null }
  Add-Step 'evidence_dir' 'PASS' $EvidenceDir
} catch {
  Add-Step 'evidence_dir' 'FAIL' $_.Exception.Message
}

# 2. LM Studio loopback probe (optional)
$lm = $null
try {
  $lm = Invoke-RestMethod -Uri 'http://127.0.0.1:1234/v1/models' -TimeoutSec 3
  Add-Step 'lmstudio_loopback' 'PASS' 'models endpoint reachable'
} catch {
  Add-Step 'lmstudio_loopback' 'NOT_RUN' 'LM Studio not reachable on 127.0.0.1:1234'
}

# 3. Scheduled task presence (register only if missing; no cloud calls)
$taskName = 'DreamLedger-Local-Heartbeat'
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
  Add-Step 'heartbeat_task' 'PASS' 'already registered'
} else {
  Add-Step 'heartbeat_task' 'BLOCKED' 'task not registered; installer path must create it without cloud secrets'
}

Write-Evidence 'latest-megabootstrap.json' $report
$fail = @($report.steps | Where-Object { $_.status -eq 'FAIL' })
if ($fail.Count -gt 0) { exit 1 }
exit 0
