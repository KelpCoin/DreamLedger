#requires -Version 5.1
[CmdletBinding()]
param([switch]$StartLMStudio,[switch]$InstallAtLogon,[switch]$Quiet)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
try { [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12 } catch {}
$RepoRoot=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ProofRoot=if(Test-Path 'D:\'){'D:\BrownEyeCortex\Runtime\proofs\figure-eight'}else{Join-Path $HOME 'BrownEyeCortex\Runtime\proofs\figure-eight'}
$null=New-Item -ItemType Directory -Force -Path $ProofRoot
$ProofPath=Join-Path $ProofRoot 'FIGURE-EIGHT-BOOTSTRAP-LATEST.json'
$LogPath=Join-Path $ProofRoot 'FIGURE-EIGHT-BOOTSTRAP-LATEST.log'
$Started=[DateTime]::UtcNow
$Local=[System.Collections.Generic.List[object]]::new()
$Cloud=[System.Collections.Generic.List[object]]::new()

function Add-Check([System.Collections.Generic.List[object]]$List,[string]$Name,[string]$Status,[string]$Detail) {
  $List.Add([ordered]@{name=$Name;status=$Status;detail=$Detail})
}
function Get-ModelIds([string]$Url) {
  try { $r=Invoke-RestMethod -Uri $Url -Method GET -TimeoutSec 4; return @($r.data | ForEach-Object { if($_.id){[string]$_.id} } | Where-Object {$_}) }
  catch { return @() }
}
function Probe-Cloud([string]$Name,[string]$Url) {
  try {
    $r=Invoke-WebRequest -Uri $Url -Method GET -UseBasicParsing -TimeoutSec 8
    $status=[int]$r.StatusCode
    Add-Check $Cloud $Name $(if($status -ge 200 -and $status -lt 300){'PASS'}else{'BLOCKED'}) ("HTTP "+$status)
    return [ordered]@{name=$Name;url=$Url;http_status=$status}
  } catch {
    $status=0
    try{$status=[int]$_.Exception.Response.StatusCode}catch{}
    $detail=if($status){'HTTP '+$status}else{'Unreachable: '+$_.Exception.Message}
    Add-Check $Cloud $Name 'BLOCKED' $detail
    return [ordered]@{name=$Name;url=$Url;http_status=$status;detail=$detail}
  }
}
function Find-LMStudioExe {
  $candidates=@(
    (Join-Path $env:LOCALAPPDATA 'Programs\LM Studio\LM Studio.exe'),
    (Join-Path $env:LOCALAPPDATA 'LM Studio\LM Studio.exe'),
    (Join-Path $env:ProgramFiles 'LM Studio\LM Studio.exe'),
    (Join-Path ([Environment]::GetEnvironmentVariable('ProgramFiles(x86)')) 'LM Studio\LM Studio.exe')
  ) | Where-Object {$_ -and (Test-Path -LiteralPath $_)}
  if($candidates.Count){return $candidates[0]}
  $cmd=Get-Command 'LM Studio.exe' -ErrorAction SilentlyContinue
  if($cmd){return $cmd.Source}
  return $null
}
function Install-LogonTask {
  $taskName='DreamLedger-BECK-FigureEight'
  $scriptPath=Join-Path $PSScriptRoot 'Start-BECK-FigureEight.ps1'
  $powershell=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $identity=[System.Security.Principal.WindowsIdentity]::GetCurrent().Name
  $action=New-ScheduledTaskAction -Execute $powershell -Argument ('-NoProfile -ExecutionPolicy Bypass -File "'+$scriptPath+'" -StartLMStudio -Quiet')
  $trigger=New-ScheduledTaskTrigger -AtLogOn -User $identity
  $settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -MultipleInstances IgnoreNew
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description 'Local BECK Figure Eight diagnostics; no deployment, spending, or public posts.' -User $identity -RunLevel Limited -Force | Out-Null
  Add-Check $Local 'local.logon_task' 'PASS' 'Registered a limited-privilege per-user logon task. This cannot power on a shut-down PC.'
}

try {
  "[$([DateTime]::UtcNow.ToString('o'))] Figure Eight bootstrap started" | Add-Content -LiteralPath $LogPath -Encoding UTF8

  if($InstallAtLogon){try{Install-LogonTask}catch{Add-Check $Local 'local.logon_task' 'BLOCKED' $_.Exception.Message}}
  else {$task=Get-ScheduledTask -TaskName 'DreamLedger-BECK-FigureEight' -ErrorAction SilentlyContinue;Add-Check $Local 'local.logon_task' $(if($task){'PASS'}else{'BLOCKED'}) $(if($task){'Per-user logon task is registered.'}else{'Not installed. Run the launcher once on the PC.'})}

  $node=Get-Command node.exe -ErrorAction SilentlyContinue
  if($node){$v=(& node.exe --version 2>&1|Out-String).Trim();$major=0;if($v -match '^v(\d+)\.'){$major=[int]$Matches[1]};Add-Check $Local 'local.node' $(if($major -ge 20){'PASS'}else{'BLOCKED'}) $v}
  else{Add-Check $Local 'local.node' 'BLOCKED' 'Node.js 20+ not found on PATH.'}

  $lms=if($env:BECK_LMSTUDIO_BASE){$env:BECK_LMSTUDIO_BASE.TrimEnd('/')}else{'http://127.0.0.1:1234/v1'}
  $proxy=if($env:BECK_TRI_LLM_PROXY_BASE){$env:BECK_TRI_LLM_PROXY_BASE.TrimEnd('/')}else{'http://127.0.0.1:1235/v1'}
  $lmIds=Get-ModelIds ($lms+'/models')
  if(!$lmIds.Count -and $StartLMStudio){
    $exe=Find-LMStudioExe
    if($exe){
      try{Start-Process -FilePath $exe|Out-Null;$deadline=[DateTime]::UtcNow.AddSeconds(35);do{Start-Sleep -Seconds 2;$lmIds=Get-ModelIds ($lms+'/models')}while(!$lmIds.Count -and [DateTime]::UtcNow -lt $deadline)}
      catch{Add-Check $Local 'local.lm_studio_autostart' 'BLOCKED' $_.Exception.Message}
    }else{Add-Check $Local 'local.lm_studio_autostart' 'BLOCKED' 'LM Studio executable not found; no installation or download attempted.'}
  }
  Add-Check $Local 'local.lm_studio' $(if($lmIds.Count){'PASS'}else{'BLOCKED'}) $(if($lmIds.Count){'Model API reachable; models='+$lmIds.Count}else{'No models returned from '+$lms+'/models. LM Studio can be opened automatically when installed.'})

  $proxyIds=Get-ModelIds ($proxy+'/models')
  Add-Check $Local 'local.tri_llm_proxy' $(if($proxyIds.Count){'PASS'}else{'BLOCKED'}) $(if($proxyIds.Count){'Proxy model API reachable; models='+$proxyIds.Count}else{'No models returned from '+$proxy+'/models.'})
  $roleEnv=[ordered]@{scout=[string]$env:BECK_TRI_LLM_MODEL_SCOUT;critic=[string]$env:BECK_TRI_LLM_MODEL_CRITIC;vision=[string]$env:BECK_TRI_LLM_MODEL_VISION}
  $roles=@{}
  foreach($role in $roleEnv.Keys){
    $wanted=$roleEnv[$role]
    if([string]::IsNullOrWhiteSpace($wanted)){
      if($role -eq 'vision' -and $proxyIds -contains 'vision-ocr'){$wanted='vision-ocr'}
      elseif($proxyIds -contains $role){$wanted=$role}
    }
    $match=$false;if($wanted){$match=@($proxyIds|Where-Object{$_ -eq $wanted}).Count -gt 0}
    $roles[$role]=[ordered]@{model=if($wanted){$wanted}else{$null};status=if($match){'PASS'}else{'BLOCKED'}}
  }
  $rolesReady=@($roles.Values|Where-Object{$_.status -ne 'PASS'}).Count -eq 0
  Add-Check $Local 'local.tri_llm_roles' $(if($rolesReady){'PASS'}else{'BLOCKED'}) $(if($rolesReady){'Scout, critic, and vision model IDs resolved.'}else{'Readiness not claimed. Set BECK_TRI_LLM_MODEL_SCOUT/CRITIC/VISION to the intended proxy model IDs; vision-ocr is the only safe automatic alias.'})

  $gpu=Get-Command nvidia-smi.exe -ErrorAction SilentlyContinue
  if(!$gpu){$gpu=Get-Command nvidia-smi -ErrorAction SilentlyContinue}
  if($gpu){$text=(& $gpu.Source --query-gpu=name,memory.total,memory.used,memory.free,utilization.gpu --format=csv,noheader 2>&1|Out-String).Trim();Add-Check $Local 'local.gpu' $(if($LASTEXITCODE -eq 0){'PASS'}else{'BLOCKED'}) $text}
  else{Add-Check $Local 'local.gpu' 'BLOCKED' 'nvidia-smi unavailable; no GPU status claim.'}
  if((Get-Command git.exe -ErrorAction SilentlyContinue) -and (Test-Path (Join-Path $RepoRoot '.git'))){$head=(& git.exe -C $RepoRoot rev-parse HEAD 2>&1|Out-String).Trim();Add-Check $Local 'local.repository' $(if($LASTEXITCODE -eq 0){'PASS'}else{'BLOCKED'}) $head}
  else{Add-Check $Local 'local.repository' 'BLOCKED' ('Git metadata unavailable at '+$RepoRoot)}

  $targets=@(
    @{n='cloud.website_health';u='https://dreamledger.org/healthz'},
    @{n='cloud.website_version';u='https://dreamledger.org/version'},
    @{n='cloud.website_toll_manifest';u='https://dreamledger.org/api/toll/v1/manifest'},
    @{n='cloud.local_heartbeat_route';u='https://dreamledger.org/api/toll/v1/local-heartbeat'},
    @{n='cloud.gateway_health';u='https://dreamledger-silo-gateway.onrender.com/healthz'},
    @{n='cloud.gateway_manifest';u='https://dreamledger-silo-gateway.onrender.com/api/toll/v1/manifest'},
    @{n='cloud.engine_health';u='https://dreamledger1.onrender.com/healthz'},
    @{n='cloud.engine_version';u='https://dreamledger1.onrender.com/version'}
  )
  $cloudResponses=@();foreach($target in $targets){$cloudResponses+=Probe-Cloud $target.n $target.u}

  $tokenReady=-not [string]::IsNullOrWhiteSpace([string]$env:LOCAL_HEARTBEAT_TOKEN)
  Add-Check $Local 'local.heartbeat_token' $(if($tokenReady){'PASS'}else{'BLOCKED'}) $(if($tokenReady){'Dedicated local heartbeat token present; value is never logged.'}else{'LOCAL_HEARTBEAT_TOKEN missing. No secret was generated or printed.'})
  if($tokenReady){
    $payload=[ordered]@{ts=[DateTime]::UtcNow.ToString('o');lm_studio=[bool]$lmIds.Count;tri_llm=[bool]$rolesReady;capacity=if($lmIds.Count -and $rolesReady){'available'}elseif($lmIds.Count){'busy'}else{'offline'};models=@($proxyIds|Select-Object -First 20)}
    try{$body=$payload|ConvertTo-Json -Depth 5 -Compress;$ack=Invoke-RestMethod -Uri 'https://dreamledger.org/api/toll/v1/local-heartbeat' -Method POST -TimeoutSec 8 -Headers @{Authorization=('Bearer '+$env:LOCAL_HEARTBEAT_TOKEN)} -ContentType 'application/json' -Body $body;Add-Check $Local 'local.heartbeat_post' $(if($ack.status -eq 'ACCEPTED'){'PASS'}else{'BLOCKED'}) ('Server response='+[string]$ack.status)}
    catch{$code=0;try{$code=[int]$_.Exception.Response.StatusCode}catch{};Add-Check $Local 'local.heartbeat_post' 'BLOCKED' $(if($code){'HTTP '+$code}else{$_.Exception.Message})}
  }else{Add-Check $Local 'local.heartbeat_post' 'BLOCKED' 'Skipped because the dedicated token is absent.'}

  $all=@($Local)+@($Cloud);$failed=@($all|Where-Object{$_.status -eq 'FAIL'}).Count;$blocked=@($all|Where-Object{$_.status -eq 'BLOCKED'}).Count
  $overall=if($failed){'FAIL'}elseif($blocked){'DEGRADED'}else{'PASS'}
  $report=[ordered]@{
    schema='dreamledger/figure-eight-bootstrap/v1';generated_at_utc=[DateTime]::UtcNow.ToString('o');elapsed_seconds=[math]::Round(([DateTime]::UtcNow-$Started).TotalSeconds,2);overall=$overall
    local=@($Local);cloud=@($Cloud);cloud_probes=$cloudResponses;tri_llm_roles=$roles
    figure_eight='Cloud owns economic truth, durable orchestration, and public offers. The PC is an optional local inference accelerator. Missing heartbeat never proves why the PC is absent.'
    economic_truth=[ordered]@{verified_revenue_nzd=0;status='UNVERIFIED_UNTIL_EXTERNAL_SETTLEMENT_ATTRIBUTION_FULFILMENT_DELIVERY_AND_INDEPENDENT_VERIFICATION';payment_attempts_created=0;public_posts_created=0;production_deployments_triggered=0}
    next_action=if($overall -eq 'PASS'){'Continue the existing gated economic Figure Eight; this bootstrap itself has not created a sale.'}else{'Repair the first BLOCKED local/cloud dependency. Do not treat a missing heartbeat as proof of powered-off hardware.'}
  }
  $report|ConvertTo-Json -Depth 10|Set-Content -LiteralPath $ProofPath -Encoding UTF8
  "[$([DateTime]::UtcNow.ToString('o'))] overall=$overall local=$($Local.Count) cloud=$($Cloud.Count) proof=$ProofPath"|Add-Content -LiteralPath $LogPath -Encoding UTF8
  Write-Output ('FIGURE_EIGHT_BOOTSTRAP='+$overall)
  Write-Output ('LOCAL_CHECKS='+$Local.Count)
  Write-Output ('CLOUD_CHECKS='+$Cloud.Count)
  Write-Output ('PROOF='+$ProofPath)
  if(!$Quiet -and $overall -ne 'PASS'){Write-Output 'Blockers were written to the proof. No revenue is inferred from health or inference.'}
  if($Quiet){exit 0};if($overall -eq 'PASS'){exit 0}else{exit 2}
}catch{
  $fatal=[ordered]@{schema='dreamledger/figure-eight-bootstrap/v1';generated_at_utc=[DateTime]::UtcNow.ToString('o');overall='FAIL';fatal_error=$_.Exception.Message;local=@($Local);cloud=@($Cloud);verified_revenue_nzd=0}
  try{$fatal|ConvertTo-Json -Depth 8|Set-Content -LiteralPath $ProofPath -Encoding UTF8}catch{}
  "[$([DateTime]::UtcNow.ToString('o'))] fatal=$($_.Exception.Message)"|Add-Content -LiteralPath $LogPath -Encoding UTF8
  Write-Error ('Bootstrap failed; proof path='+$ProofPath)
  if($Quiet){exit 0}else{exit 2}
}
