#requires -version 5.1
[CmdletBinding()]
param([string]$ProjectRef="wbwgroygjeyukkspnqiy")

Set-StrictMode -Version Latest
$ErrorActionPreference="Stop"

$here=(Resolve-Path $PSScriptRoot).Path
$repo=$here
while($repo -and (Split-Path $repo -Parent) -ne $repo){
  if(Test-Path (Join-Path $repo "supabase\migrations")){break}
  $repo=Split-Path $repo -Parent
}
if(-not (Test-Path (Join-Path $repo "supabase\migrations"))){throw "DreamLedger repository root not found."}

$proofDir=Join-Path $repo "proof\figure-eight"
New-Item -ItemType Directory -Force -Path $proofDir|Out-Null
$proofPath=Join-Path $proofDir "verify-proof.json"

$checks=New-Object System.Collections.Generic.List[object]
function Add-Check([string]$Name,[string]$Status,[string]$Detail){$checks.Add([pscustomobject]@{name=$Name;status=$Status;detail=$Detail})}

$diag=Join-Path $repo "scripts\figure-eight\FigureEight-Diagnostic.ps1"
if(Test-Path $diag){
  try{& $diag -ProjectRef $ProjectRef; $dexit=$LASTEXITCODE;Add-Check "diagnostic" (if($dexit -eq 0){"PASS"}else{"FAIL"}) ("exit="+$dexit)}
  catch{Add-Check "diagnostic" "FAIL" $_.Exception.Message}
}else{Add-Check "diagnostic" "FAIL" "missing FigureEight-Diagnostic.ps1"}

if(Get-Command supabase -ErrorAction SilentlyContinue){
  & supabase migration list
  if($LASTEXITCODE -eq 0){Add-Check "migration_history" "PASS" "supabase migration list succeeded"}
  else{Add-Check "migration_history" "FAIL" "supabase migration list failed"}
}else{Add-Check "migration_history" "WARN" "supabase CLI not installed"}

$required=@(
"figure_eight.economic_cells","figure_eight.cell_transitions","figure_eight.economic_outbox",
"figure_eight.reconciliation_events","figure_eight.verification_fossils","figure_eight.rev_atoms",
"figure_eight.mechanism_candidates","figure_eight.replication_candidates","figure_eight.sales_events",
"figure_eight.offer_promotions","figure_eight.processed_events"
)
foreach($name in $required){Add-Check ("table:"+$name) "UNPROVEN" "Requires direct remote DB query; no string-presence claim."}

$contracts=@(
"real_external_signal_creates_cell",
"signal_to_opportunity_requires_linked_opportunity",
"proposition_to_gauntlet_requires_verdict",
"gauntlet_to_authorization_requires_approval_request",
"authorization_requires_human_approval",
"actuator_refuses_non_authorized",
"stable_dedup_key_on_retry",
"duplicate_external_event_rejected",
"reconciliation_works_without_webhook",
"verifier_requires_direct_stripe_observation",
"verification_records_raw_hash_and_query",
"verification_is_reproducible",
"learner_requires_independent_verification",
"learner_requires_observed_fossil",
"learner_outputs_required_patterns",
"replicator_requires_verified_mechanism",
"replicator_outputs_match_score_and_fields",
"restart_is_idempotent",
"failed_external_action_returns_to_action_ready",
"test_simulated_internal_unmatched_never_create_rev_atom"
)
foreach($c in $contracts){Add-Check ("contract:"+$c) "UNPROVEN" "Not upgraded to PASS by source inspection alone."}

$counts=@{}
foreach($s in @("PASS","WARN","FAIL","UNPROVEN")){$counts[$s]=@($checks|Where-Object status -eq $s).Count}
$proof=[ordered]@{
 schema="dreamledger.figure_eight.verify.v2"
 generated_at_utc=(Get-Date).ToUniversalTime().ToString("o")
 repository_root=$repo
 project_ref=$ProjectRef
 counts=$counts
 economic_truth=@{verified_external_revenue_nzd=0;status="UNVERIFIED_UNLESS_REV_ATOM_EXISTS"}
 checks=$checks
}
$proof|ConvertTo-Json -Depth 20|Set-Content -LiteralPath $proofPath -Encoding ASCII
Write-Host ("FIGURE EIGHT VERIFY PASS={0} WARN={1} FAIL={2} UNPROVEN={3}" -f $counts.PASS,$counts.WARN,$counts.FAIL,$counts.UNPROVEN)
Write-Host ("Proof: "+$proofPath)
if($counts.FAIL -gt 0){exit 2}
