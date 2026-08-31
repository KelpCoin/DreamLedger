# BEC PRIME LM Studio watchdog. Restarts the local server and reloads the configured model if needed.
[CmdletBinding()]
param()
$ErrorActionPreference="Stop"
Set-StrictMode -Version Latest
function Find-Lms {
  $cmd=Get-Command lms.exe -ErrorAction SilentlyContinue
  if($cmd){return $cmd.Source}
  $p=Join-Path $env:USERPROFILE ".lmstudio\bin\lms.exe"
  if(Test-Path -LiteralPath $p){return $p}
  throw "lms.exe not found."
}
$lms=Find-Lms
$root=if(Test-Path "D:\BrownEyeCortex\Runtime"){"D:\BrownEyeCortex\Runtime"}else{"C:\BrownEyeCortex\Runtime"}
$proof=Join-Path $root "proofs\LMSTUDIO-WATCHDOG-LATEST.json"
New-Item -ItemType Directory -Path (Split-Path -Parent $proof) -Force | Out-Null
$config=Join-Path $root "lmstudio-model.json"
if(-not(Test-Path -LiteralPath $config)){throw "Model configuration missing: $config"}
$model=[string](Get-Content -LiteralPath $config -Raw|ConvertFrom-Json).model_key
& $lms daemon up --json | Out-Null
& $lms server start --port 1234 --bind 127.0.0.1 | Out-Null
$ps=& $lms ps --json 2>&1
if($LASTEXITCODE -ne 0){throw "lms ps failed."}
$items=@($ps|ConvertFrom-Json)
if($items.Count -eq 1 -and $items[0].models){$items=@($items[0].models)}
$match=$items|Where-Object{([string]$_.identifier)-eq$model -or([string]$_.modelKey)-eq$model}
if(-not$match){& $lms load $model --gpu auto|Out-Null}
$ps2=& $lms ps --json 2>&1
if($LASTEXITCODE -ne 0){throw "lms ps verification failed."}
$items2=@($ps2|ConvertFrom-Json)
if($items2.Count -eq 1 -and $items2[0].models){$items2=@($items2[0].models)}
$ok=$items2|Where-Object{([string]$_.identifier)-eq$model -or([string]$_.modelKey)-eq$model}
if(-not$ok){throw "Configured model is not loaded: $model"}
[ordered]@{schema="BEC-LMSTUDIO-WATCHDOG-1.0";status="PASS";model=$model;server="http://127.0.0.1:1234";checked_at_utc=(Get-Date).ToUniversalTime().ToString("o")}|ConvertTo-Json|Set-Content -LiteralPath $proof -Encoding UTF8
Write-Host "PASS: LM Studio watchdog verified $model"