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
    "INSPECT_COMMERCIAL_PATH" {
      $offers=@(Invoke-Rest "$SupabaseUrl/rest/v1/offers?lifecycle_status=in.(live,sale_ready)&visibility=in.(public,featured)&select=id,title,final_price_cents,currency,lifecycle_status,visibility,slug,exposure_budget,raw_metrics&order=updated_at.desc&limit=20")
      $cells=@(Invoke-Rest "$SupabaseUrl/rest/v1/commerce_cells?state=eq.SELLABLE&verified_checkout=eq.true&verified_fulfillment=eq.true&verified_webhook=eq.true&select=offer_id,sku,product_id,price_cents,checkout_url,fulfillment_type,state,acquisition_state,approval_required,verified_checkout,verified_fulfillment,verified_webhook&limit=20")
      $actions=@(Invoke-Rest "$SupabaseUrl/rest/v1/economic_actions?approval_required=eq.true&executed_at=is.null&select=action_id,candidate_id,offer_id,action_type,approved_by,approved_at,result,metadata,created_at&order=created_at.desc&limit=20")
      return @{ source="beck.economic.inspect"; observation=@{ objective_id=$Job.beck_objective_id; offers=$offers; sellable_cells=$cells; pending_distribution_actions=$actions } }
    }
    "ANALYZE_ECONOMICS" {
      $snapshot=Invoke-Rpc "beck_economic_snapshot" @{ p_objective_id=[string]$Job.beck_objective_id }
      return @{ source="beck.economic.analysis"; observation=@{ snapshot=$snapshot; rule="verified Stripe revenue is economic truth; model output is not"; margin_gate="meaningful spend requires deterministic price/cost check" } }
    }
    "VERIFY_CHECKOUT" {
      $cells=@(Invoke-Rest "$SupabaseUrl/rest/v1/commerce_cells?state=eq.SELLABLE&select=sku,product_id,price_cents,checkout_url,verified_checkout,verified_fulfillment,verified_webhook,acquisition_state&limit=20")
      return @{ source="beck.commercial.checkout"; observation=@{ checked_at=(Get-Date).ToUniversalTime().ToString("o"); cells=$cells } }
    }
    "DISCOVER_DEMAND" {
      $signals=@(Invoke-Rest "$SupabaseUrl/rest/v1/economic_demand_signals?status=in.(ACTIVE,VERIFIED,OPEN)&select=signal_id,source,source_ref,problem_text,buyer_intent,estimated_value_nzd,status,source_url,title,observed_at&order=observed_at.desc&limit=20")
      $prospects=@(Invoke-Rest "$SupabaseUrl/rest/v1/prospecting_candidates?approval_status=eq.pending_human_review&select=id,candidate_name,target_offer,candidate_source,candidate_contact_hint,confidence,approval_status,created_at&order=created_at.desc&limit=20")
      return @{ source="beck.market.sense"; observation=@{ demand_signals=$signals; prospect_candidates=$prospects } }
    }
    "PREPARE_DISTRIBUTION" {
      $prospects=@(Invoke-Rest "$SupabaseUrl/rest/v1/prospecting_candidates?approval_status=eq.pending_human_review&select=id,candidate_name,target_offer,candidate_source,candidate_contact_hint,confidence,approval_status,created_at&order=created_at.desc&limit=20")
      $actions=@(Invoke-Rest "$SupabaseUrl/rest/v1/economic_actions?approval_required=eq.true&approved_at=is.null&executed_at=is.null&action_type=eq.OUTREACH_PREPARED&select=action_id,candidate_id,offer_id,action_type,result,metadata,created_at&order=created_at.desc&limit=20")
      return @{ source="beck.distribution.prepare"; observation=@{ prospects=$prospects; existing_prepared_actions=$actions; execution="NOT_SENT"; approval_required=$true } }
    }
    "PREPARE_OUTREACH" {
      $actions=@(Invoke-Rest "$SupabaseUrl/rest/v1/economic_actions?approval_required=eq.true&approved_at=is.null&executed_at=is.null&action_type=eq.OUTREACH_PREPARED&select=action_id,candidate_id,offer_id,action_type,result,metadata,created_at&order=created_at.desc&limit=20")
      return @{ source="beck.distribution.queue"; observation=@{ prepared_actions=$actions; execution="NOT_SENT"; approval_required=$true } }
    }
    "VERIFY_PAYMENT" {
      $result=Invoke-Rpc "beck_verify_objective" @{ p_objective_id=[string]$Job.beck_objective_id }
      return @{ source="beck.economic.payment"; observation=@{ verifier_result=$result } }
    }
    "RECONCILE_REVENUE" {
      $paid=@(Invoke-Rest "$SupabaseUrl/rest/v1/revenue_orders?status=eq.paid&select=id,stripe_event_id,stripe_checkout_session_id,stripe_payment_intent_id,sku_id,amount_nzd,currency,paid_at&order=paid_at.desc&limit=20")
      $fulfill=@(Invoke-Rest "$SupabaseUrl/rest/v1/fulfillment_requests?select=id,sku_id,status,created_at,updated_at&order=created_at.desc&limit=20")
      return @{ source="beck.economic.reconciliation"; observation=@{ paid_orders=$paid; fulfillment=$fulfill } }
    }
    "FULFIL_ORDER" {
      $result=Invoke-Rpc "beck_verify_objective" @{ p_objective_id=[string]$Job.beck_objective_id }
      return @{ source="beck.fulfillment"; observation=@{ verifier_result=$result; note="fulfillment remains bound to existing verified commerce path" } }
    }
    "LEARN_FROM_OUTCOME" {
      $outcomes=@(Invoke-Rest "$SupabaseUrl/rest/v1/economic_outcomes?select=outcome_id,offer_id,outcome_type,amount_nzd,founder_minutes,fulfilment_minutes,acquisition_cost_nzd,payment_fees_nzd,external_reference,observed_at,metadata&order=observed_at.desc&limit=20")
      $actions=@(Invoke-Rest "$SupabaseUrl/rest/v1/economic_actions?select=action_id,action_type,result,metadata,created_at&order=created_at.desc&limit=20")
      return @{ source="beck.learning"; observation=@{ outcomes=$outcomes; recent_actions=$actions } }
    }
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
      $signals=@(Invoke-Rest "$SupabaseUrl/rest/v1/economic_demand_signals?select=signal_id,source,problem_text,buyer_intent,estimated_value_nzd,status,source_url,title,observed_at&order=observed_at.desc&limit=20")
      return @{ source="beck.loop.003"; observation=@{ loop=3; observed_at=(Get-Date).ToUniversalTime().ToString("o"); demand_signal_count=$signals.Count; signal_ids=@($signals | ForEach-Object { $_.signal_id }) } }
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
  $wire=$ActionEvidence | ConvertTo-Json -Depth 30 -Compress
  $canonical=$wire | node -e "let s=''; function c(v){if(Array.isArray(v))return '['+v.map(c).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+c(v[k])).join(',')+'}';return JSON.stringify(v)} process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(c(JSON.parse(s))));"
  if ([string]::IsNullOrWhiteSpace($canonical)) { throw "JCS_CANONICALIZATION_FAILED" }
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
    allowed_action_ids=@("INSPECT_COMMERCIAL_PATH","ANALYZE_ECONOMICS","VERIFY_CHECKOUT","DISCOVER_DEMAND","PREPARE_DISTRIBUTION","PREPARE_OUTREACH","VERIFY_PAYMENT","RECONCILE_REVENUE","FULFIL_ORDER","LEARN_FROM_OUTCOME","LOOP_001_OBSERVE","LOOP_002_NORMALIZE","LOOP_003_DEMAND_SCAN","LOOP_004_SYNTHESIZE")
    recent_evidence=@(Get-RecentEvidence $siloId)
    constraints=@("economic_objective","deterministic_gate","evidence_first","no_external_send_without_approval","no_spending","no_revenue_claim","BusinessTruth_only_for_verified_revenue")
  }
  try {
    $parsed=Parse-LMContent (Invoke-LM $task)
    $record=Invoke-Rpc "beck_record_lm_output" @{ p_job_id=$jobId; p_worker_id=$WorkerId; p_lease_token=[string]$Job.lease_token; p_raw=$parsed.raw; p_structured=$parsed.structured }
    if ([string]$record.status -ne "UNVERIFIED_VALID") { Write-Heartbeat $objectiveId "RETRY"; return }
    $auth=Invoke-Rpc "beck_authorize_action" @{ p_objective_id=$objectiveId; p_action_id=[string]$parsed.structured.action_id }
    if (-not $auth.allowed) { throw ("AUTHORITY_DENIED:" + $auth.reason) }
    $action=Invoke-Dispatcher ([string]$parsed.structured.action_id) $Job $siloId
    Persist-ActionEvidence $siloId $jobId $action | Out-Null
    $verify=Invoke-Rpc "beck_verify_loop_evidence" @{ p_job_id=$jobId }
    if ([string]$verify.status -eq "VERIFIED") { Write-Heartbeat $objectiveId "VERIFIED" } else { Write-Heartbeat $objectiveId "BLOCKED" }
  } catch {
    try { Invoke-Rest "$SupabaseUrl/rest/v1/jobs?id=eq.$jobId&status=eq.leased&worker_id=eq.$WorkerId&lease_token=eq.$([uri]::EscapeDataString([string]$Job.lease_token))" "Patch" @{ status="pending"; last_error=$_.Exception.Message; leased_until=$null } | Out-Null } catch {}
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
