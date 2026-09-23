# BECK LM Studio worker
# Windows 11 / PowerShell 5.1
# Runs on the garage PC, not the phone.
# Pulls BECK jobs from Supabase, checks kill_state, calls LM Studio localhost, writes results back.
$ErrorActionPreference = "Stop"

$SupabaseUrl = $env:BECK_SUPABASE_URL
$SupabaseKey = $env:BECK_SUPABASE_SERVICE_ROLE_KEY
$LmUrl = if ($env:BECK_LM_STUDIO_URL) { $env:BECK_LM_STUDIO_URL } else { "http://127.0.0.1:1234/v1/chat/completions" }
$WorkerId = if ($env:BECK_WORKER_ID) { $env:BECK_WORKER_ID } else { "garage-lmstudio-01" }
$PollSeconds = 15

if ([string]::IsNullOrWhiteSpace($SupabaseUrl) -or [string]::IsNullOrWhiteSpace($SupabaseKey)) {
  throw "Set BECK_SUPABASE_URL and BECK_SUPABASE_SERVICE_ROLE_KEY."
}

$Headers = @{
  apikey = $SupabaseKey
  Authorization = "Bearer $SupabaseKey"
  "Content-Type" = "application/json"
  Prefer = "return=representation"
}

function Get-Cell($cellId) {
  $u = "$SupabaseUrl/rest/v1/cube_cells?id=eq.$cellId&select=id,kill_state,state"
  @(Invoke-RestMethod -Uri $u -Headers $Headers -Method Get)[0]
}

function Claim-Job {
  $u = "$SupabaseUrl/rest/v1/jobs?type=like.beck_%25&status=eq.pending&order=created_at.asc&limit=1"
  $rows = @(Invoke-RestMethod -Uri $u -Headers $Headers -Method Get)
  if ($rows.Count -eq 0) { return $null }
  $job = $rows[0]
  $cellId = $job.payload.cell_id
  if ($cellId) {
    $cell = Get-Cell $cellId
    if ($cell.kill_state -ne "ACTIVE") { return $null }
  }
  $lease = [guid]::NewGuid().ToString()
  $body = @{
    status = "running"
    worker_id = $WorkerId
    lease_token = $lease
    leased_until = (Get-Date).ToUniversalTime().AddMinutes(5).ToString("o")
    started_at = (Get-Date).ToUniversalTime().ToString("o")
    attempt_count = [int]$job.attempt_count + 1
  } | ConvertTo-Json -Depth 10
  $patchHeaders = $Headers.Clone()
  $patchHeaders.Prefer = "return=representation"
  $r = Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/jobs?id=eq.$($job.id)&status=eq.pending" -Headers $patchHeaders -Method Patch -Body $body
  if (@($r).Count -eq 0) { return $null }
  return $job
}

function Invoke-LM($task) {
  $model = if ($env:BECK_LM_MODEL) { $env:BECK_LM_MODEL } else { "local-model" }
  $payload = @{
    model = $model
    temperature = 0.1
    messages = @(
      @{ role = "system"; content = "You are the private BECK verification worker. Use only supplied evidence. Never invent outcomes, money, buyers, or facts. Return concise JSON." },
      @{ role = "user"; content = ($task | ConvertTo-Json -Depth 20) }
    )
  } | ConvertTo-Json -Depth 20
  Invoke-RestMethod -Uri $LmUrl -Method Post -Headers @{ "Content-Type" = "application/json" } -Body $payload
}

function Complete-Job($job,$result) {
  $body = @{ status = "completed"; completed_at = (Get-Date).ToUniversalTime().ToString("o"); result_payload = $result } | ConvertTo-Json -Depth 20
  Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/jobs?id=eq.$($job.id)&worker_id=eq.$WorkerId&lease_token=eq.$($job.lease_token)" -Headers $Headers -Method Patch -Body $body | Out-Null
}

while ($true) {
  try {
    $jobs = @()
    foreach ($cell in @("BECK-LOOP-001","BECK-LOOP-002","BECK-LOOP-003","BECK-LOOP-004")) {
      # Cell IDs are configured by the bootstrap and can be overridden with BECK_CELL_<n>.
    }
    $job = Claim-Job
    if ($null -ne $job) {
      $task = @{
        loop = $job.type
        job_id = $job.id
        payload = $job.payload
        constraint = "Evidence first. No external action. No revenue claim. Kill switch wins."
      }
      $result = Invoke-LM $task
      Complete-Job $job $result
    } else {
      Start-Sleep -Seconds $PollSeconds
    }
  } catch {
    Start-Sleep -Seconds $PollSeconds
  }
}
