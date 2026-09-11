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

function New-CorrelationId { return [guid]::NewGuid().ToString() }

function Invoke-Bridge {
    param([string]$Method = 'GET', [string]$Path, [object]$Body = $null, [string]$CorrelationId)
    $headers = @{ 'x-dreamledger-agent-token' = $BridgeToken }
    if (-not [string]::IsNullOrWhiteSpace($CorrelationId)) { $headers['x-correlation-id'] = $CorrelationId }
    $params = @{ Uri = ($BridgeUrl + $Path); Method = $Method; Headers = $headers; ErrorAction = 'Stop' }
    if ($null -ne $Body) { $params.ContentType = 'application/json'; $params.Body = ($Body | ConvertTo-Json -Depth 20 -Compress) }
    return Invoke-RestMethod @params
}

function Write-Proof {
    param([object]$Job, [object]$Result, [string]$CorrelationId, [string]$LeaseToken)
    $root = Join-Path $env:ProgramData 'BrownEyeCortex\proof\economic-cells'
    $dir = Join-Path $root ([string]$Job.job_type)
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    $proof = [ordered]@{
        schema_version = 'BEC-ECONOMIC-PROOF-1.1'
        job_id = $Job.job_id
        job_type = $Job.job_type
        worker_id = $WorkerId
        correlation_id = $CorrelationId
        lease_token = $LeaseToken
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
    param([object]$Job, [string]$CorrelationId, [string]$LeaseToken)
    $payload = $Job.payload
    if ($null -eq $payload) { throw 'Job payload missing' }
    $allowedTypes = @('BILLBOARD_FULFILLMENT','FULFILLMENT','VERIFY','PROOF')
    if ($allowedTypes -notcontains [string]$Job.job_type) { throw ('Job type not permitted by local worker: ' + [string]$Job.job_type) }
    $result = [ordered]@{
        worker = $WorkerId
        job_id = $Job.job_id
        job_type = $Job.job_type
        correlation_id = $CorrelationId
        lease_token = $LeaseToken
        accepted = $true
        handler = 'CortexEconomicWorker-v0.2'
        payload_hash_input = ($payload | ConvertTo-Json -Depth 20 -Compress)
        note = 'Cell-specific handler boundary reached; no arbitrary remote command execution.'
    }
    $proofPath = Write-Proof -Job $Job -Result $result -CorrelationId $CorrelationId -LeaseToken $LeaseToken
    $result.proof_path = $proofPath
    return $result
}

function Run-Once {
    $correlationId = New-CorrelationId
    $claim = Invoke-Bridge -Method POST -Path '/api/agent-bridge/jobs/claim' -Body @{ worker_id = $WorkerId; lease_seconds = 900 } -CorrelationId $correlationId
    if (-not $claim.claimed) { return @{ status = 'IDLE'; reason = $claim.reason; correlation_id = $correlationId } }
    $leaseToken = [string]$claim.lease_token
    if ([string]::IsNullOrWhiteSpace($leaseToken)) { throw 'Bridge claim did not return lease_token' }
    try {
        $result = Execute-CellJob -Job $claim.job -CorrelationId $correlationId -LeaseToken $leaseToken
        $completePath = '/api/agent-bridge/jobs/' + [uri]::EscapeDataString([string]$claim.job.job_id) + '/complete'
        $done = Invoke-Bridge -Method POST -Path $completePath -Body @{ worker_id = $WorkerId; lease_token = $leaseToken; result = $result } -CorrelationId $correlationId
        return @{ status = $(if ($done.completed) { 'COMPLETED' } else { 'COMPLETE_NOT_CONFIRMED' }); job_id = $claim.job.job_id; proof = $result.proof_path; correlation_id = $correlationId }
    } catch {
        $failPath = '/api/agent-bridge/jobs/' + [uri]::EscapeDataString([string]$claim.job.job_id) + '/fail'
        $failed = Invoke-Bridge -Method POST -Path $failPath -Body @{ worker_id = $WorkerId; lease_token = $leaseToken; error = $_.Exception.Message; retryable = $true } -CorrelationId $correlationId
        return @{ status = 'FAILED'; job_id = $claim.job.job_id; bridge_updated = $failed.failed; error = $_.Exception.Message; correlation_id = $correlationId }
    }
}

Assert-Config
while ($true) {
    try { $result = Run-Once; $result | ConvertTo-Json -Depth 10 -Compress }
    catch { @{ status = 'WORKER_ERROR'; error = $_.Exception.Message } | ConvertTo-Json -Compress }
    if ($Once) { break }
    Start-Sleep -Seconds ([Math]::Max(5, $PollSeconds))
}
