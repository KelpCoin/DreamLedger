#requires -Version 5.1
[CmdletBinding()]
param([switch]$Once)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::ASCII
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$ProofDir = Join-Path $Root "runtime\lm_studio\runs"
New-Item -ItemType Directory -Force -Path $ProofDir | Out-Null

$LmsPath = $null
$cmd = Get-Command lms -ErrorAction SilentlyContinue
if ($cmd) { $LmsPath = $cmd.Source }
if (-not $LmsPath) {
  foreach ($candidate in @("$env:USERPROFILE\.lmstudio\bin\lms.exe","$env:LOCALAPPDATA\Programs\LM Studio\resources\app\.webpack\lms.exe")) {
    if (Test-Path -LiteralPath $candidate) { $LmsPath = $candidate; break }
  }
}
if (-not $LmsPath) { throw "LM Studio CLI 'lms' is not installed or discoverable." }

function Invoke-Lms {
  param([string[]]$Arguments)
  $output = & $LmsPath @Arguments 2>&1
  if ($LASTEXITCODE -ne 0) { throw ("lms failed ({0}): {1}" -f $LASTEXITCODE,(($output|Out-String).Trim())) }
  ($output|Out-String).Trim()
}
function Get-FirstModelValue {
  param($Object,[string[]]$Names)
  foreach($name in $Names){
    $property=$Object.PSObject.Properties[$name]
    if($property -and $null -ne $property.Value){
      $value=[string]$property.Value
      if(-not [string]::IsNullOrWhiteSpace($value)){return $value}
    }
  }
  return ""
}
function Get-LmsJson {
  param([string[]]$Arguments)
  $raw=Invoke-Lms -Arguments $Arguments
  try { $raw|ConvertFrom-Json } catch { throw ("Expected JSON from lms {0}; got: {1}" -f ($Arguments -join " "),$raw) }
}
function Normalize-Items {
  param($Value)
  if($null -eq $Value){return @()}
  if($Value -is [System.Array]){return @($Value)}
  foreach($name in @("models","data","items")){
    $v=$Value.PSObject.Properties[$name]
    if($v){return @($v.Value)}
  }
  return @($Value)
}
function Get-Server { try { Get-LmsJson @("server","status","--json","--quiet") } catch { $null } }
function Ensure-Server {
  $status=Get-Server
  if($status -and $status.running -and $status.port){return [int]$status.port}
  $null=Invoke-Lms -Arguments @("server","start")
  for($i=0;$i-lt 20;$i++){
    Start-Sleep -Seconds 1
    $status=Get-Server
    if($status -and $status.running -and $status.port){return [int]$status.port}
  }
  throw "LM Studio server did not become ready after lms server start."
}

$port=Ensure-Server
$base="http://127.0.0.1:$port"
$inventory=Normalize-Items (Get-LmsJson @("ls","--llm","--json"))
if($inventory.Count -eq 0){throw "LM Studio is running but no local LLM is installed."}

$preferred=$env:DREAMLEDGER_LM_MODEL
if(-not $preferred){$preferred=$env:BECK_LM_MODEL}
$model=$null
if($preferred){
  $model=$inventory|Where-Object{
    $key=Get-FirstModelValue $_ @("modelKey","model_key","key","id")
    $path=[string]$_.path
    $key -eq $preferred -or $path -eq $preferred
  }|Select-Object -First 1
}
if(-not $model){$model=$inventory|Select-Object -First 1}
$modelKey=Get-FirstModelValue $model @("modelKey","model_key","key","id")
if(-not $modelKey){throw "LM Studio model inventory contained no usable model key."}

$loaded=Normalize-Items (Get-LmsJson @("ps","--json"))
$loadedText=$loaded|ConvertTo-Json -Depth 20
$alreadyLoaded=$loaded|Where-Object{
  $key=Get-FirstModelValue $_ @("modelKey","model_key","key","id","model")
  $identifier=Get-FirstModelValue $_ @("identifier","id","model")
  $key -eq $modelKey -or $identifier -eq $modelKey
}|Select-Object -First 1

if(-not $alreadyLoaded){
  $null=Invoke-Lms -Arguments @("load",$modelKey,"-y","--gpu","max")
  $loaded=Normalize-Items (Get-LmsJson @("ps","--json"))
  $loadedText=$loaded|ConvertTo-Json -Depth 20
  $alreadyLoaded=$loaded|Where-Object{
    $key=Get-FirstModelValue $_ @("modelKey","model_key","key","id","model")
    $identifier=Get-FirstModelValue $_ @("identifier","id","model")
    $key -eq $modelKey -or $identifier -eq $modelKey
  }|Select-Object -First 1
}
if(-not $alreadyLoaded){throw "Model load was requested but the selected model is not present in lms ps --json."}

$env:LM_STUDIO_BASE_URL=$base
$env:DREAMLEDGER_LM_MODEL=$modelKey
$env:DREAMLEDGER_ROOT=$Root
$controller=Join-Path $Root "runtime\lm_studio\economic_swarm_controller.py"
if(-not(Test-Path -LiteralPath $controller)){throw "Economic swarm controller not found: $controller"}

$proof=[ordered]@{
  schema="dreamledger.lm_studio.boot.v3"
  generated_at_utc=(Get-Date).ToUniversalTime().ToString("o")
  server=[ordered]@{running=$true;port=$port;base_url=$base}
  model=[ordered]@{model_key=$modelKey;loaded=$true;gpu_policy="max"}
  controller=$controller
  source="lms_cli"
}
$proofPath=Join-Path $ProofDir ("boot-"+(Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")+".json")
$proof|ConvertTo-Json -Depth 20|Set-Content -LiteralPath $proofPath -Encoding ASCII
Write-Host ("LM_STUDIO_READY port={0} model={1}" -f $port,$modelKey)
Write-Host ("BOOT_PROOF={0}" -f $proofPath)

if($Once){& python $controller;exit $LASTEXITCODE}
while($true){
  try{& python $controller;if($LASTEXITCODE-ne 0){Write-Host ("CONTROLLER_EXIT={0}" -f $LASTEXITCODE)}}
  catch{Write-Host ("CONTROLLER_ERROR={0}" -f $_.Exception.Message)}
  Start-Sleep -Seconds 60
}
