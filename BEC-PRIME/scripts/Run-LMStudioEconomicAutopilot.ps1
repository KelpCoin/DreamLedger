#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

param(
    [string]$BridgeUrl = $env:DREAMLEDGER_AGENT_BRIDGE_URL,
    [string]$BridgeToken = $env:DREAMLEDGER_AGENT_BRIDGE_TOKEN,
    [string]$WorkerId = $env:DREAMLEDGER_LMSTUDIO_WORKER_ID,
    [string]$LMStudioUrl = $(if ($env:LM_STUDIO_URL) { $env:LM_STUDIO_URL } elseif ($env:LM_STUDIO_BASE_URL) { $env:LM_STUDIO_BASE_URL } else { '' }),
    [int]$PollSeconds = 15,
    [int]$MaxOutputTokens = 1400,
    [switch]$Once
)

function Fail([string]$Message) { throw $Message }

if ([string]::IsNullOrWhiteSpace($BridgeUrl)) { Fail 'DREAMLEDGER_AGENT_BRIDGE_URL is required' }
if ([string]::IsNullOrWhiteSpace($BridgeToken)) { Fail 'DREAMLEDGER_AGENT_BRIDGE_TOKEN is required' }
if ([string]::IsNullOrWhiteSpace($WorkerId)) { $WorkerId = 'lmstudio-economic-' + $env:COMPUTERNAME }

$BridgeUrl = $BridgeUrl.TrimEnd('/')
$LMStudioUrl = $LMStudioUrl.TrimEnd('/')

function Get-LmsExecutable {
    $c = Get-Command lms.exe -ErrorAction SilentlyContinue
    if ($c) { return $c.Source }
    $c = Get-Command lms -ErrorAction SilentlyContinue
    if ($c) { return $c.Source }
    foreach ($p in @((Join-Path $env:USERPROFILE '.lmstudio\\bin\\lms.exe'),(Join-Path $env:LOCALAPPDATA 'LM-Studio\\bin\\lms.exe'))) {
        if (Test-Path -LiteralPath $p) { return $p }
    }
    Fail 'LMS_EXECUTABLE_NOT_FOUND'
}

function Invoke-LmsJson([string]$Lms,[string[]]$Args) {
    $o = & $Lms @Args 2>&1
    if ($LASTEXITCODE -ne 0) { Fail ('LMS_COMMAND_FAILED:' + ($o -join ' ')) }
    try { return ($o -join [Environment]::NewLine | ConvertFrom-Json) } catch { Fail ('LMS_JSON_INVALID:' + ($o -join ' ')) }
}

function Ensure-LmsRuntime([string]$Lms) {
    $d = Invoke-LmsJson $Lms @('daemon','status','--json')
    if ([string]$d.status -ne 'running') { [void](& $Lms daemon up); $d = Invoke-LmsJson $Lms @('daemon','status','--json') }
    if ([string]$d.status -ne 'running') { Fail 'SERVER_UNAVAILABLE:LLMSTER_DAEMON' }
    $s = Invoke-LmsJson $Lms @('server','status','--json','--quiet')
    if (-not [bool]$s.running) { [void](& $Lms server start); $s = Invoke-LmsJson $Lms @('server','status','--json','--quiet') }
    if (-not [bool]$s.running -or [int]$s.port -le 0) { Fail 'SERVER_UNAVAILABLE:LM_SERVER' }
    if ([string]::IsNullOrWhiteSpace($script:LMStudioUrl)) { $script:LMStudioUrl = 'http://127.0.0.1:' + [int]$s.port }
    $script:LMStudioUrl = $script:LMStudioUrl.TrimEnd('/')
    if ($script:LMStudioUrl -notmatch '/v1

$Headers = @{
    'x-dreamledger-agent-token' = $BridgeToken
    'Accept' = 'application/json'
}

function Invoke-Json {
    param(
        [string]$Method,
        [string]$Url,
        [object]$Body = $null,
        [hashtable]$ExtraHeaders = @{}
    )
    $h = @{}
    foreach ($k in $Headers.Keys) { $h[$k] = $Headers[$k] }
    foreach ($k in $ExtraHeaders.Keys) { $h[$k] = $ExtraHeaders[$k] }
    $p = @{ Uri=$Url; Method=$Method; Headers=$h; ErrorAction='Stop'; TimeoutSec=120 }
    if ($null -ne $Body) {
        $p.ContentType='application/json'
        $p.Body=($Body | ConvertTo-Json -Depth 30 -Compress)
    }
    return Invoke-RestMethod @p
}

function Get-LMModel([string]$Lms) {
    $r = Invoke-RestMethod -Uri ($LMStudioUrl + '/v1/models') -Method Get -TimeoutSec 15
    $m = @($r.data | Where-Object { $_.id } | Select-Object -First 1)
    if ($m.Count -eq 0) { Fail 'MODEL_DISCOVERED:NO_MODELS_RETURNED' }
    $model = if ($env:LM_STUDIO_MODEL) { [string]$env:LM_STUDIO_MODEL } else { [string]$m[0].id }
    if (@($m.id) -notcontains $model) { Fail 'MODEL_NOT_EXPOSED:' + $model }
    $loaded = Get-LoadedModelIds $Lms
    if ($loaded -notcontains $model) {
        $help = & $Lms load --help 2>&1
        $args = @('load',$model)
        if (($help -join ' ') -match '--gpu') { $args += '--gpu=max' }
        [void](& $Lms @args)
        $loaded = Get-LoadedModelIds $Lms
    }
    if ($loaded -notcontains $model) { Fail 'MODEL_LOADED_FALSE:' + $model }
    return $model
}

function Get-GpuStatus([string]$Lms) {
    $p = Invoke-LmsJson $Lms @('ps','--json') | ConvertTo-Json -Depth 30 -Compress
    if ($p -match '(?i)gpu' -and $p -match '(?i)(offload|gpu_memory|gpu.*[0-9]+|[0-9]+.*gpu)') { return 'VERIFIED_FROM_LMS_PS' }
    return 'UNOBSERVABLE'
}

function Write-BuildArtifact([object]$BuildJob,[string]$Model,[string]$ResultText,[string]$GpuStatus) {
    $root = Join-Path $PSScriptRoot '..\\..'; $artifactDir = Join-Path $root 'runtime\\777\\local-build-artifacts'; $manifestDir = Join-Path $root 'runtime\\cube\\manifests'; $proofDir = Join-Path $root 'runtime\\777\\local-worker-proofs'
    New-Item -ItemType Directory -Force -Path $artifactDir,$manifestDir,$proofDir | Out-Null
    $inputJson = $BuildJob | ConvertTo-Json -Depth 30 -Compress
    $inputHash = [System.BitConverter]::ToString(([System.Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($inputJson)))).Replace('-','').ToLower()
    $artifactPath = Join-Path $artifactDir ($BuildJob.job_id + '.json')
    $artifact = [ordered]@{schema_version='DREAMLEDGER/LOCAL-BUILD-ARTIFACT/v1';job_id=$BuildJob.job_id;signal_id=$BuildJob.signal_id;source_reference=$BuildJob.source_reference;model_identifier=$Model;input_hash=$inputHash;output=$ResultText;status='ARTIFACT_READY';external_action_performed=$false;revenue_claimed=$false;payment_claimed=$false;fulfillment_claimed=$false;verification_claimed=$false;provenance=$BuildJob.provenance}
    $artifactJson = $artifact | ConvertTo-Json -Depth 40
    [IO.File]::WriteAllText($artifactPath,$artifactJson + [Environment]::NewLine,(New-Object Text.UTF8Encoding($false)))
    $outputHash = (Get-FileHash -LiteralPath $artifactPath -Algorithm SHA256).Hash.ToLower()
    $manifestPath = Join-Path $manifestDir ($BuildJob.job_id + '.json')
    $manifest = [ordered]@{candidate_id=$BuildJob.job_id;substrate_type=$BuildJob.substrate_reference;substrate_requirements=$BuildJob.substrate_reference;signal_id=$BuildJob.signal_id;demand_family=$BuildJob.demand_family;transformation=@{name=$BuildJob.transformation_family;worker_role=$BuildJob.worker_role;model_identifier=$Model};buyer_output=@{format='structured_artifact';artifact_reference=$artifactPath;output_hash=$outputHash;contains=@('source-grounded internal artifact')};commercial_boundary=@{price_nzd=0;external_action_required=$true;approval_required=$true;revenue_claim_allowed=$false};commerce_path=@{checkout='existing commerce rail';fulfillment='existing bounded fulfillment adapter';proof='EXISTING_PROOF_SPINE'};kill_criteria=@('source becomes stale','artifact validation fails','contradictory evidence');provenance=@{signal_id=$BuildJob.signal_id;build_job_id=$BuildJob.job_id;source_reference=$BuildJob.source_reference;input_hash=$inputHash;artifact_hash=$outputHash}}
    $manifest | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
    $proofPath = Join-Path $proofDir ($BuildJob.job_id + '.json')
    @{schema_version='DREAMLEDGER/LOCAL-BUILD-WORKER-PROOF/v1';job_id=$BuildJob.job_id;signal_id=$BuildJob.signal_id;model_id=$Model;server_endpoint=$LMStudioUrl;inference_status='READY_INFERENCE';gpu_status=$GpuStatus;artifact_path=$artifactPath;manifest_path=$manifestPath;input_hash=$inputHash;output_hash=$outputHash;external_action_performed=$false;revenue_claimed=$false} | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath $proofPath -Encoding ASCII
    return @{artifact_path=$artifactPath;manifest_path=$manifestPath;proof_path=$proofPath;input_hash=$inputHash;output_hash=$outputHash;gpu_status=$GpuStatus}
}

function Invoke-LM {
    param([string]$Model,[string]$Objective,[object]$Job)
    $system = @'
You are the local economic worker for DreamLedger/BrownEye.

Operate as a bounded Worker A. You may inspect, reason, classify, propose,
compile, test, and prepare evidence. You must not claim external revenue,
invent buyers, invent payments, publish externally, spend money, alter
authorization, reveal secrets, or certify economic truth.

Treat external reality as authoritative.
Treat UNVERIFIED as UNVERIFIED.
Prefer the smallest executable action.
Return JSON-compatible structured prose with:
status, decision, actions, evidence_needed, risks, next_step.

If the job requests an irreversible/public/financial action, stop at the
approval boundary and report APPROVAL_REQUIRED rather than performing it.
'@
    $user = @{
        objective=$Objective
        job_type=[string]$Job.job_type
        job_id=[string]$Job.job_id
        payload=$Job.payload
        approval_gate=$Job.approval_gate
        next_permitted_action=$Job.next_permitted_action
        instruction='Execute only within the Worker A boundary. Produce an implementation/result artifact, not a revenue claim.'
    }
    $body = @{
        model=$Model
        messages=@(
            @{role='system';content=$system},
            @{role='user';content=($user | ConvertTo-Json -Depth 30)}
        )
        temperature=0.1
        max_tokens=$MaxOutputTokens
        stream=$false
    }
    $r = Invoke-RestMethod -Uri ($LMStudioUrl + '/v1/chat/completions') -Method Post -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 30) -TimeoutSec 600
    $text = [string]$r.choices[0].message.content
    if ([string]::IsNullOrWhiteSpace($text)) { Fail 'LM Studio returned no worker result' }
    return $text
}

function Run-Once {
    $correlation = [guid]::NewGuid().ToString()
    $claim = Invoke-Json 'POST' ($BridgeUrl + '/api/agent-bridge/jobs/claim') @{
        worker_id=$WorkerId
        lease_seconds=900
    } @{ 'x-correlation-id'=$correlation }

    if (-not $claim.claimed) {
        return @{status='IDLE';worker_id=$WorkerId;correlation_id=$correlation}
    }

    $job = $claim.job
    $leaseToken = [string]$claim.lease_token
    if ([string]::IsNullOrWhiteSpace($leaseToken)) { Fail 'Bridge lease did not return lease_token' }

    try {
        $lms = Get-LmsExecutable
        [void](Ensure-LmsRuntime $lms)
        $model = Get-LMModel $lms
        $objective = [string]$job.objective
        if ([string]::IsNullOrWhiteSpace($objective)) {
            $objective = [string]$job.payload.mission
        }
        if ([string]::IsNullOrWhiteSpace($objective)) {
            $objective = [string]$job.job_type
        }

        $buildJob = $job.payload.build_job
        $resultText = Invoke-LM $model $objective $job
        $buildArtifact = $null
        if ($null -ne $buildJob) {
            $gpuStatus = Get-GpuStatus $lms
            $buildArtifact = Write-BuildArtifact $buildJob $model $resultText $gpuStatus
        }
        $result = [ordered]@{
            schema_version='BEC-LMSTUDIO-WORKER-1.0'
            worker_id=$WorkerId
            model=$model
            job_id=[string]$job.job_id
            job_type=[string]$job.job_type
            correlation_id=$correlation
            status='ARTIFACT_READY'
            external_action_taken=$false
            irreversible_effects_triggered=$false
            revenue_claim=$false
            sale_claim=$false
            payment_claim=$false
            fulfillment_claim=$false
            result=$resultText
            build_artifact=$buildArtifact
            gpu_status=$(if($buildArtifact){$buildArtifact.gpu_status}else{'UNOBSERVABLE'})
        }

        $completePath = '/api/agent-bridge/jobs/' + [uri]::EscapeDataString([string]$job.job_id) + '/complete'
        $done = Invoke-Json 'POST' ($BridgeUrl + $completePath) @{
            worker_id=$WorkerId
            lease_token=$leaseToken
            result=$result
        } @{ 'x-correlation-id'=$correlation }

        return @{status='COMPLETED';job_id=$job.job_id;model=$model;bridge=$done;correlation_id=$correlation}
    }
    catch {
        $message = $_.Exception.Message
        $failPath = '/api/agent-bridge/jobs/' + [uri]::EscapeDataString([string]$job.job_id) + '/fail'
        try {
            $failed = Invoke-Json 'POST' ($BridgeUrl + $failPath) @{
                worker_id=$WorkerId
                lease_token=$leaseToken
                error=$message
                retryable=$true
            } @{ 'x-correlation-id'=$correlation }
            return @{status='FAILED';job_id=$job.job_id;bridge=$failed;error=$message;correlation_id=$correlation}
        }
        catch {
            return @{status='FAILED_UNRECORDED';job_id=$job.job_id;error=$message;failure_persistence_error=$_.Exception.Message;correlation_id=$correlation}
        }
    }
}

do {
    try {
        $result = Run-Once
        $result | ConvertTo-Json -Depth 30 -Compress
    }
    catch {
        @{status='WORKER_ERROR';error=$_.Exception.Message;worker_id=$WorkerId} | ConvertTo-Json -Depth 20 -Compress
    }
    if ($Once) { break }
    Start-Sleep -Seconds ([Math]::Max(5,$PollSeconds))
} while ($true)
) { $script:LMStudioUrl += '/v1' }
    return $s
}

function Get-LoadedModelIds([string]$Lms) {
    $p = Invoke-LmsJson $Lms @('ps','--json')
    $items = if ($p.models) { @($p.models) } elseif ($p.data) { @($p.data) } elseif ($p -is [array]) { @($p) } else { @() }
    return @($items | ForEach-Object { if ($_.identifier) { [string]$_.identifier } else { [string]$_.id } } | Where-Object { $_ })
}

$Headers = @{
    'x-dreamledger-agent-token' = $BridgeToken
    'Accept' = 'application/json'
}

function Invoke-Json {
    param(
        [string]$Method,
        [string]$Url,
        [object]$Body = $null,
        [hashtable]$ExtraHeaders = @{}
    )
    $h = @{}
    foreach ($k in $Headers.Keys) { $h[$k] = $Headers[$k] }
    foreach ($k in $ExtraHeaders.Keys) { $h[$k] = $ExtraHeaders[$k] }
    $p = @{ Uri=$Url; Method=$Method; Headers=$h; ErrorAction='Stop'; TimeoutSec=120 }
    if ($null -ne $Body) {
        $p.ContentType='application/json'
        $p.Body=($Body | ConvertTo-Json -Depth 30 -Compress)
    }
    return Invoke-RestMethod @p
}

function Get-LMModel {
    $r = Invoke-RestMethod -Uri ($LMStudioUrl + '/v1/models') -Method Get -TimeoutSec 15
    $m = @($r.data | Where-Object { $_.id } | Select-Object -First 1)
    if ($m.Count -eq 0) { Fail 'No LM Studio model is visible at ' + $LMStudioUrl }
    return [string]$m[0].id
}

function Invoke-LM {
    param([string]$Model,[string]$Objective,[object]$Job)
    $system = @'
You are the local economic worker for DreamLedger/BrownEye.

Operate as a bounded Worker A. You may inspect, reason, classify, propose,
compile, test, and prepare evidence. You must not claim external revenue,
invent buyers, invent payments, publish externally, spend money, alter
authorization, reveal secrets, or certify economic truth.

Treat external reality as authoritative.
Treat UNVERIFIED as UNVERIFIED.
Prefer the smallest executable action.
Return JSON-compatible structured prose with:
status, decision, actions, evidence_needed, risks, next_step.

If the job requests an irreversible/public/financial action, stop at the
approval boundary and report APPROVAL_REQUIRED rather than performing it.
'@
    $user = @{
        objective=$Objective
        job_type=[string]$Job.job_type
        job_id=[string]$Job.job_id
        payload=$Job.payload
        approval_gate=$Job.approval_gate
        next_permitted_action=$Job.next_permitted_action
        instruction='Execute only within the Worker A boundary. Produce an implementation/result artifact, not a revenue claim.'
    }
    $body = @{
        model=$Model
        messages=@(
            @{role='system';content=$system},
            @{role='user';content=($user | ConvertTo-Json -Depth 30)}
        )
        temperature=0.1
        max_tokens=$MaxOutputTokens
        stream=$false
    }
    $r = Invoke-RestMethod -Uri ($LMStudioUrl + '/v1/chat/completions') -Method Post -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 30) -TimeoutSec 600
    $text = [string]$r.choices[0].message.content
    if ([string]::IsNullOrWhiteSpace($text)) { Fail 'LM Studio returned no worker result' }
    return $text
}

function Run-Once {
    $correlation = [guid]::NewGuid().ToString()
    $claim = Invoke-Json 'POST' ($BridgeUrl + '/api/agent-bridge/jobs/claim') @{
        worker_id=$WorkerId
        lease_seconds=900
    } @{ 'x-correlation-id'=$correlation }

    if (-not $claim.claimed) {
        return @{status='IDLE';worker_id=$WorkerId;correlation_id=$correlation}
    }

    $job = $claim.job
    $leaseToken = [string]$claim.lease_token
    if ([string]::IsNullOrWhiteSpace($leaseToken)) { Fail 'Bridge lease did not return lease_token' }

    try {
        $model = Get-LMModel
        $objective = [string]$job.objective
        if ([string]::IsNullOrWhiteSpace($objective)) {
            $objective = [string]$job.payload.mission
        }
        if ([string]::IsNullOrWhiteSpace($objective)) {
            $objective = [string]$job.job_type
        }

        $resultText = Invoke-LM $model $objective $job
        $result = [ordered]@{
            schema_version='BEC-LMSTUDIO-WORKER-1.0'
            worker_id=$WorkerId
            model=$model
            job_id=[string]$job.job_id
            job_type=[string]$job.job_type
            correlation_id=$correlation
            status='ARTIFACT_READY'
            external_action_taken=$false
            irreversible_effects_triggered=$false
            revenue_claim=$false
            sale_claim=$false
            payment_claim=$false
            fulfillment_claim=$false
            result=$resultText
        }

        $completePath = '/api/agent-bridge/jobs/' + [uri]::EscapeDataString([string]$job.job_id) + '/complete'
        $done = Invoke-Json 'POST' ($BridgeUrl + $completePath) @{
            worker_id=$WorkerId
            lease_token=$leaseToken
            result=$result
        } @{ 'x-correlation-id'=$correlation }

        return @{status='COMPLETED';job_id=$job.job_id;model=$model;bridge=$done;correlation_id=$correlation}
    }
    catch {
        $message = $_.Exception.Message
        $failPath = '/api/agent-bridge/jobs/' + [uri]::EscapeDataString([string]$job.job_id) + '/fail'
        try {
            $failed = Invoke-Json 'POST' ($BridgeUrl + $failPath) @{
                worker_id=$WorkerId
                lease_token=$leaseToken
                error=$message
                retryable=$true
            } @{ 'x-correlation-id'=$correlation }
            return @{status='FAILED';job_id=$job.job_id;bridge=$failed;error=$message;correlation_id=$correlation}
        }
        catch {
            return @{status='FAILED_UNRECORDED';job_id=$job.job_id;error=$message;failure_persistence_error=$_.Exception.Message;correlation_id=$correlation}
        }
    }
}

do {
    try {
        $result = Run-Once
        $result | ConvertTo-Json -Depth 30 -Compress
    }
    catch {
        @{status='WORKER_ERROR';error=$_.Exception.Message;worker_id=$WorkerId} | ConvertTo-Json -Depth 20 -Compress
    }
    if ($Once) { break }
    Start-Sleep -Seconds ([Math]::Max(5,$PollSeconds))
} while ($true)
