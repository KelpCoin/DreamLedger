$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$Node = (Get-Command node -ErrorAction Stop).Source
$Lms = Get-Command lms -ErrorAction SilentlyContinue

if (-not $Lms) {
    Write-Error 'LM Studio CLI (lms) is not on PATH. Install/enable the LM Studio CLI, then rerun this script.'
}

$bridgeUrl = if ($env:BEC_AGENT_BRIDGE_URL) { $env:BEC_AGENT_BRIDGE_URL } else { 'http://127.0.0.1:3000' }
$lmUrl = if ($env:BEC_LM_URL) { $env:BEC_LM_URL } else { 'http://127.0.0.1:1234/v1/chat/completions' }
$lmModel = if ($env:BEC_LM_MODEL) { $env:BEC_LM_MODEL } else { 'phi-3-mini-4k-instruct' }
$pollMs = if ($env:BEC_WORKER_POLL_MS) { $env:BEC_WORKER_POLL_MS } else { '5000' }

$token = $env:DREAMLEDGER_AGENT_BRIDGE_TOKEN
if (-not $token) {
    $secureToken = Read-Host 'Paste DREAMLEDGER_AGENT_BRIDGE_TOKEN (input is not echoed)' -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
    try { $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}
if (-not $token) { throw 'DREAMLEDGER_AGENT_BRIDGE_TOKEN is required.' }

& $Lms.Source server start 2>$null | Out-Null
Start-Sleep -Seconds 2

$nodeScript = Join-Path $Root 'BEC-PRIME/runtime/LocalWorkerDaemon.js'
if (-not (Test-Path $nodeScript)) { throw "Missing worker daemon: $nodeScript" }

$taskName = 'BECK-Local-Worker'
$logDir = Join-Path $Root 'data/worker'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$tokenFile = Join-Path $logDir 'bridge-token.dpapi'
$secureForFile = ConvertTo-SecureString -String $token -AsPlainText -Force
$secureForFile | ConvertFrom-SecureString | Set-Content -Encoding ASCII $tokenFile

$runner = Join-Path $logDir 'run-worker.ps1'
@"
`$ErrorActionPreference = 'Continue'
`$secure = Get-Content '$tokenFile' | ConvertTo-SecureString
`$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR(`$secure)
try { `$env:DREAMLEDGER_AGENT_BRIDGE_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR(`$bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR(`$bstr) }
`$env:BEC_AGENT_BRIDGE_URL = '$($bridgeUrl.Replace("'", "''"))'
`$env:BEC_LM_URL = '$($lmUrl.Replace("'", "''"))'
`$env:BEC_LM_MODEL = '$($lmModel.Replace("'", "''"))'
`$env:BEC_WORKER_POLL_MS = '$($pollMs.Replace("'", "''"))'
& '$($Node.Replace("'", "''"))' '$($nodeScript.Replace("'", "''"))' *>> '$($logDir.Replace("'", "''"))/worker.log'
"@ | Set-Content -Encoding ASCII $runner

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$runner`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName $taskName

Write-Host 'BECK local worker installed and started.'
Write-Host "Task: $taskName"
Write-Host "Log:  $logDir/worker.log"
Write-Host "LM:   $lmUrl model=$lmModel"
Write-Host "Bridge: $bridgeUrl"
