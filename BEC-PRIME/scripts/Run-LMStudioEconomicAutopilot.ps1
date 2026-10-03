#Requires -Version 5.1
[CmdletBinding()]
param(
  [string]$BridgeUrl=$env:DREAMLEDGER_AGENT_BRIDGE_URL,
  [string]$BridgeToken=$env:DREAMLEDGER_AGENT_BRIDGE_TOKEN,
  [string]$WorkerId=$env:DREAMLEDGER_LMSTUDIO_WORKER_ID,
  [string]$LMStudioUrl=$env:LM_STUDIO_BASE_URL,
  [int]$PollSeconds=15,
  [int]$MaxOutputTokens=1400,
  [switch]$Once
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.Encoding]::ASCII

function Fail([string]$m){throw $m}
if([string]::IsNullOrWhiteSpace($BridgeUrl)){Fail 'DREAMLEDGER_AGENT_BRIDGE_URL is required'}
if([string]::IsNullOrWhiteSpace($BridgeToken)){Fail 'DREAMLEDGER_AGENT_BRIDGE_TOKEN is required'}
if([string]::IsNullOrWhiteSpace($WorkerId)){$WorkerId='lmstudio-economic-'+$env:COMPUTERNAME}
$BridgeUrl=$BridgeUrl.TrimEnd('/'); $LMStudioUrl=$LMStudioUrl.TrimEnd('/')

function Get-Lms {
  $c=Get-Command lms.exe -ErrorAction SilentlyContinue
  if($c){return $c.Source}
  $c=Get-Command lms -ErrorAction SilentlyContinue
  if($c){return $c.Source}
  foreach($p in @((Join-Path $env:USERPROFILE '.lmstudio\bin\lms.exe'),(Join-Path $env:LOCALAPPDATA 'LM-Studio\bin\lms.exe'))){
    if(Test-Path -LiteralPath $p){return $p}
  }
  Fail 'LMS_EXECUTABLE_NOT_FOUND'
}
function LmsRaw([string]$l,[string[]]$a){
  $o=& $l @a 2>&1
  if($LASTEXITCODE -ne 0){Fail ('LMS_COMMAND_FAILED:'+($o -join ' '))}
  ($o -join [Environment]::NewLine).Trim()
}
function LmsJson([string]$l,[string[]]$a){
  $r=LmsRaw $l $a
  try{return $r|ConvertFrom-Json}catch{Fail ('LMS_JSON_INVALID:'+ $r)}
}
function EnsureRuntime([string]$l){
  $d=LmsJson $l @('daemon','status','--json')
  if([string]$d.status -ne 'running'){
    [void](LmsRaw $l @('daemon','up'))
    $d=LmsJson $l @('daemon','status','--json')
  }
  if([string]$d.status -ne 'running'){Fail 'SERVER_UNAVAILABLE:LLMSTER_DAEMON'}
  $s=LmsJson $l @('server','status','--json','--quiet')
  if(-not [bool]$s.running){
    [void](LmsRaw $l @('server','start'))
    $s=LmsJson $l @('server','status','--json','--quiet')
  }
  $port=0; try{$port=[int]$s.port}catch{}
  if(-not [bool]$s.running -or $port -le 0){Fail 'SERVER_UNAVAILABLE:LM_SERVER'}
  $port
}
function InstalledModels([string]$l){
  $r=LmsJson $l @('ls','--llm','--json')
  $items=@()
  if($r -is [Array]){$items=@($r)}
  elseif($null -ne $r.models){$items=@($r.models)}
  elseif($null -ne $r.data){$items=@($r.data)}
  elseif($null -ne $r.items){$items=@($r.items)}
  else{$items=@($r)}
  @($items|ForEach-Object{
    if($null -ne $_.modelKey){[string]$_.modelKey}
    elseif($null -ne $_.model_key){[string]$_.model_key}
    elseif($null -ne $_.key){[string]$_.key}
    elseif($null -ne $_.id){[string]$_.id}
  }|Where-Object{$_}|Select-Object -Unique)
}
function Assignments([string]$l){
  $installed=InstalledModels $l
  if($installed.Count -lt 3){Fail ('THREE_LLM_MINIMUM_NOT_MET:installed='+$installed.Count+' required=3; run .\runtime\lm_studio\Ensure-ThreeModelLocalStack.ps1 -InstallVisionModel')}
  $c=[string]$env:DREAMLEDGER_CREATOR_MODEL; $k=[string]$env:DREAMLEDGER_CRITIC_MODEL; $s=[string]$env:DREAMLEDGER_SYNTHESIS_MODEL
  if([string]::IsNullOrWhiteSpace($c)){$c=$installed[0]}
  if([string]::IsNullOrWhiteSpace($k)){$k=$installed[1]}
  if([string]::IsNullOrWhiteSpace($s)){$s=$installed[2]}
  $u=@($c,$k,$s)|Select-Object -Unique
  if($u.Count -lt 3){Fail 'MINIMUM_THREE_DISTINCT_MODELS_REQUIRED'}
  foreach($m in @($c,$k,$s)){if($installed -notcontains $m){Fail ('MODEL_NOT_INSTALLED:'+ $m)}}
  $v=[string]$env:DREAMLEDGER_VISION_MODEL
  if([string]::IsNullOrWhiteSpace($v)){$v=$k}
  if(@($c,$k,$s) -notcontains $v){Fail 'VISION_MODEL_MUST_BE_ONE_OF_THREE'}
  [ordered]@{CREATOR=$c;CRITIC=$k;SYNTHESIS=$s;VISION=$v;installed_count=$installed.Count}
}
function VisibleModels{
  $r=Invoke-RestMethod -Uri ($script:LMStudioUrl+'/v1/models') -Method Get -TimeoutSec 30
  @($r.data|Where-Object{$_.id}|ForEach-Object{[string]$_.id}|Select-Object -Unique)
}
function LoadModel([string]$l,[string]$m){
  $help=LmsRaw $l @('load','--help')
  $a=@('load',$m)
  if($help -match '(?i)--gpu'){$a+=@('--gpu','max')}
  if($help -match '(?i)(-y|--yes)'){$a+='--yes'}
  [void](LmsRaw $l $a)
  $deadline=(Get-Date).AddSeconds(60)
  do{
    try{if((VisibleModels)-contains $m){return $m}}catch{}
    Start-Sleep -Seconds 1
  }while((Get-Date)-lt $deadline)
  Fail ('MODEL_NOT_EXPOSED_AFTER_LOAD:'+ $m)
}
function UnloadModel([string]$l,[string]$m){try{[void](LmsRaw $l @('unload',$m))}catch{}}
function ImageParts([string]$list){
  $out=@()
  if([string]::IsNullOrWhiteSpace($list)){return $out}
  foreach($x in ($list -split ';')){
    $p=$x.Trim(); if(-not $p){continue}
    if(-not(Test-Path -LiteralPath $p -PathType Leaf)){Fail ('VISION_IMAGE_NOT_FOUND:'+ $p)}
    $ext=([IO.Path]::GetExtension($p)).ToLowerInvariant()
    $mime=switch($ext){'.png'{'image/png'}'.jpg'{'image/jpeg'}'.jpeg'{'image/jpeg'}'.webp'{'image/webp'}default{Fail ('UNSUPPORTED_VISION_IMAGE_TYPE:'+ $ext)}}
    $b64=[Convert]::ToBase64String([IO.File]::ReadAllBytes($p))
    $out+=@{type='image_url';image_url=@{url=('data:'+ $mime+';base64,'+$b64)}}
  }
  $out
}
function Stage([string]$Model,[string]$Role,[object]$Packet,[bool]$Vision){
  $sys=@{
    CREATOR='Create the strongest bounded internal artifact or transformation from supplied evidence. Never invent buyers, payments, revenue, fulfillment, authorization or external results.'
    CRITIC='Attack the current candidate. Find contradictions, stale evidence, ambiguity, unsupported inference and economic leakage. When images are supplied, perform visual inspection/OCR. Never certify truth.'
    SYNTHESIS='Reconcile creator and critic outputs into one evidence-backed state. Preserve unresolved blockers. Never authorize prohibited external action.'
  }
  $content=@(@{type='text';text=(ConvertTo-Json @{role=$Role;packet=$Packet} -Depth 50 -Compress)})
  if($Role -eq 'CRITIC' -and $Vision){$content+=ImageParts ([string]$env:DREAMLEDGER_VISION_IMAGE_PATHS)}
  $body=@{model=$Model;messages=@(
    @{role='system';content=($sys[$Role]+' UNKNOWN remains UNKNOWN. Consensus is not evidence.')},
    @{role='user';content=$content}
  );temperature=0.1;max_tokens=$MaxOutputTokens;stream=$false}
  $r=Invoke-RestMethod -Uri ($script:LMStudioUrl+'/v1/chat/completions') -Method Post -ContentType 'application/json' -Body ($body|ConvertTo-Json -Depth 60) -TimeoutSec 900
  $t=[string]$r.choices[0].message.content
  if([string]::IsNullOrWhiteSpace($t)){Fail ('MODEL_EMPTY_OUTPUT:'+ $Role)}
  $t
}
function Sha256([string]$t){
  $sha=[Security.Cryptography.SHA256]::Create()
  try{return ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($t)))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
}
function BridgeJson([string]$method,[string]$url,[object]$body){
  $h=@{'x-dreamledger-agent-token'=$BridgeToken;Accept='application/json'}
  $p=@{Uri=$url;Method=$method;Headers=$h;ErrorAction='Stop';TimeoutSec=120}
  if($null -ne $body){$p.ContentType='application/json';$p.Body=($body|ConvertTo-Json -Depth 60 -Compress)}
  Invoke-RestMethod @p
}
function WriteBuild([object]$job,[object]$a,[string]$creator,[string]$critic,[string]$synthesis){
  $root=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
  $ad=Join-Path $root 'runtime\777\local-build-artifacts'; $md=Join-Path $root 'runtime\cube\manifests'; $pd=Join-Path $root 'runtime\777\local-worker-proofs'
  New-Item -ItemType Directory -Force -Path $ad,$md,$pd|Out-Null
  $ap=Join-Path $ad ([string]$job.job_id+'.json')
  $artifact=[ordered]@{schema_version='DREAMLEDGER/LOCAL-BUILD-ARTIFACT/v2';job_id=[string]$job.job_id;signal_id=[string]$job.signal_id;source_reference=[string]$job.source_reference;model_identifier=[string]$a.SYNTHESIS;input_hash=[string]$job.input_hash;output=$synthesis;status='ARTIFACT_READY';external_action_performed=$false;revenue_claimed=$false;payment_claimed=$false;fulfillment_claimed=$false;verification_claimed=$false;provenance=$job.provenance;model_panel=@{creator=$creator;critic_vision=$critic;synthesis=$synthesis}}
  ($artifact|ConvertTo-Json -Depth 70)|Set-Content -LiteralPath $ap -Encoding UTF8
  $oh=(Get-FileHash -LiteralPath $ap -Algorithm SHA256).Hash.ToLowerInvariant()
  $mp=Join-Path $md ([string]$job.job_id+'.json')
  $manifest=[ordered]@{schema='dreamledger/cube/lane-manifest/v1';schema_version=1;candidate_id=[string]$job.job_id;substrate_type=[string]$job.substrate_reference;substrate_requirements=@{required_fields=@([string]$job.requested_output);minimum_sample=1};demand_family=[string]$job.demand_family;transformation=@{name=([string]$job.transformation_family).ToUpperInvariant();worker='LOCAL_THREE_MODEL_REFINEMENT';steps=@('hash_source','visual_or_text_extract','normalize','compare_or_transform','preserve_unknowns','emit_evidence_packet')};buyer_output=@{format='structured_artifact';contains=@('source_reference','artifact_reference','output_hash','unknowns')};commercial_boundary=@{price_nzd=0;unit='candidate_only'};commerce_path=@{checkout='existing commerce rail; human gate';fulfillment='existing bounded fulfillment adapter';proof='EXISTING_PROOF_SPINE'};experiment=@{status='CANDIDATE';success_signal='external_settled_payment';promotion_rule='paid_verified_then_clone'};kill_criteria=@('source becomes stale','artifact validation fails','contradictory evidence','night batch exceeds economic envelope','paid trials -> zero verified outcomes')}
  ($manifest|ConvertTo-Json -Depth 70)|Set-Content -LiteralPath $mp -Encoding UTF8
  $pp=Join-Path $pd ([string]$job.job_id+'.json')
  $proof=[ordered]@{schema_version='DREAMLEDGER/LOCAL-BUILD-WORKER-PROOF/v2';job_id=[string]$job.job_id;signal_id=[string]$job.signal_id;model_assignments=@{creator=$a.CREATOR;critic_vision=$a.VISION;synthesis=$a.SYNTHESIS};server_endpoint=$script:LMStudioUrl;inference_status='READY_INFERENCE';gpu_status='UNOBSERVABLE';artifact_path=$ap;manifest_path=$mp;input_hash=[string]$job.input_hash;artifact_hash=$oh;external_action_performed=$false;revenue_claimed=$false}
  ($proof|ConvertTo-Json -Depth 60)|Set-Content -LiteralPath $pp -Encoding ASCII
  [ordered]@{artifact_path=$ap;manifest_path=$mp;proof_path=$pp;artifact_hash=$oh}
}
function RunOnce{
  $corr=[guid]::NewGuid().ToString()
  $claim=BridgeJson 'POST' ($BridgeUrl+'/api/agent-bridge/jobs/claim') @{worker_id=$WorkerId;lease_seconds=900}
  if(-not $claim.claimed){return [ordered]@{status='IDLE';worker_id=$WorkerId;correlation_id=$corr}}
  $job=$claim.job; $lease=[string]$claim.lease_token
  try{
    $lms=Get-Lms; $port=EnsureRuntime $lms
    if([string]::IsNullOrWhiteSpace($script:LMStudioUrl)){$script:LMStudioUrl='http://127.0.0.1:'+ $port}
    $script:LMStudioUrl=$script:LMStudioUrl.TrimEnd('/')
    if($script:LMStudioUrl -notmatch '/v1$'){$script:LMStudioUrl+='/v1'}
    $a=Assignments $lms
    $packet=[ordered]@{economic_truth=@{verified_external_revenue_nzd=0;settled_external_payments=0;independent_external_buyers=0};job=$job;mode='THREE_MODEL_ITERATIVE_REFINEMENT';external_action_policy='HUMAN_GATE'}
    [void](LoadModel $lms ([string]$a.CREATOR)); $creator=Stage ([string]$a.CREATOR) 'CREATOR' $packet $false; UnloadModel $lms ([string]$a.CREATOR)
    $packet.creator=$creator
    [void](LoadModel $lms ([string]$a.CRITIC)); $critic=Stage ([string]$a.CRITIC) 'CRITIC' $packet ([string]$a.VISION -eq [string]$a.CRITIC); UnloadModel $lms ([string]$a.CRITIC)
    $packet.critic=$critic
    [void](LoadModel $lms ([string]$a.SYNTHESIS)); $synthesis=Stage ([string]$a.SYNTHESIS) 'SYNTHESIS' $packet $false; UnloadModel $lms ([string]$a.SYNTHESIS)
    $build=$null; try{$build=$job.payload.build_job}catch{}
    $bo=$null; if($null -ne $build){$bo=WriteBuild $build $a $creator $critic $synthesis}
    $result=[ordered]@{schema_version='BEC-LMSTUDIO-THREE-MODEL-WORKER-1.0';worker_id=$WorkerId;job_id=[string]$job.job_id;job_type=[string]$job.job_type;correlation_id=$corr;status='ARTIFACT_READY';model_assignments=@{creator=$a.CREATOR;critic_vision=$a.VISION;synthesis=$a.SYNTHESIS};server_endpoint=$script:LMStudioUrl;refinement_round=1;creator=$creator;critic=$critic;synthesis=$synthesis;build_artifact=$bo;external_action_taken=$false;irreversible_effects_triggered=$false;revenue_claim=$false;sale_claim=$false;payment_claim=$false;fulfillment_claim=$false}
    $done=BridgeJson 'POST' ($BridgeUrl+'/api/agent-bridge/jobs/'+[uri]::EscapeDataString([string]$job.job_id)+'/complete') @{worker_id=$WorkerId;lease_token=$lease;result=$result}
    [ordered]@{status='COMPLETED';job_id=$job.job_id;model_assignments=$result.model_assignments;server_endpoint=$script:LMStudioUrl;bridge=$done;correlation_id=$corr}
  }catch{
    $msg=$_.Exception.Message
    try{$fail=BridgeJson 'POST' ($BridgeUrl+'/api/agent-bridge/jobs/'+[uri]::EscapeDataString([string]$job.job_id)+'/fail') @{worker_id=$WorkerId;lease_token=$lease;error=$msg;retryable=$true};[ordered]@{status='FAILED';job_id=$job.job_id;error=$msg;bridge=$fail;correlation_id=$corr}}
    catch{[ordered]@{status='FAILED_UNRECORDED';job_id=$job.job_id;error=$msg;failure_persistence_error=$_.Exception.Message;correlation_id=$corr}}
  }
}
do{try{RunOnce|ConvertTo-Json -Depth 70 -Compress}catch{@{status='WORKER_ERROR';error=$_.Exception.Message;worker_id=$WorkerId}|ConvertTo-Json -Depth 30 -Compress};if($Once){break};Start-Sleep -Seconds ([Math]::Max(5,$PollSeconds))}while($true)
