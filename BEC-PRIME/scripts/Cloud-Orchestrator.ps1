Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
function Need([string]$n){$v=[Environment]::GetEnvironmentVariable($n);if([string]::IsNullOrWhiteSpace($v)){throw "Missing required environment variable: $n"};return $v}
$base=(Need 'SUPABASE_URL').TrimEnd('/')
$key=if($env:SUPABASE_SECRET_KEY){$env:SUPABASE_SECRET_KEY}else{Need 'SUPABASE_SERVICE_ROLE_KEY'}
$h=@{apikey=$key;Authorization="Bearer $key";'Content-Type'='application/json';Accept='application/json'}
$run=if($env:GITHUB_RUN_ID){$env:GITHUB_RUN_ID}else{[guid]::NewGuid().ToString()}
$sha=if($env:GITHUB_SHA){$env:GITHUB_SHA}else{'local'}
$root=if($env:CLOUD_PROOF_ROOT){$env:CLOUD_PROOF_ROOT}else{Join-Path $PWD 'cloud-proof'}
$dir=Join-Path $root $run
New-Item -ItemType Directory -Force -Path $dir|Out-Null
function Rpc([string]$name,[hashtable]$args){$j=$args|ConvertTo-Json -Depth 40 -Compress;return Invoke-RestMethod -Uri "$base/rest/v1/rpc/$name" -Headers $h -Method Post -Body $j -TimeoutSec 30}
function GetRows([string]$table,[string]$query=''){ $u="$base/rest/v1/$table?select=*";if($query){$u+="&$query"};return @(Invoke-RestMethod -Uri $u -Headers $h -Method Get -TimeoutSec 30)}
function Patch([string]$table,[string]$query,[object]$body){$hh=@{}+$h;$hh.Prefer='return=representation';$j=$body|ConvertTo-Json -Depth 40 -Compress;return @(Invoke-RestMethod -Uri "$base/rest/v1/$table?$query" -Headers $hh -Method Patch -Body $j -TimeoutSec 30)}
function Insert([string]$table,[object]$body){$hh=@{}+$h;$hh.Prefer='return=representation';$j=@($body)|ConvertTo-Json -Depth 40 -Compress;return @(Invoke-RestMethod -Uri "$base/rest/v1/$table" -Headers $hh -Method Post -Body $j -TimeoutSec 30)}
function WriteProof([string]$name,[object]$body){$p=Join-Path $dir $name;[IO.File]::WriteAllText($p,($body|ConvertTo-Json -Depth 50),[Text.Encoding]::ASCII);return $p}
function Sha([string]$s){$x=[Security.Cryptography.SHA256]::Create();try{return ([BitConverter]::ToString($x.ComputeHash([Text.Encoding]::UTF8.GetBytes($s)))).Replace('-','').ToLowerInvariant()}finally{$x.Dispose()}}
function Prop($o,[string]$n){$p=$o.PSObject.Properties[$n];if($p){return $p.Value};return $null}
function RunOrchestrator {
    $worker="github-actions:$run"
    $reaped=Rpc 'reap_orchestrator_tasks' @{p_now=(Get-Date).ToUniversalTime().ToString('o')}
    $promoted=Rpc 'promote_retry_scheduled_tasks' @{p_now=(Get-Date).ToUniversalTime().ToString('o')}
    $processed=@()
    for($i=0;$i -lt 3;$i++){
        $claimed=@(Rpc 'claim_orchestrator_task' @{p_tier='cloud';p_worker=$worker;p_lease_seconds=300})
        if($claimed.Count -eq 0){break}
        $task=$claimed[0];$status='done';$result=@{};$err=$null
        try{
            if([string]$task.objective -eq 'health_probe'){$result=@{handler='health_probe';result=(Invoke-RestMethod -Uri 'https://dreamledger.org/healthz' -TimeoutSec 20)}}
            elseif([string]$task.objective -eq 'ecosystem.verify'){$result=@{handler='ecosystem.verify';result='cloud worker accepts this objective only as a deterministic control-plane signal'}}
            else{
                $api=$env:CLOUD_MODEL_API_URL;$ck=$env:CLOUD_MODEL_API_KEY;$model=$env:CLOUD_MODEL_NAME
                if([string]::IsNullOrWhiteSpace($api)-or[string]::IsNullOrWhiteSpace($ck)-or[string]::IsNullOrWhiteSpace($model)){throw 'Cloud reasoning fallback unavailable'}
                $input=@{role=$task.role;objective=$task.objective;input=$task.input;required_output_schema=$task.required_output_schema;max_turns=$task.max_turns;max_tool_calls=$task.max_tool_calls}
                $body=@{model=$model;messages=@(@{role='system';content='Return only JSON. Never claim external actions, payments, approvals, or verification without evidence.'},@{role='user';content=($input|ConvertTo-Json -Depth 40 -Compress)});temperature=0}|ConvertTo-Json -Depth 40 -Compress
                $result=@{handler='cloud_model';response=(Invoke-RestMethod -Uri $api -Headers @{Authorization="Bearer $ck";'Content-Type'='application/json'} -Method Post -Body $body -TimeoutSec ([Math]::Min([int]$task.timeout_seconds,240))}
            }
        }catch{$status='failed';$err=$_.Exception.Message}
        $resultText=$result|ConvertTo-Json -Depth 50 -Compress
        $finished=Rpc 'finish_orchestrator_task' @{p_task_id=$task.task_id;p_lease_token=$task.lease_token;p_worker=$worker;p_status=$status;p_result=@{worker_id=$worker;result=$result;result_sha256=(Sha $resultText);run_id=$run;commit_sha=$sha};p_error=$err}
        if(-not $finished){throw "Terminal close-out rejected for task $($task.task_id)"}
        $processed+=@{task_id=$task.task_id;status=$status;error=$err}
    }
    WriteProof 'orchestrator-tick.json' @{run_id=$run;commit_sha=$sha;worker=$worker;reaped=$reaped;promoted=$promoted;processed=$processed;generated_at=(Get-Date).ToUniversalTime().ToString('o')}|Out-Null
}
function RunProbe {
    $state=[ordered]@{run_id=$run;status='UNKNOWN';checked_at=(Get-Date).ToUniversalTime().ToString('o');endpoints=@{}}
    foreach($pair in @(@('health','https://dreamledger.org/healthz'),@('offers','https://dreamledger.org/api/offers'),@('billboard','https://dreamledger.org/billboard'))){try{$r=Invoke-WebRequest $pair[1] -UseBasicParsing -TimeoutSec 30;$state.endpoints[$pair[0]]=@{status_code=$r.StatusCode;ok=($r.StatusCode -eq 200);sha256=(Sha $r.Content)}}catch{$state.endpoints[$pair[0]]=@{ok=$false;error=$_.Exception.Message}}}
    $state.status=if(@($state.endpoints.Values|Where-Object{(Prop $_ 'ok') -ne $true}).Count -eq 0){'OK'}else{'UNKNOWN'}
    WriteProof 'scheduled-probe.json' $state|Out-Null
}
function RunLedger {$rows=GetRows 'dreamledger_evidence' 'select=sequence,event_id,previous_hash,event_hash&order=sequence.asc&limit=1000';$ok=$true;$prev=$null;$n=0;foreach($r in $rows){if($n -gt 0 -and $r.previous_hash -ne $prev){$ok=$false;break};$prev=$r.event_hash;$n++};WriteProof 'ledger-verification.json' @{run_id=$run;checked=$n;chain_continuity=$ok;last_hash=$prev;checked_at=(Get-Date).ToUniversalTime().ToString('o')}|Out-Null;if(-not $ok){throw 'Evidence chain continuity check failed.'}}
function RunDaily {$events=GetRows 'economic_events' 'select=*&order=created_at.desc&limit=1000';$paid=@($events|Where-Object{$_.payment_settled -eq $true});$verified=@($paid|Where-Object{$_.buyer_action_verified -eq $true -and $_.evidence_verified -eq $true});$sum=0;foreach($e in $paid){if($null -ne $e.amount_nzd){$sum+=[decimal]$e.amount_nzd}};WriteProof 'daily-state-report.json' @{run_id=$run;generated_at=(Get-Date).ToUniversalTime().ToString('o');event_count=$events.Count;payment_settled_count=$paid.Count;verified_count=$verified.Count;revenue_nzd=$sum}|Out-Null}
switch($env:CLOUD_ORCHESTRATOR_MODE){'orchestrator'{RunOrchestrator};'probe'{RunProbe};'ledger'{RunLedger};'daily'{RunDaily};default{throw 'Set CLOUD_ORCHESTRATOR_MODE to orchestrator, probe, ledger, or daily.'}}
