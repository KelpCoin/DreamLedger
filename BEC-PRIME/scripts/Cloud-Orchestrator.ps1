Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Need([string]$n) {
    $v = [Environment]::GetEnvironmentVariable($n)
    if ([string]::IsNullOrWhiteSpace($v)) { throw "Missing required environment variable: $n" }
    return $v
}

$base = (Need 'SUPABASE_URL').TrimEnd('/')
$key = if ($env:SUPABASE_SECRET_KEY) { $env:SUPABASE_SECRET_KEY } elseif ($env:SUPABASE_SERVICE_ROLE_KEY) { $env:SUPABASE_SERVICE_ROLE_KEY } else { Need 'SUPABASE_SERVICE_ROLE_KEY' }
$h = @{ apikey=$key; Authorization="Bearer $key"; 'Content-Type'='application/json' }
$run = if ($env:GITHUB_RUN_ID) { $env:GITHUB_RUN_ID } else { [guid]::NewGuid().ToString() }
$sha = if ($env:GITHUB_SHA) { $env:GITHUB_SHA } else { 'local' }
$root = if ($env:CLOUD_PROOF_ROOT) { $env:CLOUD_PROOF_ROOT } else { Join-Path $PWD 'cloud-proof' }
$dir = Join-Path $root $run
New-Item -ItemType Directory -Force -Path $dir | Out-Null

function GetRows([string]$table,[string]$query='') {
    $u="$base/rest/v1/$table?select=*"; if($query){$u+="&$query"}
    return @(Invoke-RestMethod -Uri $u -Headers $h -Method Get -TimeoutSec 30)
}
function Patch([string]$table,[string]$query,[object]$body) {
    $hh=@{}+$h; $hh.Prefer='return=representation'; $j=$body|ConvertTo-Json -Depth 30 -Compress
    return @(Invoke-RestMethod -Uri "$base/rest/v1/$table?$query" -Headers $hh -Method Patch -Body $j -TimeoutSec 30)
}
function Insert([string]$table,[object]$body) {
    $hh=@{}+$h; $hh.Prefer='return=representation'; $j=@($body)|ConvertTo-Json -Depth 30 -Compress
    return @(Invoke-RestMethod -Uri "$base/rest/v1/$table" -Headers $hh -Method Post -Body $j -TimeoutSec 30)
}
function WriteProof([string]$name,[object]$body) {
    $p=Join-Path $dir $name; [IO.File]::WriteAllText($p,($body|ConvertTo-Json -Depth 40),[Text.Encoding]::ASCII); return $p
}
function Sha([string]$s) {
    $x=[Security.Cryptography.SHA256]::Create(); try{return ([BitConverter]::ToString($x.ComputeHash([Text.Encoding]::UTF8.GetBytes($s)))).Replace('-','').ToLowerInvariant()} finally{$x.Dispose()}
}
function Prop($o,[string]$n) { $p=$o.PSObject.Properties[$n]; if($p){return $p.Value}; return $null }

function RunOrchestrator {
    $jobs=GetRows 'jobs' 'status=eq.pending&limit=20&order=created_at.asc'
    $picked=@($jobs|Where-Object{(Prop $_.payload 'tier') -eq 'cloud'}|Select-Object -First 3)
    $out=@()
    foreach($job in $picked){
        $claim=Patch 'jobs' "id=eq.$($job.id)&status=eq.pending" @{status='running';worker_id="github-actions:$run";leased_until=(Get-Date).ToUniversalTime().AddMinutes(10).ToString('o');started_at=(Get-Date).ToUniversalTime().ToString('o');lease_token=[guid]::NewGuid().ToString();attempt_count=([int]$job.attempt_count+1)}
        if($claim.Count -ne 1){continue}
        $status='completed';$result=@{};$err=$null
        try {
            $payload=$job.payload; $handler=Prop $payload 'deterministic_handler'
            if($handler -eq 'health_probe'){$result=@{handler='health_probe';result=(Invoke-RestMethod -Uri 'https://dreamledger.org/healthz' -TimeoutSec 20)}}
            elseif($handler){throw "Unknown deterministic handler: $handler"}
            else {
                $api=$env:CLOUD_MODEL_API_URL;$ck=$env:CLOUD_MODEL_API_KEY;$model=$env:CLOUD_MODEL_NAME
                if([string]::IsNullOrWhiteSpace($api)-or[string]::IsNullOrWhiteSpace($ck)-or[string]::IsNullOrWhiteSpace($model)){throw 'Cloud reasoning fallback unavailable: CLOUD_MODEL_API_URL, CLOUD_MODEL_API_KEY, and CLOUD_MODEL_NAME are required.'}
                $input=@{role=(Prop $payload 'role');objective=(Prop $payload 'objective');input=(Prop $payload 'input');required_output_schema=(Prop $payload 'required_output_schema')}
                $body=@{model=$model;messages=@(@{role='system';content='Return only JSON. Do not claim external actions or payments without evidence.'},@{role='user';content=($input|ConvertTo-Json -Depth 30 -Compress)});temperature=0}|ConvertTo-Json -Depth 30 -Compress
                $result=@{handler='cloud_model';response=(Invoke-RestMethod -Uri $api -Headers @{Authorization="Bearer $ck";'Content-Type'='application/json'} -Method Post -Body $body -TimeoutSec 120)}
            }
        } catch {$status='failed';$err=$_.Exception.Message}
        $payload=$job.payload
        $payload|Add-Member -NotePropertyName cloud_execution -NotePropertyValue ([ordered]@{task_id=[string]$job.id;status=$status;output=$result;error=$err;executed_by="github-actions:$run";executed_at=(Get-Date).ToUniversalTime().ToString('o');commit_sha=$sha}) -Force
        Patch 'jobs' "id=eq.$($job.id)&status=eq.running&worker_id=eq.github-actions:$run" @{status=$status;payload=$payload;completed_at=(Get-Date).ToUniversalTime().ToString('o');last_error=$err}|Out-Null
        $out+=@{task_id=$job.id;status=$status;error=$err}
    }
    WriteProof 'orchestrator-tick.json' @{run_id=$run;commit_sha=$sha;processed=$out;generated_at=(Get-Date).ToUniversalTime().ToString('o')}|Out-Null
}

function RunProbe {
    $started=Get-Date;$state=[ordered]@{run_id=$run;status='UNKNOWN';endpoints=@{};baseline=@{};checked_at=(Get-Date).ToUniversalTime().ToString('o')}
    $baseline=Get-Content (Join-Path $PSScriptRoot '..\config\public-surface-baseline.json') -Raw|ConvertFrom-Json
    $known=@($baseline.offers)
    try{$r=Invoke-WebRequest 'https://dreamledger.org/healthz' -UseBasicParsing -TimeoutSec 30;$state.endpoints.health=@{status_code=$r.StatusCode;ok=($r.StatusCode -eq 200);sha256=(Sha $r.Content)}}catch{$state.endpoints.health=@{ok=$false;error=$_.Exception.Message}}
    try{$r=Invoke-WebRequest 'https://dreamledger.org/api/offers' -UseBasicParsing -TimeoutSec 30;$json=$r.Content|ConvertFrom-Json;$ids=@($json|ForEach-Object{if((Prop $_ 'offer_id')){[string](Prop $_ 'offer_id')}elseif((Prop $_ 'id')){[string](Prop $_ 'id')}}|Sort-Object -Unique);$missing=@($known|Where-Object{$_ -notin $ids});$unexpected=@($ids|Where-Object{$_ -notin $known});$state.endpoints.offers=@{status_code=$r.StatusCode;ok=($r.StatusCode -eq 200);sha256=(Sha $r.Content);offer_ids=$ids;missing=$missing;unexpected=$unexpected}}catch{$state.endpoints.offers=@{ok=$false;error=$_.Exception.Message}}
    try{$r=Invoke-WebRequest 'https://dreamledger.org/billboard' -UseBasicParsing -TimeoutSec 30;$state.endpoints.billboard=@{status_code=$r.StatusCode;ok=($r.StatusCode -eq 200);sha256=(Sha $r.Content)}}catch{$state.endpoints.billboard=@{ok=$false;error=$_.Exception.Message}}
    $drift=(@($state.endpoints.offers.missing).Count -gt 0 -or @($state.endpoints.offers.unexpected).Count -gt 0)
    $reachable=(@($state.endpoints.Values|Where-Object{(Prop $_ 'ok') -ne $true}).Count -eq 0)
    $state.status=if($reachable -and -not $drift){'OK'}elseif($reachable){'CONTRADICTED'}else{'UNKNOWN'}
    $state.duration_ms=[int]((Get-Date)-$started).TotalMilliseconds
    WriteProof 'scheduled-probe.json' $state|Out-Null
    $health=@{component='cloud.scheduled_probe';status=$state.status;last_success=if($state.status -eq 'OK'){$state.checked_at}else{$null};last_failure=if($state.status -ne 'OK'){$state.checked_at}else{$null};duration_ms=$state.duration_ms;version=$sha;details=$state;updated_at=$state.checked_at}
    $existing=Patch 'system_health' 'component=eq.cloud.scheduled_probe' $health
    if($existing.Count -eq 0){Insert 'system_health' $health|Out-Null}
    if($state.status -eq 'CONTRADICTED'){Insert 'truth_oracle_claims' @{claim_key="probe:$run";subject='dreamledger.org /api/offers';claim='Production offer set differs from the verified baseline.';claim_type='IMPLEMENTATION';verdict='CONTRADICTED';confidence=1;evidence_required=$true;oracle_notes=($state|ConvertTo-Json -Depth 30 -Compress);last_verified_at=$state.checked_at}|Out-Null}
}

function RunLedger {
    $rows=GetRows 'dreamledger_evidence' 'select=sequence,event_id,previous_hash,event_hash&order=sequence.asc&limit=1000';$ok=$true;$prev=$null;$n=0
    foreach($r in $rows){if($n -gt 0 -and $r.previous_hash -ne $prev){$ok=$false;break};$prev=$r.event_hash;$n++}
    WriteProof 'ledger-verification.json' @{run_id=$run;checked=$n;chain_continuity=$ok;last_hash=$prev;checked_at=(Get-Date).ToUniversalTime().ToString('o')}|Out-Null
    if(-not $ok){throw 'Evidence chain continuity check failed.'}
}

function RunDaily {
    $events=GetRows 'economic_events' 'select=*&order=created_at.desc&limit=1000';$paid=@($events|Where-Object{$_.payment_settled -eq $true});$verified=@($paid|Where-Object{$_.buyer_action_verified -eq $true -and $_.evidence_verified -eq $true});$sum=0;foreach($e in $paid){if($null -ne $e.amount_nzd){$sum+=[decimal]$e.amount_nzd}}
    WriteProof 'daily-state-report.json' @{run_id=$run;generated_at=(Get-Date).ToUniversalTime().ToString('o');event_count=$events.Count;payment_settled_count=$paid.Count;verified_count=$verified.Count;revenue_nzd=$sum;events=$events}|Out-Null
}

switch($env:CLOUD_ORCHESTRATOR_MODE){'orchestrator'{RunOrchestrator};'probe'{RunProbe};'ledger'{RunLedger};'daily'{RunDaily};default{throw 'Set CLOUD_ORCHESTRATOR_MODE to orchestrator, probe, ledger, or daily.'}}
