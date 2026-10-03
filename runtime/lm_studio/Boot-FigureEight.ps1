#requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference="Stop"

$root="C:\Users\GGPC\DreamLedger"
$rt="$root\runtime\lm_studio"
$lms="C:\Users\GGPC\.lmstudio\bin\lms.exe"
$port=12340
$controller="$rt\economic_swarm_controller.py"
$runs="$rt\runs"
$boot="$rt\Boot-FigureEight.ps1"
New-Item -ItemType Directory -Force -Path $runs | Out-Null

function ApiAlive {
  try {$null=Invoke-RestMethod "http://127.0.0.1:$port/v1/models" -TimeoutSec 3;$true}
  catch {$false}
}
function OllamaAlive {
  try {$null=Invoke-RestMethod "http://127.0.0.1:11434/v1/models" -TimeoutSec 3;$true}
  catch {$false}
}

# COPY FIRST: never overwrite the current controller without a backup.
if(Test-Path $controller){
  $stamp=Get-Date -Format "yyyyMMdd-HHmmss"
  Copy-Item $controller "$controller.backup-$stamp" -Force
}

$env:DREAMLEDGER_ROOT=$root
$env:LM_STUDIO_BASE_URL="http://127.0.0.1:$port"
$env:DREAMLEDGER_LM_MODEL="local"
$env:DREAMLEDGER_LM_MODEL_CRITIC="local"
$env:DREAMLEDGER_LM_MODEL_VISION="qwen_qwen2.5-vl-7b-instruct"
$env:DREAMLEDGER_LM_MODEL_CREATIVE="qwen2.5-7b-instruct"
$env:DREAMLEDGER_REFINEMENT_ROUNDS="5"
$env:DREAMLEDGER_SWARM_INTERVAL_SECONDS="60"

[Environment]::SetEnvironmentVariable("DREAMLEDGER_ROOT",$root,"User")
[Environment]::SetEnvironmentVariable("LM_STUDIO_BASE_URL","http://127.0.0.1:$port","User")
[Environment]::SetEnvironmentVariable("DREAMLEDGER_LM_MODEL","local","User")
[Environment]::SetEnvironmentVariable("DREAMLEDGER_LM_MODEL_CRITIC","local","User")
[Environment]::SetEnvironmentVariable("DREAMLEDGER_LM_MODEL_VISION","qwen_qwen2.5-vl-7b-instruct","User")
[Environment]::SetEnvironmentVariable("DREAMLEDGER_LM_MODEL_CREATIVE","qwen2.5-7b-instruct","User")
[Environment]::SetEnvironmentVariable("DREAMLEDGER_REFINEMENT_ROUNDS","5","User")
[Environment]::SetEnvironmentVariable("DREAMLEDGER_SWARM_INTERVAL_SECONDS","60","User")

if(-not (Test-Path $lms)){throw "LM Studio CLI not found: $lms"}

if(-not (ApiAlive)){
  & $lms server start --port $port 2>$null | Out-Null
  for($i=0;$i -lt 20 -and -not (ApiAlive);$i++){Start-Sleep -Milliseconds 750}
}
if(-not (ApiAlive)){throw "LM Studio HTTP server failed on 12340"}

$ps=(& $lms ps 2>$null | Out-String)
if($ps -notmatch "(?m)^\s*local\s+"){
  & $lms load "microsoft/Phi-3-mini-4k-instruct-gguf/Phi-3-mini-4k-instruct-q4.gguf" --identifier local --gpu auto 2>$null | Out-Null
  Start-Sleep -Seconds 5
}
$ps=(& $lms ps 2>$null | Out-String)
if($ps -notmatch "(?m)^\s*local\s+"){throw "Critic local is not resident"}

if(-not (OllamaAlive)){
  $oc=Get-Command ollama -ErrorAction SilentlyContinue
  if($oc){Start-Process -FilePath $oc.Source -ArgumentList @("serve") -WindowStyle Hidden | Out-Null;Start-Sleep -Seconds 3}
}

[ordered]@{
  schema="dreamledger.figure-eight.roles.v2"
  root=$root
  lm_studio=[ordered]@{
    base_url="http://127.0.0.1:$port"
    critic="local"
    vision="qwen_qwen2.5-vl-7b-instruct"
    creative="qwen2.5-7b-instruct"
    critic_residency="RESIDENT"
    other_roles="JIT"
  }
  ollama=[ordered]@{base_url="http://127.0.0.1:11434";fallback="ENABLED";online=(OllamaAlive)}
  refinement=[ordered]@{rounds=5;persistent_memory="runtime/lm_studio/runs/multi-llm-state.json"}
  updated_at=(Get-Date).ToUniversalTime().ToString("o")
} | ConvertTo-Json -Depth 10 | Set-Content "$rt\figure-eight-roles.json" -Encoding UTF8

$running=Get-CimInstance Win32_Process -Filter "Name='python.exe'" -ErrorAction SilentlyContinue |
  Where-Object {$_.CommandLine -like "*economic_swarm_controller.py*"} |
  Select-Object -First 1

if(-not $running){
  $py="$root\runtime\.venv\Scripts\python.exe"
  if(-not (Test-Path $py)){
    $cmd=Get-Command python -ErrorAction SilentlyContinue
    if($cmd){$py=$cmd.Source}
  }
  if(-not (Test-Path $py)){throw "Python runtime not found"}
  Start-Process -FilePath $py -ArgumentList @($controller) -WorkingDirectory $root -WindowStyle Hidden | Out-Null
}

$action=New-ScheduledTaskAction -Execute "powershell.exe" -Argument ('-NoProfile -ExecutionPolicy Bypass -File "{0}"' -f $boot)
$trigger=New-ScheduledTaskTrigger -AtLogOn
$principal=New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Highest
Register-ScheduledTask -TaskName "DreamLedger Figure Eight" -Action $action -Trigger $trigger -Principal $principal -Description "Figure Eight multi-LLM LM Studio + Ollama" -Force | Out-Null

[ordered]@{
  schema="dreamledger.figure-eight.boot.v2"
  state="BOOT_OK"
  lm_http=$true
  lm_port=$port
  critic_resident=$true
  critic_identifier="local"
  ollama_fallback=(OllamaAlive)
  iterative_refinement=$true
  rounds=5
  persistent_memory="$rt\runs\multi-llm-state.json"
  controller_running=$true
  timestamp=(Get-Date).ToUniversalTime().ToString("o")
} | ConvertTo-Json -Depth 10 | Set-Content "$runs\boot-latest.json" -Encoding UTF8
Write-Host "FIGURE_EIGHT=BOOT_OK"
Write-Host "MULTI_LLM=ITERATIVE_5_ROUNDS"
Write-Host "LM_STUDIO=$port"
Write-Host "CRITIC=local"
Write-Host "OLLAMA_FALLBACK=$((OllamaAlive))"
Write-Host "MEMORY=$runs\multi-llm-state.json"
