#Requires -Version 5.1
[CmdletBinding()]
param([switch]$InstallVisionModel)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.Encoding]::ASCII

function Fail([string]$m){throw $m}
function Get-Lms {
  $c=Get-Command lms.exe -ErrorAction SilentlyContinue
  if($c){return $c.Source}
  $c=Get-Command lms -ErrorAction SilentlyContinue
  if($c){return $c.Source}
  $p=Join-Path $env:USERPROFILE '.lmstudio\bin\lms.exe'
  if(Test-Path -LiteralPath $p){return $p}
  Fail 'LMS_EXECUTABLE_NOT_FOUND'
}
function Get-LmsJson([string]$Lms,[string[]]$Args){
  $raw=& $Lms @Args 2>&1
  if($LASTEXITCODE -ne 0){Fail ('LMS_COMMAND_FAILED:'+($raw -join ' '))}
  try{return ($raw -join [Environment]::NewLine)|ConvertFrom-Json}catch{Fail 'LMS_JSON_INVALID'}
}
function Items($v){
  if($null -eq $v){return @()}
  if($v -is [array]){return @($v)}
  foreach($n in @('models','data','items')){
    $p=$v.PSObject.Properties[$n]
    if($p){return @($p.Value)}
  }
  return @($v)
}

$lms=Get-Lms
$inventory=Items (Get-LmsJson $lms @('ls','--llm','--json'))
$keys=@($inventory|ForEach-Object{[string]($_.modelKey ?? $_.model_key ?? $_.key ?? $_.id)}|Where-Object{$_}|Select-Object -Unique)
Write-Host ('INSTALLED_LLM_COUNT='+$keys.Count)
$keys|ForEach-Object{Write-Host ('MODEL='+$_)}

if($InstallVisionModel -and $keys.Count -lt 3){
  Write-Host 'INSTALLING_VISION_MODEL=qwen2-vl-2b-instruct'
  & $lms get qwen2-vl-2b-instruct
  if($LASTEXITCODE -ne 0){Fail 'VISION_MODEL_INSTALL_FAILED'}
  $inventory=Items (Get-LmsJson $lms @('ls','--llm','--json'))
  $keys=@($inventory|ForEach-Object{[string]($_.modelKey ?? $_.model_key ?? $_.key ?? $_.id)}|Where-Object{$_}|Select-Object -Unique)
}

if($keys.Count -lt 3){
  Fail ('THREE_LLM_MINIMUM_NOT_MET: installed='+$keys.Count+' required=3. Run with -InstallVisionModel or install a VLM manually with: lms get qwen2-vl-2b-instruct')
}

$creator=[string]$env:DREAMLEDGER_CREATOR_MODEL
$critic=[string]$env:DREAMLEDGER_CRITIC_MODEL
$synthesis=[string]$env:DREAMLEDGER_SYNTHESIS_MODEL
if([string]::IsNullOrWhiteSpace($creator)){$creator=$keys[0]}
if([string]::IsNullOrWhiteSpace($critic)){$critic=$keys[1]}
if([string]::IsNullOrWhiteSpace($synthesis)){$synthesis=$keys[2]}
if(@($creator,$critic,$synthesis)|Sort-Object -Unique|Measure-Object|Select-Object -ExpandProperty Count -lt 3){Fail 'MINIMUM_THREE_DISTINCT_MODELS_REQUIRED'}
if($keys -notcontains $creator){Fail ('MODEL_NOT_INSTALLED:'+ $creator)}
if($keys -notcontains $critic){Fail ('MODEL_NOT_INSTALLED:'+ $critic)}
if($keys -notcontains $synthesis){Fail ('MODEL_NOT_INSTALLED:'+ $synthesis)}

$vision=[string]$env:DREAMLEDGER_VISION_MODEL
if([string]::IsNullOrWhiteSpace($vision)){$vision=$critic}
if(@($creator,$critic,$synthesis) -notcontains $vision){Fail 'VISION_MODEL_MUST_BE_ONE_OF_THREE'}

Write-Host ('CREATOR_MODEL='+$creator)
Write-Host ('CRITIC_VISION_MODEL='+$critic)
Write-Host ('SYNTHESIS_MODEL='+$synthesis)
Write-Host ('VISION_MODEL='+$vision)
Write-Host 'THREE_MODEL_CONTRACT=READY'
