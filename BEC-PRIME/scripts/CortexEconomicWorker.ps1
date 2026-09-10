#requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

param(
    [string]$BridgeUrl = $env:DREAMLEDGER_AGENT_BRIDGE_URL,
    [string]$BridgeToken = $env:DREAMLEDGER_AGENT_BRIDGE_TOKEN,
    [string]$WorkerId = $env:DREAMLEDGER_CORTEX_WORKER_ID,
    [int]$PollSeconds = 15,
    [switch]$Once
)

function Assert-Config {
    if ([string]::IsNullOrWhiteSpace($BridgeUrl)) { throw 'DREAMLEDGER_AGENT_BRIDGE_URL is required' }
    if ([string]::IsNullOrWhiteSpace($BridgeToken)) { throw 'DREAMLEDGER_AGENT_BRIDGE_TOKEN is required' }
    if ([string]::IsNullOrWhiteSpace($WorkerId)) { $script:WorkerId = 'cortex-local-' + $env:COMPUTERNAME }
    $script:BridgeUrl = $BridgeUrl.TrimEnd('/')
}

function Invoke-Bridge {
    param([string]$Method = 'GET', [string]$Path, [object]$Body = $null)
    $headers = @{ 'x-dreamledger-agent-token' = $BridgeToken }
    $params = @{ Uri = ($BridgeUrl + $Path); Method = $Method; Headers = $headers; ErrorAction = 'Stop' }
    if ($null -ne $Body) {
        $params.ContentType = 'application/json'
        $params.Body = ($Body | ConvertTo-Json -Depth 20 -Compress)
    }
    return Invoke-RestMethod @params
}

function Write-Proof {
    param([object]$Job, [object]$Result)
    $root = Join-Path $env:ProgramData 'BrownEyeCortex\proof\economic-cells'
    $dir = Join-Path $root ([string]$Job.job_type)
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    $proof = [ordered]@{
        schema_version = 'BEC-ECONOMIC-PROOF-1.0'
        job_id = $Job.job_id
        job_type = $Job.job_type
        worker_id = $WorkerId
        action = 'LOCAL_WORKER_EXECUTION'
        started_at = $Job.started_at
        completed_at = (Get-Date).ToUniversalTime().ToString('o')
        result = $Result
        evidence = @('bridge_job_claim', 'local_worker_execution')
        verification = 'UNVERIFIED'
        policy_id = 'LOCAL-WORKER-DEFAULT-1'
    }
    $path = Join-Path $dir ($Job.job_id + '.json')
    $proof | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $path -Encoding ASCII
    return $path
}

function Execute-CellJob {
    param([object]$Job)
    $payload = $Job.payload
    if ($null -eq $payload) { throw 'Job payload missing' }

    # Safety boundary: this worker never executes arbitrary command text from a remote job.
    $allowedTypes = @('BILLBOARD_FULFILLMENT','FULFILLMENT','VERIFY','PROOF')
    if ($allowedTypes -notcontains [string]$Job.job_type) {
        throw ('Job type not permitted by local worker: ' + [string]$Job.job_type)
    }

    # This v0.1 worker is deliberately a control/fulfillment adapter. It records the job,
    # writes durable local proof, and returns the exact remote payload for a cell-specific
    # handler to consume. No arbitrary PowerShell is accepted from the network.
    $result = [ordered]@{
        worker = $WorkerId
        job_id = $Job.job_id
        job_type = $Job.job_type
        accepted = $true
        handler = 'CortexEconomicWorker-v0.1'
        payload_hash_input = ($payload | ConvertTo-Json -Depth 20 -Compress)
        note = 'Cell-specific handler boundary reached; no arbitrary remote command execution.'
    }
    $proofPath = Write-Proof -Job $Job -Result $result
    $result.proof_path = $proofPath
    return $result
}

function Run-Once {
    $next = Invoke-Bridge -Method GET -Path '/api/agent-bridge/jobs/next'
    if ($null -eq $next.job) { return @{ status = 'IDLE' } }
    $claim = Invoke-Bridge -Method POST -Path ('/api/agent-bridge/jobs/' + [uri]::EscapeDataString([string]$next.job.job_id) + '/claim') -Body @{ worker_id = $WorkerId }
    if (-not $claim.claimed) { return @{ status = 'CLAIM_RACE'; reason = $claim.reason } }
    try {
        $result = Execute-CellJob -Job $claim.job
        $done = Invoke-Bridge -Method POST -Path ('/api/agent-bridge/jobs/' + [uri]::EscapeDataString([string]$claim.job.job_id) + '/complete') -Body @{ worker_id = $WorkerId; result = $result }
        return @{ status = $(if ($done.completed) { 'COMPLETED' } else { 'COMPLETE_NOT_CONFIRMED' }); job_id = $claim.job.job_id; proof = $result.proof_path }
    } catch {
        $failed = Invoke-Bridge -Method POST -Path ('/api/agent-bridge/jobs/' + [uri]::EscapeDataString([string]$claim.job.job_id) + '/fail') -Body @{ worker_id = $WorkerId; error = $_.Exception.Message; retryable = $true }
        return @{ status = 'FAILED'; job_id = $claim.job.job_id; bridge_updated = $failed.failed; error = $_.Exception.Message }
    }
}

Assert-Config
while ($true) {
    try {
        $result = Run-Once
        $result | ConvertTo-Json -Depth 10 -Compress
    } catch {
        @{ status = 'WORKER_ERROR'; error = $_.Exception.Message } | ConvertTo-Json -Compress
    }
    if ($Once) { break }
    Start-Sleep -Seconds ([Math]::Max(5, $PollSeconds))
}
