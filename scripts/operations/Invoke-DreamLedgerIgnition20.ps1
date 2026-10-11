[CmdletBinding()]
param([string]$RepoPath='D:\BrownEyeCortex\CANONICAL\DreamLedger',[int]$InferenceTimeoutSeconds=90)
# Read-only 20-gate ignition pack. No deploys, public posts, Stripe writes, or production mutations.
$ErrorActionPreference='Continue'
$stamp=(Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$proofRoot=if(Test-Path 'D:\'){'D:\BrownEyeCortex\proofs\factory-bootstrap'}else{Join-Path $env:USERPROFILE 'BrownEyeCortex\proofs\factory-bootstrap'}
New-Item -ItemType Directory -Force -Path $proofRoot|Out-Null
$reportPath=Join-Path $proofRoot "ignition-$stamp.json"
$logPath=Join-Path $proofRoot "ignition-$stamp.log"
$results=[System.Collections.Generic.List[object]]::new()
function Add-Result([int]$Id,[string]$Name,[string]$Status,[object]$Evidence){$results.Add([pscustomobject]@{gate=$Id;name=$Name;status=$Status;evidence=$Evidence});Write-Host ("[{0:D2}/20] {1}: {2}" -f $Id,$Name,$Status)}
function Invoke-RepoScript([string]$Name){if(-not(Get-Command npm -ErrorAction SilentlyContinue)){return @{status='BLOCKED';detail='npm not found'}};$o=& npm run $Name 2>&1;$c=$LASTEXITCODE;$t=(@($o|ForEach-Object{[string]$_}|Select-Object -Last 18)-join [Environment]::NewLine);return @{status=$(if($c -eq 0){'PASS'}else{'FAIL'});exit_code=$c;tail=$t}}
function Get-JsonModels([string]$BaseUrl){try{$r=Invoke-RestMethod -Uri "$BaseUrl/v1/models" -TimeoutSec 5;return @($r.data|ForEach-Object{[string]$_.id}|Where-Object{$_})}catch{return @()}}
function Test-Inference([string]$BaseUrl,[string]$Model){$b=@{model=$Model;messages=@(@{role='user';content='Reply with exactly FACTORY_HEARTBEAT_OK'});temperature=0;max_tokens=24}|ConvertTo-Json -Depth 6;try{$r=Invoke-RestMethod -Uri "$BaseUrl/v1/chat/completions" -Method Post -ContentType 'application/json' -Body $b -TimeoutSec $InferenceTimeoutSeconds;$a=[string]$r.choices[0].message.content;return @{model=$Model;status=$(if($a -match 'FACTORY_HEARTBEAT_OK'){'PASS'}else{'FAIL'});response=$a}}catch{return @{model=$Model;status='FAIL';error=$_.Exception.Message}}}
Start-Transcript -LiteralPath $logPath -Force|Out-Null
try{
Write-Host "DREAMLEDGER 20-GATE IGNITION UTC $stamp"
Add-Result 1 'Canonical repository path' $(if(Test-Path (Join-Path $RepoPath '.git')){'PASS'}else{'FAIL'}) @{path=$RepoPath}
if(-not(Test-Path (Join-Path $RepoPath '.git'))){throw "Repository not found: $RepoPath. Pass -RepoPath for your existing checkout; no clone or overwrite attempted."}
Push-Location $RepoPath
$branch=(& git branch --show-current 2>&1|Out-String).Trim();$gitStatus=(& git status --short 2>&1|Out-String).Trim()
Add-Result 2 'Git branch and dirty state' 'INFO' @{branch=$branch;working_tree=$gitStatus}
$sha=(& git rev-parse HEAD 2>&1|Out-String).Trim();$remote=(& git remote get-url origin 2>&1|Out-String).Trim()
Add-Result 3 'Git identity and origin' $(if($sha -match '^[0-9a-f]{40}$' -and $remote -match 'KelpCoin/DreamLedger'){'PASS'}else{'WARN'}) @{commit=$sha;origin=$remote}
$nodeV=if(Get-Command node -ErrorAction SilentlyContinue){(& node --version 2>&1|Out-String).Trim()}else{'MISSING'}
$npmV=if(Get-Command npm -ErrorAction SilentlyContinue){(& npm --version 2>&1|Out-String).Trim()}else{'MISSING'}
Add-Result 4 'Node and npm runtime' $(if($nodeV -ne 'MISSING' -and $npmV -ne 'MISSING'){'PASS'}else{'FAIL'}) @{node=$nodeV;npm=$npmV}
$pkg=Test-Path (Join-Path $RepoPath 'package.json');$mods=Test-Path (Join-Path $RepoPath 'node_modules')
Add-Result 5 'Package manifest and dependencies' $(if($pkg -and $mods){'PASS'}elseif($pkg){'WARN'}else{'FAIL'}) @{package_json=$pkg;node_modules=$mods}
$nvidia=Get-Command nvidia-smi -ErrorAction SilentlyContinue
if($nvidia){$gpuOut=& $nvidia.Source --query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader 2>&1;$gpuCode=$LASTEXITCODE;$gpuText=@($gpuOut|ForEach-Object{[string]$_})-join [Environment]::NewLine}else{$gpuCode=127;$gpuText='nvidia-smi not found'}
Add-Result 6 'GPU telemetry' $(if($gpuCode -eq 0){'PASS'}else{'FAIL'}) @{exit_code=$gpuCode;telemetry=$gpuText}
$lmsCmd=Get-Command lms -ErrorAction SilentlyContinue
if($lmsCmd){$lmsExe=$lmsCmd.Source}else{$lc=Join-Path $env:USERPROFILE '.lmstudio\bin\lms.exe';$lmsExe=if(Test-Path $lc){$lc}else{$null}}
if($lmsExe){$lmsPs=(& $lmsExe ps 2>&1|Out-String).Trim();$lmsPsCode=$LASTEXITCODE}else{$lmsPs='lms CLI not found';$lmsPsCode=127}
Add-Result 7 'LM Studio resident model inventory' $(if($lmsPsCode -eq 0){'INFO'}else{'WARN'}) @{cli=$lmsExe;loaded_models=$lmsPs}
if($lmsExe){$lmsLs=(& $lmsExe ls 2>&1|Out-String).Trim();$lmsLsCode=$LASTEXITCODE}else{$lmsLs='lms CLI not found';$lmsLsCode=127}
Add-Result 8 'LM Studio installed model inventory' $(if($lmsLsCode -eq 0){'PASS'}else{'WARN'}) @{exit_code=$lmsLsCode;installed_models=$lmsLs}
$api=if($env:LMSTUDIO_BASE_URL){$env:LMSTUDIO_BASE_URL.TrimEnd('/')}else{'http://127.0.0.1:1234'};$ids=@(Get-JsonModels $api)
Add-Result 9 'LM Studio API model inventory' $(if($ids.Count -gt 0){'PASS'}else{'FAIL'}) @{base_url=$api;exposed_model_count=$ids.Count;models=$ids}
$tests=@();foreach($m in @($ids|Select-Object -First 3)){$tests+=Test-Inference $api $m}
$infPass=($ids.Count -ge 3 -and $tests.Count -ge 3 -and @($tests|Where-Object{$_.status -ne 'PASS'}).Count -eq 0)
Add-Result 10 'Three-model live inference gate' $(if($infPass){'PASS'}elseif($ids.Count -eq 0){'BLOCKED'}else{'FAIL'}) @{minimum=3;tested=$tests.Count;all_three_pass=$infPass;tests=$tests}
$proc=@(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue|Where-Object{$_.Name -match 'LM Studio|lms|node|python|powershell' -and $_.CommandLine -match 'BrownEye|DreamLedger|LM Studio|lmstudio|777|Cortex|heartbeat|factory'}|Select-Object ProcessId,Name,ExecutablePath,CommandLine)
Add-Result 11 'Local worker/process inventory' 'INFO' @{matching_processes=$proc}
$tasks=@(Get-ScheduledTask -ErrorAction SilentlyContinue|Where-Object{$_.TaskName -match 'BrownEye|DreamLedger|Cortex|777|Factory|Heartbeat|Autopilot'}|ForEach-Object{[pscustomobject]@{task=$_.TaskName;path=$_.TaskPath;state=[string]$_.State}})
Add-Result 12 'Scheduled task inventory' 'INFO' @{matching_tasks=$tasks;note='Inventory only; no tasks created, stopped, or deleted.'}
$home=try{$w=Invoke-WebRequest -Uri 'https://dreamledger.org/' -Method Get -TimeoutSec 15 -UseBasicParsing;@{status_code=[int]$w.StatusCode;bytes=$w.RawContentLength}}catch{@{error=$_.Exception.Message}}
Add-Result 13 'Public homepage GET' $(if($home.status_code -eq 200){'PASS'}else{'FAIL'}) $home
$door=try{$w=Invoke-WebRequest -Uri 'https://dreamledger.org/go' -Method Get -MaximumRedirection 5 -TimeoutSec 15 -UseBasicParsing;@{status_code=[int]$w.StatusCode;final_url=$w.BaseResponse.ResponseUri.AbsoluteUri}}catch{@{error=$_.Exception.Message}}
Add-Result 14 'Canonical distribution doorway GET' $(if($door.status_code -ge 200 -and $door.status_code -lt 400){'PASS'}else{'FAIL'}) $door
$manifest=try{$w=Invoke-WebRequest -Uri 'https://dreamledger-silo-gateway.onrender.com/api/toll/v1/manifest' -Method Get -TimeoutSec 15 -UseBasicParsing;$body=[string]$w.Content;@{status_code=[int]$w.StatusCode;content_type=$w.Headers['Content-Type'];body_excerpt=$body.Substring(0,[Math]::Min(1000,$body.Length))}}catch{@{error=$_.Exception.Message}}
Add-Result 15 'Machine toll manifest GET' $(if($manifest.status_code -eq 200){'PASS'}else{'FAIL'}) $manifest
$compiled=Join-Path $RepoPath 'BEC-PRIME\compiled\website';$index=Join-Path $compiled 'index.html'
$indexTime=if(Test-Path $index){(Get-Item $index).LastWriteTimeUtc.ToString('o')}else{$null}
Add-Result 16 'Compiled public website artifact' $(if(Test-Path $index){'PASS'}else{'FAIL'}) @{compiled_root=$compiled;index_exists=(Test-Path $index);last_write_utc=$indexTime}
$v=Invoke-RepoScript 'verify:silos';Add-Result 17 'Silo boundary verifier' $v.status $v
$v=Invoke-RepoScript 'verify:evidence-manifest';Add-Result 18 'Evidence manifest verifier' $v.status $v
$v=Invoke-RepoScript 'verify:b2b-marketplace';Add-Result 19 'B2B transaction contract verifier' $v.status $v
$v=Invoke-RepoScript 'verify:a2a-marketplace';Add-Result 20 'A2A transaction contract verifier' $v.status $v
Pop-Location
$summary=[ordered]@{schema='DREAMLEDGER/IGNITION-20-GATE/v1';generated_at_utc=[DateTime]::UtcNow.ToString('o');repository=$RepoPath;git_commit=$sha;git_branch=$branch;origin=$remote;gates=$results.ToArray();counts=@{pass=@($results|Where-Object{$_.status -eq 'PASS'}).Count;fail=@($results|Where-Object{$_.status -eq 'FAIL'}).Count;blocked=@($results|Where-Object{$_.status -eq 'BLOCKED'}).Count;warn=@($results|Where-Object{$_.status -eq 'WARN'}).Count;info=@($results|Where-Object{$_.status -eq 'INFO'}).Count};economic_truth='UNCHANGED_BY_DIAGNOSTIC';verified_external_revenue_nzd=0;settled_external_payments=0;independent_external_buyers=0;verified_economic_outcomes=0;caution='Diagnostic passes do not prove a buyer, settled payment, or fulfilled order.'}
$summary|ConvertTo-Json -Depth 14|Set-Content -LiteralPath $reportPath -Encoding UTF8
Write-Host "REPORT: $reportPath";Write-Host "LOG: $logPath";Write-Host ("SUMMARY pass={0} fail={1} blocked={2} warn={3} info={4}" -f $summary.counts.pass,$summary.counts.fail,$summary.counts.blocked,$summary.counts.warn,$summary.counts.info)
}catch{Add-Result 0 'Bootstrap fatal guard' 'FAIL' @{error=$_.Exception.Message};Write-Error $_}finally{try{Pop-Location -ErrorAction SilentlyContinue}catch{};Stop-Transcript|Out-Null}
