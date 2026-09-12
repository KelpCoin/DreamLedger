Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Require-Env([string]$Name) {
    $value = [Environment]::GetEnvironmentVariable($Name)
    if ([string]::IsNullOrWhiteSpace($value)) { throw "Missing required environment variable: $Name" }
    return $value
}

$SupabaseUrl = (Require-Env 'SUPABASE_URL').TrimEnd('/')
$SupabaseKey = if ($env:SUPABASE_SECRET_KEY) { $env:SUPABASE_SECRET_KEY } elseif ($env:SUPABASE_SERVICE_ROLE_KEY) { $env:SUPABASE_SERVICE_ROLE_KEY } else { Require-Env 'SUPABASE_SERVICE_ROLE_KEY' }
$Headers = @{ apikey = $SupabaseKey; Authorization = "Bearer $SupabaseKey"; 'Content-Type' = 'application/json' }
$RunId = if ($env:GITHUB_RUN_ID) { $env:GITHUB_RUN_ID } else { [guid]::NewGuid().ToString() }
$RepoSha = if ($env:GITHUB_SHA) { $env:GITHUB_SHA } else { 'local' }

function Get-Rows([string]$Table, [string]$Query = '') {
    $uri = "$SupabaseUrl/rest/v1/$Table?select=*"
    if ($Query) { $uri += "&$Query" }
    return @(Invoke-RestMethod -Uri $uri -Headers $Headers -Method Get -TimeoutSec 30)
}

function Patch-Row([string]$Table, [string]$Query, [hashtable]$Body) {
    $uri = "$SupabaseUrl/rest/v1/$Table?$Query"
    $h = @{} + $Headers
    $h['Prefer'] = 'return=representation'
    $json = $Body | ConvertTo-Json -Depth 20 -Compress
    return @(Invoke-RestMethod -Uri $uri -Headers $h -Method Patch -Body $json -TimeoutSec 30)
}

function Insert-Rows([string]$Table, [object]$Rows) {
    $h = @{} + $Headers
    $h['Prefer'] = 'return=minimal'
    $json = @($Rows) | ConvertTo-Json -Depth 20 -Compress
    Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/$Table" -Headers $h -Method Post -Body $json -TimeoutSec 30 | Out-Null
}

function Sha256([string]$Text) {
    $bytes = [Text.Encoding]::UTF8.GetBytes($Text)
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant() }
    finally { $sha.Dispose() }
}

function Write-Proof([string]$Name, [object]$Body) {
    $root = if ($env:CLOUD_PROOF_ROOT) { $env:CLOUD_PROOF_ROOT } else { Join-Path $PWD 'cloud-proof' }
    $dir = Join-Path $root $RunId
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $path = Join-Path $dir $Name
    $json = $Body | ConvertTo-Json -Depth 30
    [IO.File]::WriteAllText($path, $json, [Text.Encoding]::ASCII)
    return $path
}

function Complete-Job($job, [string]$Status, [object]$Output, [string]$ErrorText) {
    $payload = if ($job.payload) { $job.payload } else { @{} }
    if ($payload -is [string]) { $payload = $payload | ConvertFrom-Json }
    $payload.cloud_execution = [ordered]@{
        task_id = [string]$job.id
        status = $Status
        output = $Output
        error = $ErrorText
        executed_by = "github-actions:$RunId"
        executed_at = (Get-Date).ToUniversalTime().ToString('o')
        commit_sha = $RepoSha
    }
    Patch-Row 'jobs' ("id=eq.$($job.id)&status=eq.running&worker_id=eq.github-actions:$RunId") @{
        status = if ($Status -eq 'completed') { 'completed' } else { 'failed' }
        payload = $payload
        completed_at = (Get-Date).ToUniversalTime().ToString('o')
        last_error = $ErrorText
    } | Out-Null
}

function Invoke-CloudTask($job) {
    $payload = $job.payload
    $role = [string]$payload.role
    $objective = [string]$payload.objective
    $tier = [string]$payload.tier
    if ($tier -ne 'cloud') { throw 'Job is not cloud-routed.' }

    if ($payload.deterministic_handler) {
        switch ([string]$payload.deterministic_handler) {
            'health_probe' {
                $r = Invoke-RestMethod -Uri 'https://dreamledger.org/healthz' -Method Get -TimeoutSec 20
                return @{ handler='health_probe'; result=$r }
            }
            default { throw "Unknown deterministic handler: $($payload.deterministic_handler)" }
        }
    }

    $api = $env:CLOUD_MODEL_API_URL
    $key = $env:CLOUD_MODEL_API_KEY
    $model = $env:CLOUD_MODEL_NAME
    if ([string]::IsNullOrWhiteSpace($api) -or [string]::IsNullOrWhiteSpace($key) -or [string]::IsNullOrWhiteSpace($model)) {
        throw "Cloud reasoning fallback unavailable for role '$role': CLOUD_MODEL_API_URL, CLOUD_MODEL_API_KEY, and CLOUD_MODEL_NAME are required."
    }

    $body = @{
        model = $model
        messages = @(
            @{ role='system'; content='Return only JSON matching the requested task output schema. Do not claim external actions or payments that are not evidenced.' },
            @{ role='user'; content=(ConvertTo-Json -Depth 30 -Compress -InputObject @{ role=$role; objective=$objective; input=$payload.input; required_output_schema=$payload.required_output_schema }) }
        )
        temperature = 0
    } | ConvertTo-Json -Depth 30 -Compress
    $h = @{ Authorization="Bearer $key"; 'Content-Type'='application/json' }
    $response = Invoke-RestMethod -Uri $api -Headers $h -Method Post -Body $body -TimeoutSec 120
    return @{ handler='cloud_model'; response=$response }
}

function Invoke-OrchestratorTick {
    $jobs = Get-Rows 'jobs' 'status=eq.pending&limit=20&order=created_at.asc'
    $cloud = @($jobs | Where-Object {
        try { $_.payload.tier -eq 'cloud' } catch { $false }
    } | Select-Object -First 3)
    $results = @()
    foreach ($job in $cloud) {
        $claimed = @(Patch-Row 'jobs' ("id=eq.$($job.id)&status=eq.pending") @{
            status='running'; worker_id="github-actions:$RunId"; leased_until=(Get-Date).ToUniversalTime().AddMinutes(10).ToString('o'); started_at=(Get-Date).ToUniversalTime().ToString('o'); lease_token=[guid]::NewGuid().ToString(); attempt_count=([int]$job.attempt_count + 1)
        })
        if ($claimed.Count -ne 1) { continue }
        try {
            $output = Invoke-CloudTask $job
            Complete-Job $job 'completed' $output $null
            $results += @{ task_id=$job.id; status='completed' }
        } catch {
            $err = $_.Exception.Message
            Complete-Job $job 'failed' @{} $err
            $results += @{ task_id=$job.id; status='failed'; error=$err }
        }
    }
    $proof = @{ run_id=$RunId; commit_sha=$RepoSha; processed=$results; generated_at=(Get-Date).ToUniversalTime().ToString('o') }
    Write-Proof 'orchestrator-tick.json' $proof | Out-Null
}

function Invoke-ScheduledProbe {
    $started = Get-Date
    $state = [ordered]@{ run_id=$RunId; status='UNKNOWN'; endpoints=@{}; checked_at=(Get-Date).ToUniversalTime().ToString('o') }
    foreach ($path in @('/healthz','/api/offers','/billboard')) {
        try {
            $r = Invoke-WebRequest -Uri ("https://dreamledger.org" + $path) -UseBasicParsing -TimeoutSec 30
            $body = $r.Content
            $state.endpoints[$path] = @{ status_code=$r.StatusCode; sha256=(Sha256 $body); bytes=$body.Length; ok=($r.StatusCode -eq 200) }
        } catch {
            $state.endpoints[$path] = @{ ok=$false; error=$_.Exception.Message }
        }
    }
    $allOk = @($state.endpoints.Values | Where-Object { -not $_.ok }).Count -eq 0
    $state.status = if ($allOk) { 'OK' } else { 'UNKNOWN' }
    $state.duration_ms = [int]((Get-Date) - $started).TotalMilliseconds
    Write-Proof 'scheduled-probe.json' $state | Out-Null
    $health = @{
        component='cloud.scheduled_probe'
        status=$state.status
        last_success=if ($allOk) { $state.checked_at } else { $null }
        last_failure=if (-not $allOk) { $state.checked_at } else { $null }
        duration_ms=$state.duration_ms
        version=$RepoSha
        details=$state
        updated_at=$state.checked_at
    }
    Patch-Row 'system_health' 'component=eq.cloud.scheduled_probe' $health | Out-Null
    if (-not $allOk) {
        $claim = @{ claim_key="probe:$RunId"; subject='dreamledger.org production surfaces'; claim='Scheduled production probe did not fully verify all required surfaces.'; claim_type='IMPLEMENTATION'; verdict='UNVERIFIED'; confidence=0; evidence_required=$true; oracle_notes=(ConvertTo-Json $state -Depth 20 -Compress); last_verified_at=$state.checked_at; updated_at=$state.checked_at }
        Insert-Rows 'truth_oracle_claims' @($claim)
    }
}

function Invoke-LedgerVerifier {
    $rows = Get-Rows 'dreamledger_evidence' 'select=sequence,event_id,previous_hash,event_hash&order=sequence.asc&limit=1000'
    $ok = $true; $previous = $null; $checked = 0
    foreach ($row in $rows) {
        if ($checked -gt 0 -and $row.previous_hash -ne $previous) { $ok=$false; break }
        $previous = $row.event_hash; $checked++
    }
    $proof = @{ run_id=$RunId; checked=$checked; chain_continuity=$ok; last_hash=$previous; checked_at=(Get-Date).ToUniversalTime().ToString('o') }
    Write-Proof 'ledger-verification.json' $proof | Out-Null
}

function Invoke-DailyReport {
    $events = Get-Rows 'economic_events' 'select=*&order=created_at.desc&limit=1000'
    $report = [ordered]@{ run_id=$RunId; generated_at=(Get-Date).ToUniversalTime().ToString('o'); event_count=$events.Count; payment_settled_count=@($events | Where-Object { $_.payment_settled -eq $true }).Count; verified_count=@($events | Where-Object { $_.payment_settled -eq $true -and $_.buyer_action_verified -eq $true -and $_.evidence_verified -eq $true }).Count; revenue_nzd=([decimal](@($events | Where-Object { $_.payment_settled -eq $true } | Measure-Object amount_nzd -Sum).Sum)); events=$events }
    Write-Proof 'daily-state-report.json' $report | Out-Null
}

switch ($env:CLOUD_ORCHESTRATOR_MODE) {
    'orchestrator' { Invoke-OrchestratorTick }
    'probe' { Invoke-ScheduledProbe }
    'ledger' { Invoke-LedgerVerifier }
    'daily' { Invoke-DailyReport }
    default { throw 'Set CLOUD_ORCHESTRATOR_MODE to orchestrator, probe, ledger, or daily.' }
}
