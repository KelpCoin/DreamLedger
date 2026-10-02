#requires -Version 5.1
[CmdletBinding()]
param(
  [switch]$Once
)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::ASCII
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$ProofDir = Join-Path $Root "runtime\lm_studio\runs"
New-Item -ItemType Directory -Force -Path $ProofDir | Out-Null
$Lms = Get-Command lms -ErrorAction SilentlyContinue
if (-not $Lms) {
  foreach ($candidate in @("$env:USERPROFILE\.lmstudio\bin\lms.exe","$env:LOCALAPPDATA\Programs\LM Studio\resources\app\.webpack\lms.exe")) {
    if (Test-Path -LiteralPath $candidate) { $Lms = Get-Item -LiteralPath $candidate; break }
  }
}
if (-not $Lms) { throw "LM Studio CLI 'lms' is not installed or discoverable." }
function Invoke-Lms { param([string[]]$Arguments)
  $output = & $Lms.Source @Arguments 2>&1
  if ($LASTEXITCODE -ne 0) { throw ("lms failed ({0}): {1}" -f $LASTEXITCODE,(($output|Out-String).Trim())) }
  return ($output|Out-String).Trim()
}
function Get-LmsJson { param([string[]]$Arguments)
  $raw=Invoke-Lms -Arguments $Arguments
  try { return ($raw|ConvertFrom-Json) } catch { throw ("Expected JSON from lms {0}; got: {1}" -f ($Arguments -join " "),$raw) }
}
function Get-Server { try { return Get-LmsJson @("server","status","--json","--quiet") } catch { return $null } }
function Ensure-Server {
  $status=Get-Server
  if ($status -and $status.running -and $status.port) { return [int]$status.port }
  $null=Invoke-Lms -Arguments @("server","start")
  for($i=0;$i-lt 20;$i++){ Start-Sleep -Seconds 1; $status=Get-Server; if($status -and $status.running -and $status.port){return [int]$status.port} }
  throw "LM Studio server did not become ready after lms server start."
}
$port=Ensure-Server
$base="http://127.0.0.1:$port"
$inventory=Get-LmsJson @("ls","--llm","--json")
$available=@($inventory.models)
if($available.Count -eq 0){throw "LM Studio is running but no local LLM is installed."}
$preferred=$env:DREAMLEDGER_LM_MODEL
if(-not $preferred){$preferred=$env:BECK_LM_MODEL}
$model=$null
if($preferred){$model=$available|Where-Object{([string]$_.model_key -eq $preferred)-or([string]$_.id -eq $preferred)-or([string]$_.path -eq $preferred)}|Select-Object -First 1}
if(-not $model){$model=$available|Where-Object{([string]$_.model_key -notmatch "embed")-and([string]$_.type -notmatch "embedding")}|Select-Object -First 1}
if(-not $model){throw "No usable local LLM found."}
$modelKey=[string]$model.model_key
if(-not $modelKey){$modelKey=[string]$model.id}
if(-not $modelKey){throw "LM Studio model inventory contained no usable model key."}
$loaded=Get-LmsJson @("ps","--json")
$loadedText=$loaded|ConvertTo-Json -Depth 20
if($loadedText -notmatch [regex]::Escape($modelKey)){
  $null=Invoke-Lms -Arguments @("load",$modelKey,"--gpu","max")
  $loaded=Get-LmsJson @("ps","--json")
  $loadedText=$loaded|ConvertTo-Json -Depth 20
}
if($loadedText -notmatch [regex]::Escape($modelKey)){throw "Model load was requested but the selected model is not present in lms ps --json."}
$env:LM_STUDIO_BASE_URL=$base
$env:DREAMLEDGER_LM_MODEL=$modelKey
$env:DREAMLEDGER_ROOT=$Root
$controller=Join-Path $Root "runtime\lm_studio\economic_swarm_controller.py"
if(-not(Test-Path -LiteralPath $controller)){throw "Economic swarm controller not found: $controller"}
$proof=[ordered]@{schema="dreamledger.lm_studio.boot.v2";generated_at_utc=(Get-Date).ToUniversalTime().ToString("o");server=[ordered]@{running=$true;port=$port;base_url=$base};model=[ordered]@{model_key=$modelKey;loaded=$true;gpu_policy="max"};controller=$controller;source="lms_cli"}
$proofPath=Join-Path $ProofDir ("boot-"+(Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")+".json")
$proof|ConvertTo-Json -Depth 20|Set-Content -LiteralPath $proofPath -Encoding ASCII
Write-Host ("LM_STUDIO_READY port={0} model={1}" -f $port,$modelKey)
Write-Host ("BOOT_PROOF={0}" -f $proofPath)
if($Once){& python $controller;exit $LASTEXITCODE}
while($true){try{& python $controller;if($LASTEXITCODE-ne 0){Write-Host ("CONTROLLER_EXIT={0}" -f $LASTEXITCODE)}}catch{Write-Host ("CONTROLLER_ERROR={0}" -f $_.Exception.Message)};Start-Sleep -Seconds 60}
