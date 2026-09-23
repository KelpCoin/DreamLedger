#requires -version 5.1
[CmdletBinding()] param([int]$Limit=25,[decimal]$MinScore=0.60)
. (Join-Path $PSScriptRoot '..\FigureEight.Common.ps1')
$worker='replicator'; Set-WorkerHeartbeat $worker 'RUNNING'
try {
  $r=Invoke-FigureEightRpc $worker 'VERIFIED_MECHANISM_CANDIDATES' @{limit=$Limit}
  foreach($m in @($r.mechanisms)){
    $scan=Invoke-FigureEightRpc $worker 'REPLICATOR_SCAN' @{mechanism_id=[string]$m.mechanism_candidate_id;min_score=$MinScore;limit=$Limit}
    $count=0
    foreach($x in @($scan.candidates)){
      $fp=Get-Sha256Text ([string]$m.mechanism_candidate_id+'|'+[string]$x.opportunity_id+'|'+[string]$x.silo_id)
      Invoke-FigureEightRpc $worker 'REPLICATOR_RECORD' @{
        mechanism_id=[string]$m.mechanism_candidate_id;opportunity_id=[string]$x.opportunity_id;silo_id=[string]$x.silo_id
        match_score=[decimal]$x.score;matched_fields=$x.matched_fields;evidence_refs=$x.evidence_refs;candidate_fingerprint=$fp
      }|Out-Null
      $count++
    }
    if($m.cell_id){
      Invoke-FigureEightRpc $worker 'ATTACH_CELL_EVIDENCE' @{cell_id=[string]$m.cell_id;patch=@{replication_candidate_count=$count}}|Out-Null
    }
  }
  Set-WorkerHeartbeat $worker 'PASS'
} catch { Set-WorkerHeartbeat $worker 'ERROR' $_.Exception.Message; throw }
