$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$Node = (Get-Command node -ErrorAction Stop).Source
$Npm = (Get-Command npm -ErrorAction Stop).Source
$Lms = Get-Command lms -ErrorAction SilentlyContinue

if (-not $Lms) {
    Write-Error 'LM Studio CLI (lms) is not on PATH. Install/enable the LM Studio CLI, then rerun this script.'
}

$env:BEC_AGENT_BRIDGE_URL = if ($env:BEC_AGENT_BRIDGE_URL) { $env:BEC_AGENT_BRIDGE_URL } else { 'http://127.0.0.1:3000' }
$env:BEC_LM_URL = if ($env:BEC_LM_URL) { $env:BEC_LM_URL } else { 'http://127.0.0.1:1234/v1/chat/completions' }
$env:BEC_LM_MODEL = if ($env:BEC_LM_MODEL) { $env:BEC_LM_MODEL } else { 'phi-3-mini-4k-instruct' }
$env:BEC_WORKER_POLL_MS = if ($env:BEC_WORKER_POLL_MS) { $env:BEC_WORKER_POLL_MS } else { '5000' }

if (-not $env:DREAMLEDGER_AGENT_BRIDGE_TOKEN) {
    $token = Read-Host 'Paste DREAMLEDGER_AGENT_BRIDGE_TOKEN (input is not echoed)'
    if (-not $token) { throw 'DREAMLEDGER_AGENT_BRIDGE_TOKEN is required.' }
    $env:DREAMLEDGER_AGENT_BRIDGE_TOKEN = $token
}

& $Lms.Source server start 2>$null | Out-Null
Start-Sleep -Seconds 2

$nodeScript = Join-Path $Root 'BEC-PRIME/runtime/LocalWorkerDaemon.js'
if (-not (Test-Path $nodeScript)) { throw "Missing worker daemon: $nodeScript" }

$taskName = 'BECK-Local-Worker'
$logDir = Join-Path $Root 'data/worker'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$envBlock = @{
    BEC_AGENT_BRIDGE_URL = $env:BEC_AGENT_BRIDGE_URL
    BEC_LM_URL = $env:BEC_LM_URL
    BEC_LM_MODEL = $env:BEC_LM_MODEL
    BEC_WORKER_POLL_MS = $env:BEC_WORKER_POLL_MS
    DREAMLEDGER_AGENT_BRIDGE_TOKEN = $env:DREAMLEDGER_AGENT_BRIDGE_TOKEN
}

$envFile = Join-Path $logDir 'worker.env.ps1'
$envBlock.GetEnumerator() | ForEach-Object {
    $escaped = $_.Value.Replace("'", "''")
    "`$env:$($_.Key) = '$escaped'"
} | Set-Content -Encoding ASCII $envFile

$runner = Join-Path $logDir 'run-worker.ps1'
@"
`$ErrorActionPreference = 'Continue'
. '$envFile'
& '$Node' '$nodeScript' *>> '$logDir/worker.log'
"@ | Set-Content -Encoding ASCII $runner

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$runner`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName $taskName

Write-Host "BECK local worker installed and started."
Write-Host "Task: $taskName"
Write-Host "Log:  $logDir/worker.log"
Write-Host "LM:   $($env:BEC_LM_URL) model=$($env:BEC_LM_MODEL)"
Write-Host "Bridge: $($env:BEC_AGENT_BRIDGE_URL)"
