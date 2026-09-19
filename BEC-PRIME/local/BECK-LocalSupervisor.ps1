# BECK local multi-model supervisor
# PowerShell 5.1, ASCII-only.
# Local execution component. No external-action authority.

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$RepoRoot = Split-Path -Parent (Split-Path -Parent $Root)
$LogDir = Join-Path $RepoRoot "BEC-PRIME\data\local-supervisor"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$LmHost = if ($env:BEC_LM_HOST) { $env:BEC_LM_HOST } else { "127.0.0.1" }
$LmPort = if ($env:BEC_LM_PORT) { [int]$env:BEC_LM_PORT } else { 1234 }
$Models = @($env:BEC_LM_MODEL_1,$env:BEC_LM_MODEL_2,$env:BEC_LM_MODEL_3) | Where-Object { $_ -and $_.Trim() -ne "" }
$GpuRatios = @(0.45,0.30,0.20)
$WorkerIds = @("beck-lm-01","beck-lm-02","beck-lm-03")
if ($Models.Count -lt 3) { throw "Set BEC_LM_MODEL_1, BEC_LM_MODEL_2 and BEC_LM_MODEL_3." }
$lms = Get-Command lms.exe -ErrorAction SilentlyContinue
if (-not $lms) { $lms = Get-Command lms -ErrorAction SilentlyContinue }
if (-not $lms) { throw "LM Studio lms CLI was not found." }
$node = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $node) { throw "node.exe was not found." }
$env:BEC_LM_URL = "http://{0}:{1}/v1/chat/completions" -f $LmHost,$LmPort
$env:BEC_LM_CONTEXT = if ($env:BEC_LM_CONTEXT) { $env:BEC_LM_CONTEXT } else { "32768" }
try { & $lms.Source server start --port $LmPort 2>&1 | Out-File (Join-Path $LogDir "lm-server.log") -Append -Encoding ascii } catch {}
$deadline = (Get-Date).AddSeconds(30)
$ready = $false
while ((Get-Date) -lt $deadline) {
  try { $r = Invoke-WebRequest -UseBasicParsing -Uri ("http://{0}:{1}/v1/models" -f $LmHost,$LmPort) -TimeoutSec 3; if ($r.StatusCode -eq 200) { $ready = $true; break } } catch {}
  Start-Sleep -Seconds 1
}
if (-not $ready) { throw "LM Studio API did not become ready." }
for ($i=0; $i -lt 3; $i++) {
  $model = $Models[$i]; $ratio = $GpuRatios[$i]; $identifier = $WorkerIds[$i]
  $args = @("load",$model,"--gpu",[string]$ratio,"--identifier",$identifier,"--context-length",$env:BEC_LM_CONTEXT)
  & $lms.Source @args 2>&1 | Out-File (Join-Path $LogDir "$identifier-load.log") -Append -Encoding ascii
  if ($LASTEXITCODE -ne 0) { throw "Failed to load $model for $identifier." }
}
$children = @()
for ($i=0; $i -lt 3; $i++) {
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $node.Source
  $psi.Arguments = "runtime/EconomicJobWorkerAdapter.js"
  $psi.WorkingDirectory = $Root
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $envCopy = @{ BEC_WORKER_ID=$WorkerIds[$i]; BEC_LOCAL_WORKER_ID=$WorkerIds[$i]; BEC_LM_MODEL=$Models[$i]; BEC_LM_URL=("http://{0}:{1}/v1/chat/completions" -f $LmHost,$LmPort); BEC_LM_CONTEXT=$env:BEC_LM_CONTEXT; DREAMLEDGER_AGENT_BRIDGE_TOKEN=$env:DREAMLEDGER_AGENT_BRIDGE_TOKEN; BEC_AGENT_BRIDGE_URL=(if ($env:BEC_AGENT_BRIDGE_URL) { $env:BEC_AGENT_BRIDGE_URL } else { "https://dreamledger.org" }) }
  foreach ($k in $envCopy.Keys) { if ($envCopy[$k]) { $psi.EnvironmentVariables[$k] = [string]$envCopy[$k] } }
  $p = New-Object System.Diagnostics.Process; $p.StartInfo = $psi; [void]$p.Start()
  $children += [pscustomobject]@{ WorkerId=$WorkerIds[$i]; Model=$Models[$i]; Process=$p }
}
while ($true) {
  foreach ($c in $children) { if ($c.Process.HasExited) { Add-Content -Path (Join-Path $LogDir "supervisor.log") -Value "$(Get-Date -Format o) EXIT $($c.WorkerId) code=$($c.Process.ExitCode)" } }
  $alive = @($children | Where-Object { -not $_.Process.HasExited }).Count
  if ($alive -eq 0) { break }
  Start-Sleep -Seconds 15
}
throw "All BECK local workers exited. Inspect $LogDir."