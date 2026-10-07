#requires -Version 5.1
[CmdletBinding()]
param(
  [switch]$InstallTask,
  [switch]$RunOnce
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not (Test-Path $RepoRoot)) { $RepoRoot = (Get-Location).Path }

$LogRoot = "D:\BrownEyeCortex\logs\777"
New-Item -ItemType Directory -Force -Path $LogRoot | Out-Null
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$LogPath = Join-Path $LogRoot "777-inversion-$Stamp.log"
$JsonPath = Join-Path $LogRoot "777-inversion-$Stamp.json"

function Write-Log([string]$Message) {
  $line = "$(Get-Date -Format o) $Message"
  Add-Content -LiteralPath $LogPath -Value $line
  Write-Host $line
}

function Check-Url([string]$Name,[string]$Url) {
  try {
    $r = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec 15 -UseBasicParsing
    return [pscustomobject]@{name=$Name; ok=$true; status=[int]$r.StatusCode; url=$Url}
  } catch {
    $status = $null
    try { $status = [int]$_.Exception.Response.StatusCode.value__ } catch {}
    return [pscustomobject]@{name=$Name; ok=$false; status=$status; url=$Url; error=$_.Exception.Message}
  }
}

function Check-Tcp([string]$Name,[string]$Host,[int]$Port) {
  try {
    $ok = Test-NetConnection -ComputerName $Host -Port $Port -InformationLevel Quiet -WarningAction SilentlyContinue
    return [pscustomobject]@{name=$Name; ok=[bool]$ok; host=$Host; port=$Port}
  } catch {
    return [pscustomobject]@{name=$Name; ok=$false; host=$Host; port=$Port; error=$_.Exception.Message}
  }
}

$results = @()
$results += Check-Url "gateway-health" "https://dreamledger-silo-gateway.onrender.com/healthz"
$results += Check-Url "gateway-manifest" "https://dreamledger-silo-gateway.onrender.com/api/toll/v1/manifest"
$results += Check-Url "public-offers" "https://dreamledger-silo-gateway.onrender.com/api/offers"
$results += Check-Tcp "supabase-db" "db.wbwgroygjeyukkspnqiy.supabase.co" 5432
$results += Check-Tcp "lmstudio-1235" "127.0.0.1" 1235
$results += Check-Tcp "lmstudio-12340" "127.0.0.1" 12340

$score = [ordered]@{
  VERIFIED_EXTERNAL_REVENUE_NZD = 0
  SETTLED_EXTERNAL_PAYMENTS = 0
  INDEPENDENT_EXTERNAL_BUYERS = 0
  VERIFIED_ECONOMIC_OUTCOMES = 0
}

$report = [ordered]@{
  timestamp = (Get-Date).ToUniversalTime().ToString("o")
  doctrine_anchor = "9a822c9ad8cf745177a6195969a4bd1bf8971392"
  allocation = @{ hunt = 70; convert = 20; infrastructure = 10 }
  inversion = @{
    authority_unclear = "BLOCK_EXTERNAL_EFFECT"
    database_unavailable = "FALLBACK_AIRTABLE_AND_UNOBSERVABLE"
    payment_unattributed = "UNMATCHED"
    local_offline = "CLOUD_CONTINUES"
    ci_unknown = "NO_RELEASE_CLAIM"
    deployment_unknown = "NO_LIVE_CLAIM"
    permission_unclear = "QUARANTINE"
    no_verified_winner = "NO_REPLICATION"
  }
  scoreboard = $score
  probes = $results
}

$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $JsonPath -Encoding UTF8
Write-Log "777 inversion guardrail report written: $JsonPath"

$failed = @($results | Where-Object { -not $_.ok })
if ($failed.Count -gt 0) {
  Write-Log "Degraded probes detected. No success is inferred."
  foreach ($f in $failed) { Write-Log ("FALLBACK " + $f.name + " -> guarded degraded mode") }
} else {
  Write-Log "All configured probes passed."
}

if ($InstallTask) {
  $taskName = "BEC-777-Inversion-Guardrail"
  $arg = '-NoProfile -ExecutionPolicy Bypass -File "{0}" -RunOnce' -f $PSCommandPath
  $action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument $arg
  $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1)
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Force | Out-Null
  Write-Log "Installed scheduled task $taskName."
}

Write-Log "777 inversion guardrail run complete."
