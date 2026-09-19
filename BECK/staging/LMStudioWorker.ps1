# BECK persistent objective worker
# Windows 11 / PowerShell 5.1. LM Studio is localhost on the execution PC.
$ErrorActionPreference = "Stop"

$SupabaseUrl = $env:BECK_SUPABASE_URL
$SupabaseKey = $env:BECK_SUPABASE_SERVICE_ROLE_KEY
$LmUrl = if ($env:BECK_LM_STUDIO_URL) { $env:BECK_LM_STUDIO_URL } else { "http://127.0.0.1:1234/v1/chat/completions" }
$WorkerId = if ($env:BECK_WORKER_ID) { $env:BECK_WORKER_ID } else { "beck-lmstudio-01" }
$PollSeconds = 5
$LeaseSeconds = 300
$MaxLmSeconds = 120

if ([string]::IsNullOrWhiteSpace($SupabaseUrl) -or [string]::IsNullOrWhiteSpace($SupabaseKey)) {
  throw "BECK_SUPABASE_URL and BECK_SUPABASE_SERVICE_ROLE_KEY are required."
}

$Headers = @{
  apikey = $SupabaseKey
  Authorization = "Bearer $SupabaseKey"
  "Content-Type" = "application/json"
  Prefer = "return=representation"
}

function Invoke-Rpc([string]$Name, [hashtable]$Args) {
  $body = if ($Args.Count -eq 0) { "{}" } else { $Args | ConvertTo-Json -Depth 30 }
  Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/rpc/$Name" -Headers $Headers -Method Post -Body $body
}

function Invoke-Rest([string]$Uri, [string]$Method = "Get", [object]$Body = $null) {
  if ($null -eq $Body) { return Invoke-RestMethod -Uri $Uri -Headers $Headers -Method $Method }
  return Invoke-RestMethod -Uri $Uri -Headers $Headers -Method $Method -Body ($Body | ConvertTo-Json -Depth 30)
}

function Write-Heartbeat([string]$ObjectiveId, [string]$State) {
  try { Invoke-Rpc "beck_heartbeat" @{ p_worker_id=$WorkerId; p_objective_id=$ObjectiveId; p_state=$State } | Out-Null } catch {}
}

function Get-RecentEvidence([string]$SiloId) {
  $since=[uri]::EscapeDataString((Get-Date).ToUniversalTime().AddHours(-24).ToString("o"))
  $u="$SupabaseUrl/rest/v1/cube_evidence_vault?silo_id=eq.$SiloId&created_at=gte.$since&select=evidence_id,source,verification_status,created_at&order=created_at.desc&limit=20"
  @(Invoke-Rest $u)
}

function Invoke-LM([object]$Task) {
  $model=if ($env:BECK_LM_MODEL) { $env:BECK_LM_MODEL } else { "local-model" }
  $payload=@{
    model=$model
    temperature=0
    stream=$false
    messages=@(
      @{ role="system"; content="Return JSON only. Select exactly one action_id from the supplied allowlist. Never claim completion, payment, revenue, fulfillment, external contact, spending, publication, credentials, or authority." },
      @{ role="user"; content=($Task | ConvertTo-Json -Depth 30 -Compress) }
    )
  } | ConvertTo-Json -Depth 30
  $job=Start-Job -ScriptBlock {
    param($Url,$Body)
    Invoke-RestMethod -Uri $Url -Method Post -Headers @{ "Content-Type"="application/json" } -Body $Body
  } -ArgumentList $LmUrl,$payload
  if (-not (Wait-Job -Job $job -Timeout $MaxLmSeconds)) {
    Stop-Job $job -ErrorAction SilentlyContinue
    Remove-Job $job -Force -ErrorAction SilentlyContinue
    throw "LM_TIMEOUT"
  }
  $r=Receive-Job $job
  Remove-Job $job -Force -ErrorAction SilentlyContinue
  return $r
}

function Parse-LMContent([object]$Response) {
  if ($null -eq $Response.choices -or @($Response.choices).Count -lt 1) { throw "LM_EMPTY_RESPONSE" }
  $raw=[string]$Response.choices[0].message.content
  $structured=$null
  try { $structured=$raw.Trim() | ConvertFrom-Json -ErrorAction Stop } catch {}
  return @{ raw=$raw; structured=$structured }
}

function Invoke-Dispatcher([string]$ActionId,[object]$Job,[string]$SiloId) {
  switch ($ActionId) {
    "LOOP_001_OBSERVE" {
      $recent=@(Get-RecentEvidence $SiloId)
      return @{ source="beck.loop.001"; observation=@{ loop=1; observed_at=(Get-Date).ToUniversalTime().ToString("o"); source="existing_database_evidence"; recent_evidence_count=$recent.Count; evidence_ids=@($recent | ForEach-Object { $_.evidence_id }) } }
    }
    "LOOP_002_NORMALIZE" {
      $since=[uri]::EscapeDataString((Get-Date).ToUniversalTime().AddHours(-24).ToString("o"))
      $u="$SupabaseUrl/rest/v1/cube_evidence_vault?silo_id=eq.$SiloId&source=eq.beck.loop.001&verification_status=eq.VERIFIED&created_at=gte.$since&select=evidence_id,created_at&order=created_at.desc&limit=20"
      $deps=@(Invoke-Rest $u)
      if ($deps.Count -eq 0) { throw "LOOP_001_EVIDENCE_REQUIRED" }
      return @{ source="beck.loop.002"; observation=@{ loop=2; observed_at=(Get-Date).ToUniversalTime().ToString("o"); normalized_from=@($deps | ForEach-Object { $_.evidence_id }); normalization="deterministic_reference_normalization" } }
    }
    "LOOP_003_DEMAND_SCAN" {
      $u="$SupabaseUrl/rest/v1/economic_model_tasks?status=eq.pending&select=task_id,candidate_id,model_name,model_role,created_at&order=created_at.asc&limit=20"
      $tasks=@(Invoke-Rest $u)
      return @{ source="beck.loop.003"; observation=@{ loop=3; observed_at=(Get-Date).ToUniversalTime().ToString("o"); demand_task_count=$tasks.Count; task_ids=@($tasks | ForEach-Object { $_.task_id }) } }
    }
    "LOOP_004_SYNTHESIZE" {
      $since=[uri]::EscapeDataString((Get-Date).ToUniversalTime().AddHours(-24).ToString("o"))
      $u="$SupabaseUrl/rest/v1/cube_evidence_vault?silo_id=eq.$SiloId&source=in.(beck.loop.001,beck.loop.002,beck.loop.003)&created_at=gte.$since&select=evidence_id,source,verification_status,created_at&order=created_at.desc&limit=50"
      $deps=@(Invoke-Rest $u)
      if ($deps.Count -eq 0) { throw "RECENT_LOOP_EVIDENCE_REQUIRED" }
      return @{ source="beck.loop.004"; observation=@{ loop=4; observed_at=(Get-Date).ToUniversalTime().ToString("o"); source_evidence_ids=@($deps | ForEach-Object { $_.evidence_id }); synthesis="reference-only synthesis; no external action" } }
    }
    default { throw "UNKNOWN_ACTION_ID:$ActionId" }
  }
}

function Persist-ActionEvidence([string]$SiloId,[string]$JobId,[hashtable]$ActionEvidence) {
  $canonical=$ActionEvidence | ConvertTo-Json -Depth 30 -Compress
  $sha=[Security.Cryptography.SHA256]::Create()
  try { $hash=(-join ($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($canonical)) | ForEach-Object { $_.ToString("x2") })) } finally { $sha.Dispose() }
  $row=@{ silo_id=$SiloId; source=$ActionEvidence.source; observation=$ActionEvidence.observation; verification_status="UNVERIFIED"; source_ref=("beck_job:"+$JobId); content_hash=$hash }
  $created=Invoke-Rest "$SupabaseUrl/rest/v1/cube_evidence_vault" "Post" @($row)
  $evidenceId=@($created)[0].evidence_id
  Invoke-Rest "$SupabaseUrl/rest/v1/jobs?id=eq.$JobId" "Patch" @{ beck_evidence_ids=@($evidenceId) } | Out-Null
  return $evidenceId
}

function Process-Job([object]$Job) {
  $jobId=[string]$Job.id
  $objectiveId=[string]$Job.beck_objective_id
  $siloId=[string]$Job.payload.silo_id
  Write-Heartbeat $objectiveId "RUNNING"
  $task=@{
    loop=$Job.type
    job_id=$jobId
    objective_id=$objectiveId
    silo_id=$siloId
    allowed_action_ids=@("LOOP_001_OBSERVE","LOOP_002_NORMALIZE","LOOP_003_DEMAND_SCAN","LOOP_004_SYNTHESIZE")
    recent_evidence=@(Get-RecentEvidence $siloId)
    constraints=@("evidence_first","no_external_action","no_revenue_claim")
  }
  try {
    $parsed=Parse-LMContent (Invoke-LM $task)
    $record=Invoke-Rpc "beck_record_lm_output" @{ p_job_id=$jobId; p_raw=$parsed.raw; p_structured=$parsed.structured }
    if ([string]$record.status -ne "UNVERIFIED_VALID") { Write-Heartbeat $objectiveId "RETRY"; return }
    $auth=Invoke-Rpc "beck_authorize_action" @{ p_objective_id=$objectiveId; p_action_id=[string]$parsed.structured.action_id }
    if (-not $auth.allowed) { throw ("AUTHORITY_DENIED:" + $auth.reason) }
    $action=Invoke-Dispatcher ([string]$parsed.structured.action_id) $Job $siloId
    Persist-ActionEvidence $siloId $jobId $action | Out-Null
    $verify=Invoke-Rpc "beck_verify_loop_evidence" @{ p_job_id=$jobId }
    if ([string]$verify.status -eq "VERIFIED") { Write-Heartbeat $objectiveId "VERIFIED" } else { Write-Heartbeat $objectiveId "BLOCKED" }
  } catch {
    try { Invoke-Rest "$SupabaseUrl/rest/v1/jobs?id=eq.$jobId&status=eq.leased&worker_id=eq.$WorkerId" "Patch" @{ status="pending"; last_error=$_.Exception.Message; leased_until=$null } | Out-Null } catch {}
    Write-Heartbeat $objectiveId "RETRY"
  }
}

while ($true) {
  try {
    Invoke-Rpc "beck_heartbeat" @{ p_worker_id=$WorkerId; p_state="IDLE" } | Out-Null
    $job=Invoke-Rpc "claim_beck_objective_job" @{ p_worker_id=$WorkerId; p_lease_seconds=$LeaseSeconds }
    if ($null -ne $job -and [string]$job.id) { Process-Job $job } else { Start-Sleep -Seconds $PollSeconds }
  } catch { Start-Sleep -Seconds $PollSeconds }
}
