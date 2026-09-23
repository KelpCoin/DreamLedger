#requires -version 5.1
[CmdletBinding()] param([int]$Limit=20)
. (Join-Path $PSScriptRoot '..\FigureEight.Common.ps1')
$worker='learner'; Set-WorkerHeartbeat $worker 'RUNNING'
try {
  $r=Invoke-FigureEightRpc $worker 'LEARNER_CANDIDATES' @{limit=$Limit}
  foreach($x in @($r.rev_atoms)){
    $p=@{
      rev_atom_id=[string]$x.rev_atom_id; name='Verified Economic Mechanism Candidate'
      signal_pattern=$x.signal_pattern; proposition_pattern=$x.proposition_pattern
      price_pattern=@{settlement=$x.state_evidence.settlement}
      channel_pattern=@{external_buyer=$x.state_evidence.external_buyer}
      response_pattern=@{observed='external_response'}; fulfillment_pattern=$x.state_evidence.fulfillment
      proof_pattern=$x.proof_pattern; conditions=@{source='OBSERVED';truth_status='VERIFIED'}; outcome=@{rev_atom_id=[string]$x.rev_atom_id}
    }
    $m=Invoke-FigureEightRpc $worker 'LEARNER_RECORD' $p
    if($m.ok -and $m.mechanism_candidate){
      $mid=[string]$m.mechanism_candidate.mechanism_candidate_id
      Invoke-FigureEightRpc $worker 'MECHANISM_RECORD_VERIFIED' @{mechanism_id=$mid}|Out-Null
      Invoke-FigureEightRpc $worker 'ATTACH_CELL_EVIDENCE' @{cell_id=[string]$x.cell_id;patch=@{mechanism_candidate_id=$mid;mechanism_status='VERIFIED'}}|Out-Null
    }
  }
  Set-WorkerHeartbeat $worker 'PASS'
} catch { Set-WorkerHeartbeat $worker 'ERROR' $_.Exception.Message; throw }
