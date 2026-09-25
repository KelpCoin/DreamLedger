#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

param(
    [string]$BridgeUrl = $env:DREAMLEDGER_AGENT_BRIDGE_URL,
    [string]$BridgeToken = $env:DREAMLEDGER_AGENT_BRIDGE_TOKEN,
    [string]$WorkerId = $env:DREAMLEDGER_LMSTUDIO_WORKER_ID,
    [string]$LMStudioUrl = $(if ($env:LM_STUDIO_URL) { $env:LM_STUDIO_URL } else { 'http://127.0.0.1:1234' }),
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
