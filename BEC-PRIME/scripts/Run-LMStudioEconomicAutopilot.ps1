#Requires -Version 5.1
param(
    [string]$BridgeUrl = $env:DREAMLEDGER_AGENT_BRIDGE_URL,
    [string]$BridgeToken = $env:DREAMLEDGER_AGENT_BRIDGE_TOKEN,
    [string]$WorkerId = $env:DREAMLEDGER_LMSTUDIO_WORKER_ID,
    [string]$LMStudioBaseUrl = $env:LM_STUDIO_BASE_URL,
    [int]$PollSeconds = 15,
    [int]$MaxOutputTokens = 1400,
    [switch]$Once
)


Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

param(
    [string]$BridgeUrl = $env:DREAMLEDGER_AGENT_BRIDGE_URL,
    [string]$BridgeToken = $env:DREAMLEDGER_AGENT_BRIDGE_TOKEN,
    [string]$WorkerId = $env:DREAMLEDGER_LMSTUDIO_WORKER_ID,
    [string]$LMStudioBaseUrl = $env:LM_STUDIO_BASE_URL,
    [int]$PollSeconds = 15,
    [int]$MaxOutputTokens = 1400,
    [switch]$Once
)

function Fail([string]$Message) { throw $Message }
if ([string]::IsNullOrWhiteSpace($BridgeUrl)) { Fail 'DREAMLEDGER_AGENT_BRIDGE_URL is required' }
if ([string]::IsNullOrWhiteSpace($BridgeToken)) { Fail 'DREAMLEDGER_AGENT_BRIDGE_TOKEN is required' }
if ([string]::IsNullOrWhiteSpace($WorkerId)) { $WorkerId = 'lmstudio-economic-' + $env:COMPUTERNAME }

$BridgeUrl = $BridgeUrl.TrimEnd('/')
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$ArtifactRoot = Join-Path $RepoRoot 'runtime\777\local-build-artifacts'
$ManifestRoot = Join-Path $RepoRoot 'runtime\cube\manifests'
$ProofRoot = Join-Path $RepoRoot 'runtime\777\local-worker-proofs'
New-Item -ItemType Directory -Force -Path $ArtifactRoot,$ManifestRoot,$ProofRoot | Out-Null

function Hash-String([string]$Value) {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [Text.Encoding]::UTF8.GetBytes($Value)
        return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-','').ToLowerInvariant()
    } finally { $sha.Dispose() }
}

function Get-LmsExecutable {
    $cmd = Get-Command lms.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $cmd = Get-Command lms -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $candidates = @(
        (Join-Path $env:USERPROFILE '.lmstudio\bin\lms.exe'),
        (Join-Path $env:LOCALAPPDATA 'LM-Studio\bin\lms.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\LM Studio\resources\app\.webpack\bin\lms.exe')
    )
    foreach ($p in $candidates) { if (Test-Path -LiteralPath $p) { return $p } }
    Fail 'LMS_EXECUTABLE_NOT_FOUND'
}

function Invoke-Lms {
    param([string]$Lms,[string[]]$Arguments)
    $output = & $Lms @Arguments 2>&1
    $code = $LASTEXITCODE
    [pscustomobject]@{ Code=$code; Text=(($output | ForEach-Object { [string]$_ }) -join [Environment]::NewLine) }
}

function Invoke-LmsJson {
    param([string]$Lms,[string[]]$Arguments)
    $r = Invoke-Lms $Lms $Arguments
    if ($r.Code -ne 0) { Fail ('LMS_COMMAND_FAILED:' + $r.Text) }
    try { return ($r.Text | ConvertFrom-Json) } catch { Fail ('LMS_JSON_INVALID:' + $r.Text) }
}

function Ensure-LmsRuntime([string]$Lms) {
    $daemon = Invoke-LmsJson $Lms @('daemon','status','--json')
    if ([string]$daemon.status -ne 'running') {
        [void](Invoke-Lms $Lms @('daemon','up'))
        $daemon = Invoke-LmsJson $Lms @('daemon','status','--json')
    }
    if ([string]$daemon.status -ne 'running') { Fail 'SERVER_UNAVAILABLE:LLMSTER_DAEMON' }

    $server = Invoke-LmsJson $Lms @('server','status','--json','--quiet')
    if (-not [bool]$server.running) {
        [void](Invoke-Lms $Lms @('server','start'))
        $server = Invoke-LmsJson $Lms @('server','status','--json','--quiet')
    }
    if (-not [bool]$server.running) { Fail 'SERVER_UNAVAILABLE:LM_SERVER' }

    $port = [int]$server.port
    if ($port -le 0) { Fail 'SERVER_ENDPOINT_UNOBSERVABLE' }
    $script:ResolvedBaseUrl = if ($LMStudioBaseUrl) { $u=$LMStudioBaseUrl.TrimEnd('/'); if ($u -notmatch '/v1
    [ordered]@{ daemon_status=[string]$daemon.status; server_status='running'; endpoint=$script:ResolvedBaseUrl; port=$port }
}

function Get-ApiModels {
    $r = Invoke-RestMethod -Uri ($script:ResolvedBaseUrl + '/models') -Method Get -TimeoutSec 15
    $models = @($r.data | Where-Object { $_.id } | ForEach-Object { [string]$_.id })
    if ($models.Count -eq 0) { Fail 'MODEL_DISCOVERED:NO_MODELS_RETURNED' }
    return $models
}

function Get-LoadedModels([string]$Lms) {
    $r = Invoke-LmsJson $Lms @('ps','--json')
    $items = @()
    if ($r -is [array]) { $items = @($r) }
    elseif ($null -ne $r.models) { $items = @($r.models) }
    elseif ($null -ne $r.data) { $items = @($r.data) }
    $ids = @()
    foreach ($item in $items) {
        $id = [string]$item.identifier
        if ([string]::IsNullOrWhiteSpace($id)) { $id = [string]$item.id }
        if (-not [string]::IsNullOrWhiteSpace($id)) { $ids += $id }
    }
    return $ids
}

function Ensure-Model([string]$Lms) {
    $available = Get-ApiModels
    $loaded = Get-LoadedModels $Lms
    $model = if ($env:LM_STUDIO_MODEL) { [string]$env:LM_STUDIO_MODEL } else { [string]$available[0] }
    if ($available -notcontains $model) { Fail ('MODEL_DISCOVERED_BUT_NOT_EXPOSED:' + $model) }

    if ($loaded -notcontains $model) {
        $help = Invoke-Lms $Lms @('load','--help')
        $args = @('load',$model)
        if ($help.Text -match '--gpu') { $args += '--gpu=max' }
        [void](Invoke-Lms $Lms $args)
    }

    $loadedAfter = Get-LoadedModels $Lms
    if ($loadedAfter -notcontains $model) { Fail ('MODEL_LOADED_FALSE:' + $model) }
    [ordered]@{ model_id=$model; model_discovered=$true; model_loaded=$true; loaded_models=$loadedAfter }
}

function Invoke-ReadyInference([string]$Model,[object]$Job) {
    $body = @{
        model = $Model
        messages = @(
            @{ role='system'; content='You are a bounded DreamLedger local build worker. Never invent buyers, payments, revenue, fulfillment, verification, evidence, or external actions. Produce only a useful internal artifact.' },
            @{ role='user'; content=(@{ job=$Job; instruction='Transform this demand signal into a structured internal build artifact. Preserve uncertainty and provenance. Do not claim an economic outcome.' } | ConvertTo-Json -Depth 30 -Compress) }
        )
        temperature = 0.1
        max_tokens = $MaxOutputTokens
        stream = $false
    }
    $r = Invoke-RestMethod -Uri ($script:ResolvedBaseUrl + '/chat/completions') -Method Post -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 30) -TimeoutSec 600
    $text = [string]$r.choices[0].message.content
    if ([string]::IsNullOrWhiteSpace($text)) { Fail 'READY_INFERENCE_FAILED:EMPTY_OUTPUT' }
    return $text
}

function Get-GpuStatus([string]$Lms) {
    $r = Invoke-LmsJson $Lms @('ps','--json')
    $json = $r | ConvertTo-Json -Depth 30 -Compress
    if ($json -match '(?i)gpu' -and $json -match '(?i)(offload|gpu_memory|gpu.*[0-9]+|[0-9]+.*gpu)') { return 'VERIFIED_FROM_LMS_PS' }
    return 'UNOBSERVABLE'
}

function Write-ArtifactAndManifest([object]$Job,[string]$Model,[string]$ResultText) {
    $inputJson = $Job | ConvertTo-Json -Depth 30 -Compress
    $inputHash = Hash-String $inputJson
    $artifactPath = Join-Path $ArtifactRoot ($Job.job_id + '.json')
    $artifact = [ordered]@{
        schema_version='DREAMLEDGER/LOCAL-BUILD-ARTIFACT/v1'
        job_id=$Job.job_id; signal_id=$Job.signal_id; source_reference=$Job.source_reference
        model_identifier=$Model; input_hash=$inputHash; output=$ResultText
        external_action_performed=$false; revenue_claimed=$false; payment_claimed=$false
        fulfillment_claimed=$false; verification_claimed=$false; status='ARTIFACT_READY'
        created_at=(Get-Date).ToUniversalTime().ToString('o'); provenance=$Job.provenance
    }
    [IO.File]::WriteAllText($artifactPath,($artifact | ConvertTo-Json -Depth 40) + [Environment]::NewLine,(New-Object Text.UTF8Encoding($false)))
    $outputHash = (Get-FileHash -LiteralPath $artifactPath -Algorithm SHA256).Hash.ToLower()

    $manifest = [ordered]@{
        candidate_id=$Job.job_id; substrate_type=$Job.substrate_reference; substrate_requirements=$Job.substrate_reference
        signal_id=$Job.signal_id; demand_family=$Job.demand_family
        transformation=@{name=$Job.transformation_family;worker_role=$Job.worker_role;model_identifier=$Model}
        buyer_output=@{format='structured_artifact';artifact_reference=$artifactPath;output_hash=$outputHash;contains=@('source-grounded internal artifact')}
        commercial_boundary=@{price_nzd=0;external_action_required=$true;approval_required=$true;revenue_claim_allowed=$false}
        commerce_path=@{checkout='existing commerce rail';fulfillment='existing bounded fulfillment adapter';proof='EXISTING_PROOF_SPINE'}
        kill_criteria=@('source becomes stale','artifact validation fails','contradictory evidence')
        provenance=@{signal_id=$Job.signal_id;build_job_id=$Job.job_id;source_reference=$Job.source_reference;input_hash=$inputHash;artifact_hash=$outputHash}
    }
    $manifestPath = Join-Path $ManifestRoot ($Job.job_id + '.json')
    [IO.File]::WriteAllText($manifestPath,($manifest | ConvertTo-Json -Depth 40) + [Environment]::NewLine,(New-Object Text.UTF8Encoding($false)))
    [ordered]@{artifact_path=$artifactPath;manifest_path=$manifestPath;input_hash=$inputHash;output_hash=$outputHash}
}

function Write-Proof([object]$Job,[object]$Runtime,[object]$ModelState,[string]$GpuStatus,[object]$Artifact) {
    $proofPath = Join-Path $ProofRoot ($Job.job_id + '.json')
    $proof = [ordered]@{
        schema_version='DREAMLEDGER/LOCAL-BUILD-WORKER-PROOF/v1'; job_id=$Job.job_id; signal_id=$Job.signal_id
        worker_id=$WorkerId; server_endpoint=$Runtime.endpoint; daemon_status=$Runtime.daemon_status
        server_status=$Runtime.server_status; model_id=$ModelState.model_id; model_discovered=$ModelState.model_discovered
        model_loaded=$ModelState.model_loaded; inference_status='READY_INFERENCE'; gpu_status=$GpuStatus
        artifact=$Artifact; external_action_performed=$false; revenue_claimed=$false; approval_required=$true
        completed_at=(Get-Date).ToUniversalTime().ToString('o')
    }
    $proof | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath $proofPath -Encoding ASCII
    return $proofPath
}

function Invoke-Bridge([string]$Method,[string]$Path,[object]$Body,[string]$CorrelationId) {
    $headers=@{'x-dreamledger-agent-token'=$BridgeToken;'x-correlation-id'=$CorrelationId}
    $p=@{Uri=$BridgeUrl+$Path;Method=$Method;Headers=$headers;ErrorAction='Stop';TimeoutSec=120}
    if($null -ne $Body){$p.ContentType='application/json';$p.Body=($Body|ConvertTo-Json -Depth 40 -Compress)}
    Invoke-RestMethod @p
}

function Run-Once {
    $correlation=[guid]::NewGuid().ToString()
    $claim=Invoke-Bridge 'POST' '/api/agent-bridge/jobs/claim' @{worker_id=$WorkerId;lease_seconds=900} $correlation
    if(-not $claim.claimed){return @{status='IDLE';worker_id=$WorkerId;correlation_id=$correlation}}

    $job=$claim.job
    $lease=[string]$claim.lease_token
    if([string]::IsNullOrWhiteSpace($lease)){Fail 'BRIDGE_LEASE_TOKEN_MISSING'}

    try {
        $build=$job.payload.build_job
        if($null -ne $build){
            $lms=Get-LmsExecutable
            $runtime=Ensure-LmsRuntime $lms
            $modelState=Ensure-Model $lms
            $resultText=Invoke-ReadyInference $modelState.model_id $build
            $gpu=Get-GpuStatus $lms
            $artifact=Write-ArtifactAndManifest $build $modelState.model_id $resultText
            $proof=Write-Proof $build $runtime $modelState $gpu $artifact
            $result=[ordered]@{
                schema_version='BEC-LMSTUDIO-BUILD-WORKER-1.0'; status='ARTIFACT_READY'; job_id=$job.job_id
                signal_id=$build.signal_id; model_id=$modelState.model_id; server_endpoint=$runtime.endpoint
                inference_status='READY_INFERENCE'; artifact_path=$artifact.artifact_path; manifest_path=$artifact.manifest_path
                input_hash=$artifact.input_hash; output_hash=$artifact.output_hash; gpu_status=$gpu; proof_path=$proof
                external_action_taken=$false; revenue_claim=$false; sale_claim=$false; payment_claim=$false
                fulfillment_claim=$false; verification_claim=$false
            }
        } else {
            $lms=Get-LmsExecutable
            $runtime=Ensure-LmsRuntime $lms
            $modelState=Ensure-Model $lms
            $resultText=Invoke-ReadyInference $modelState.model_id $job
            $result=[ordered]@{
                schema_version='BEC-LMSTUDIO-WORKER-1.0'; worker_id=$WorkerId; model=$modelState.model_id
                job_id=$job.job_id; job_type=$job.job_type; correlation_id=$correlation; status='ARTIFACT_READY'
                external_action_taken=$false; irreversible_effects_triggered=$false; revenue_claim=$false
                sale_claim=$false; payment_claim=$false; fulfillment_claim=$false; result=$resultText
            }
        }
        $completePath='/api/agent-bridge/jobs/'+[uri]::EscapeDataString([string]$job.job_id)+'/complete'
        $done=Invoke-Bridge 'POST' $completePath @{worker_id=$WorkerId;lease_token=$lease;result=$result} $correlation
        return @{status='COMPLETED';job_id=$job.job_id;signal_id=$result.signal_id;model_id=$result.model_id;server_endpoint=$result.server_endpoint;inference_status=$result.inference_status;artifact_path=$result.artifact_path;manifest_path=$result.manifest_path;input_hash=$result.input_hash;output_hash=$result.output_hash;gpu_status=$result.gpu_status;proof_path=$result.proof_path;bridge=$done;correlation_id=$correlation}
    } catch {
        $message=$_.Exception.Message
        $failPath='/api/agent-bridge/jobs/'+[uri]::EscapeDataString([string]$job.job_id)+'/fail'
        try {[void](Invoke-Bridge 'POST' $failPath @{worker_id=$WorkerId;lease_token=$lease;error=$message;retryable=$true} $correlation)} catch {}
        $signalId=''
        if($null -ne $job.payload.build_job){$signalId=[string]$job.payload.build_job.signal_id}
        return @{status='FAILED';job_id=$job.job_id;signal_id=$signalId;error=$message;gpu_status='UNOBSERVABLE';failure_reason=$message;correlation_id=$correlation}
    }
}

do {
    try { Run-Once | ConvertTo-Json -Depth 40 -Compress }
    catch { @{status='WORKER_ERROR';error=$_.Exception.Message;worker_id=$WorkerId;gpu_status='UNOBSERVABLE'} | ConvertTo-Json -Compress }
    if($Once){break}
    Start-Sleep -Seconds ([Math]::Max(5,$PollSeconds))
} while($true)
) { $u += '/v1' }; $u } else { 'http://127.0.0.1:' + $port + '/v1' }
    [ordered]@{ daemon_status=[string]$daemon.status; server_status='running'; endpoint=$script:ResolvedBaseUrl; port=$port }
}

function Get-ApiModels {
    $r = Invoke-RestMethod -Uri ($script:ResolvedBaseUrl + '/models') -Method Get -TimeoutSec 15
    $models = @($r.data | Where-Object { $_.id } | ForEach-Object { [string]$_.id })
    if ($models.Count -eq 0) { Fail 'MODEL_DISCOVERED:NO_MODELS_RETURNED' }
    return $models
}

function Get-LoadedModels([string]$Lms) {
    $r = Invoke-LmsJson $Lms @('ps','--json')
    $items = @()
    if ($r -is [array]) { $items = @($r) }
    elseif ($null -ne $r.models) { $items = @($r.models) }
    elseif ($null -ne $r.data) { $items = @($r.data) }
    $ids = @()
    foreach ($item in $items) {
        $id = [string]$item.identifier
        if ([string]::IsNullOrWhiteSpace($id)) { $id = [string]$item.id }
        if (-not [string]::IsNullOrWhiteSpace($id)) { $ids += $id }
    }
    return $ids
}

function Ensure-Model([string]$Lms) {
    $available = Get-ApiModels
    $loaded = Get-LoadedModels $Lms
    $model = if ($env:LM_STUDIO_MODEL) { [string]$env:LM_STUDIO_MODEL } else { [string]$available[0] }
    if ($available -notcontains $model) { Fail ('MODEL_DISCOVERED_BUT_NOT_EXPOSED:' + $model) }

    if ($loaded -notcontains $model) {
        $help = Invoke-Lms $Lms @('load','--help')
        $args = @('load',$model)
        if ($help.Text -match '--gpu') { $args += '--gpu=max' }
        [void](Invoke-Lms $Lms $args)
    }

    $loadedAfter = Get-LoadedModels $Lms
    if ($loadedAfter -notcontains $model) { Fail ('MODEL_LOADED_FALSE:' + $model) }
    [ordered]@{ model_id=$model; model_discovered=$true; model_loaded=$true; loaded_models=$loadedAfter }
}

function Invoke-ReadyInference([string]$Model,[object]$Job) {
    $body = @{
        model = $Model
        messages = @(
            @{ role='system'; content='You are a bounded DreamLedger local build worker. Never invent buyers, payments, revenue, fulfillment, verification, evidence, or external actions. Produce only a useful internal artifact.' },
            @{ role='user'; content=(@{ job=$Job; instruction='Transform this demand signal into a structured internal build artifact. Preserve uncertainty and provenance. Do not claim an economic outcome.' } | ConvertTo-Json -Depth 30 -Compress) }
        )
        temperature = 0.1
        max_tokens = $MaxOutputTokens
        stream = $false
    }
    $r = Invoke-RestMethod -Uri ($script:ResolvedBaseUrl + '/chat/completions') -Method Post -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 30) -TimeoutSec 600
    $text = [string]$r.choices[0].message.content
    if ([string]::IsNullOrWhiteSpace($text)) { Fail 'READY_INFERENCE_FAILED:EMPTY_OUTPUT' }
    return $text
}

function Get-GpuStatus([string]$Lms) {
    $r = Invoke-LmsJson $Lms @('ps','--json')
    $json = $r | ConvertTo-Json -Depth 30 -Compress
    if ($json -match '(?i)gpu' -and $json -match '(?i)(offload|gpu_memory|gpu.*[0-9]+|[0-9]+.*gpu)') { return 'VERIFIED_FROM_LMS_PS' }
    return 'UNOBSERVABLE'
}

function Write-ArtifactAndManifest([object]$Job,[string]$Model,[string]$ResultText) {
    $inputJson = $Job | ConvertTo-Json -Depth 30 -Compress
    $inputHash = Hash-String $inputJson
    $artifactPath = Join-Path $ArtifactRoot ($Job.job_id + '.json')
    $artifact = [ordered]@{
        schema_version='DREAMLEDGER/LOCAL-BUILD-ARTIFACT/v1'
        job_id=$Job.job_id; signal_id=$Job.signal_id; source_reference=$Job.source_reference
        model_identifier=$Model; input_hash=$inputHash; output=$ResultText
        external_action_performed=$false; revenue_claimed=$false; payment_claimed=$false
        fulfillment_claimed=$false; verification_claimed=$false; status='ARTIFACT_READY'
        created_at=(Get-Date).ToUniversalTime().ToString('o'); provenance=$Job.provenance
    }
    [IO.File]::WriteAllText($artifactPath,($artifact | ConvertTo-Json -Depth 40) + [Environment]::NewLine,(New-Object Text.UTF8Encoding($false)))
    $outputHash = (Get-FileHash -LiteralPath $artifactPath -Algorithm SHA256).Hash.ToLower()

    $manifest = [ordered]@{
        candidate_id=$Job.job_id; substrate_type=$Job.substrate_reference; substrate_requirements=$Job.substrate_reference
        signal_id=$Job.signal_id; demand_family=$Job.demand_family
        transformation=@{name=$Job.transformation_family;worker_role=$Job.worker_role;model_identifier=$Model}
        buyer_output=@{format='structured_artifact';artifact_reference=$artifactPath;output_hash=$outputHash;contains=@('source-grounded internal artifact')}
        commercial_boundary=@{price_nzd=0;external_action_required=$true;approval_required=$true;revenue_claim_allowed=$false}
        commerce_path=@{checkout='existing commerce rail';fulfillment='existing bounded fulfillment adapter';proof='EXISTING_PROOF_SPINE'}
        kill_criteria=@('source becomes stale','artifact validation fails','contradictory evidence')
        provenance=@{signal_id=$Job.signal_id;build_job_id=$Job.job_id;source_reference=$Job.source_reference;input_hash=$inputHash;artifact_hash=$outputHash}
    }
    $manifestPath = Join-Path $ManifestRoot ($Job.job_id + '.json')
    [IO.File]::WriteAllText($manifestPath,($manifest | ConvertTo-Json -Depth 40) + [Environment]::NewLine,(New-Object Text.UTF8Encoding($false)))
    [ordered]@{artifact_path=$artifactPath;manifest_path=$manifestPath;input_hash=$inputHash;output_hash=$outputHash}
}

function Write-Proof([object]$Job,[object]$Runtime,[object]$ModelState,[string]$GpuStatus,[object]$Artifact) {
    $proofPath = Join-Path $ProofRoot ($Job.job_id + '.json')
    $proof = [ordered]@{
        schema_version='DREAMLEDGER/LOCAL-BUILD-WORKER-PROOF/v1'; job_id=$Job.job_id; signal_id=$Job.signal_id
        worker_id=$WorkerId; server_endpoint=$Runtime.endpoint; daemon_status=$Runtime.daemon_status
        server_status=$Runtime.server_status; model_id=$ModelState.model_id; model_discovered=$ModelState.model_discovered
        model_loaded=$ModelState.model_loaded; inference_status='READY_INFERENCE'; gpu_status=$GpuStatus
        artifact=$Artifact; external_action_performed=$false; revenue_claimed=$false; approval_required=$true
        completed_at=(Get-Date).ToUniversalTime().ToString('o')
    }
    $proof | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath $proofPath -Encoding ASCII
    return $proofPath
}

function Invoke-Bridge([string]$Method,[string]$Path,[object]$Body,[string]$CorrelationId) {
    $headers=@{'x-dreamledger-agent-token'=$BridgeToken;'x-correlation-id'=$CorrelationId}
    $p=@{Uri=$BridgeUrl+$Path;Method=$Method;Headers=$headers;ErrorAction='Stop';TimeoutSec=120}
    if($null -ne $Body){$p.ContentType='application/json';$p.Body=($Body|ConvertTo-Json -Depth 40 -Compress)}
    Invoke-RestMethod @p
}

function Run-Once {
    $correlation=[guid]::NewGuid().ToString()
    $claim=Invoke-Bridge 'POST' '/api/agent-bridge/jobs/claim' @{worker_id=$WorkerId;lease_seconds=900} $correlation
    if(-not $claim.claimed){return @{status='IDLE';worker_id=$WorkerId;correlation_id=$correlation}}

    $job=$claim.job
    $lease=[string]$claim.lease_token
    if([string]::IsNullOrWhiteSpace($lease)){Fail 'BRIDGE_LEASE_TOKEN_MISSING'}

    try {
        $build=$job.payload.build_job
        if($null -ne $build){
            $lms=Get-LmsExecutable
            $runtime=Ensure-LmsRuntime $lms
            $modelState=Ensure-Model $lms
            $resultText=Invoke-ReadyInference $modelState.model_id $build
            $gpu=Get-GpuStatus $lms
            $artifact=Write-ArtifactAndManifest $build $modelState.model_id $resultText
            $proof=Write-Proof $build $runtime $modelState $gpu $artifact
            $result=[ordered]@{
                schema_version='BEC-LMSTUDIO-BUILD-WORKER-1.0'; status='ARTIFACT_READY'; job_id=$job.job_id
                signal_id=$build.signal_id; model_id=$modelState.model_id; server_endpoint=$runtime.endpoint
                inference_status='READY_INFERENCE'; artifact_path=$artifact.artifact_path; manifest_path=$artifact.manifest_path
                input_hash=$artifact.input_hash; output_hash=$artifact.output_hash; gpu_status=$gpu; proof_path=$proof
                external_action_taken=$false; revenue_claim=$false; sale_claim=$false; payment_claim=$false
                fulfillment_claim=$false; verification_claim=$false
            }
        } else {
            $lms=Get-LmsExecutable
            $runtime=Ensure-LmsRuntime $lms
            $modelState=Ensure-Model $lms
            $resultText=Invoke-ReadyInference $modelState.model_id $job
            $result=[ordered]@{
                schema_version='BEC-LMSTUDIO-WORKER-1.0'; worker_id=$WorkerId; model=$modelState.model_id
                job_id=$job.job_id; job_type=$job.job_type; correlation_id=$correlation; status='ARTIFACT_READY'
                external_action_taken=$false; irreversible_effects_triggered=$false; revenue_claim=$false
                sale_claim=$false; payment_claim=$false; fulfillment_claim=$false; result=$resultText
            }
        }
        $completePath='/api/agent-bridge/jobs/'+[uri]::EscapeDataString([string]$job.job_id)+'/complete'
        $done=Invoke-Bridge 'POST' $completePath @{worker_id=$WorkerId;lease_token=$lease;result=$result} $correlation
        return @{status='COMPLETED';job_id=$job.job_id;signal_id=$result.signal_id;model_id=$result.model_id;server_endpoint=$result.server_endpoint;inference_status=$result.inference_status;artifact_path=$result.artifact_path;manifest_path=$result.manifest_path;input_hash=$result.input_hash;output_hash=$result.output_hash;gpu_status=$result.gpu_status;proof_path=$result.proof_path;bridge=$done;correlation_id=$correlation}
    } catch {
        $message=$_.Exception.Message
        $failPath='/api/agent-bridge/jobs/'+[uri]::EscapeDataString([string]$job.job_id)+'/fail'
        try {[void](Invoke-Bridge 'POST' $failPath @{worker_id=$WorkerId;lease_token=$lease;error=$message;retryable=$true} $correlation)} catch {}
        $signalId=''
        if($null -ne $job.payload.build_job){$signalId=[string]$job.payload.build_job.signal_id}
        return @{status='FAILED';job_id=$job.job_id;signal_id=$signalId;error=$message;gpu_status='UNOBSERVABLE';failure_reason=$message;correlation_id=$correlation}
    }
}

do {
    try { Run-Once | ConvertTo-Json -Depth 40 -Compress }
    catch { @{status='WORKER_ERROR';error=$_.Exception.Message;worker_id=$WorkerId;gpu_status='UNOBSERVABLE'} | ConvertTo-Json -Compress }
    if($Once){break}
    Start-Sleep -Seconds ([Math]::Max(5,$PollSeconds))
} while($true)
