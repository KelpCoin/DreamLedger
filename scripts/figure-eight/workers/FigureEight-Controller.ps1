#requires -version 5.1
[CmdletBinding()] param([int]$Limit=20)
. (Join-Path $PSScriptRoot '..\FigureEight.Common.ps1')
$worker='controller'
Set-WorkerHeartbeat $worker 'RUNNING'
try {
  $r=Invoke-FigureEightRpc $worker 'CONTROLLER_SCAN' @{limit=$Limit}
  foreach($c in @($r.cells)){
    $e=$c.state_evidence
    $to=$null; $ev=@{}
    switch([string]$c.state){
      'SIGNAL' { if($c.opportunity_id){$to='OPPORTUNITY';$ev=@{opportunity_id=[string]$c.opportunity_id}}}
      'OPPORTUNITY' { if($e.proposition){$to='PROPOSITION';$ev=@{proposition=$e.proposition}}}
      'PROPOSITION' { if([string]$e.verdict -eq 'PASS'){$to='GAUNTLET_PASS';$ev=@{verdict='PASS'}}}
      'GAUNTLET_PASS' { if($e.approval_id){$to='AWAITING_AUTHORIZATION';$ev=@{approval_id=[string]$e.approval_id}}}
      'AWAITING_AUTHORIZATION' { if([string]$e.status -eq 'APPROVED' -and $e.approved_by){$to='AUTHORIZED';$ev=@{status='APPROVED';approved_by=[string]$e.approved_by}}}
      'AUTHORIZED' { if($e.action){$to='ACTION_READY';$ev=@{authorized=$true;action=$e.action}}}
      'ACTION_DISPATCHED' {
        if([string]$e.external_ref){$to='AWAITING_EXTERNAL_RESPONSE';$ev=@{external_ref=[string]$e.external_ref}}
        elseif([string]$e.outbox_status -eq 'FAILED'){$to='ACTION_READY';$ev=@{retry=$true;reason='external_action_failed'}}
      }
      'AWAITING_EXTERNAL_RESPONSE' { if($e.reconciliation_event_id){$to='EXTERNAL_RESPONSE';$ev=@{reconciliation_event_id=[string]$e.reconciliation_event_id}}}
      'EXTERNAL_RESPONSE' { if([string]$e.settlement_pending -eq 'true'){$to='SETTLEMENT_PENDING';$ev=@{reconciliation_event_id=[string]$e.reconciliation_event_id}}}
      'SETTLEMENT_PENDING' { if([string]$e.mode -eq 'EXTERNAL_INDEPENDENT_SETTLEMENT' -and [string]$e.verified -eq 'true'){$to='SETTLED';$ev=@{mode='EXTERNAL_INDEPENDENT_SETTLEMENT';verified='true'}}}
      'SETTLED' { if([string]$e.attribution_verified -eq 'true'){$to='ATTRIBUTION_VERIFIED';$ev=@{verified='true'}}}
      'ATTRIBUTION_VERIFIED' { if([string]$e.fulfillment_verified -eq 'true'){$to='FULFILLMENT_COMPLETE';$ev=@{verified='true'}}}
      'FULFILLMENT_COMPLETE' { if([string]$e.verification_provenance -eq 'OBSERVED'){$to='INDEPENDENTLY_VERIFIED';$ev=@{provenance='OBSERVED';truth_status='VERIFIED'}}}
      'INDEPENDENTLY_VERIFIED' {
        $m=Invoke-FigureEightRpc $worker 'MATERIALIZE_REV_ATOM' @{cell_id=[string]$c.cell_id}
        if($m.ok -and $m.rev_atom){$to='REV_ATOM';$ev=@{truth_status='VERIFIED';rev_atom_id=[string]$m.rev_atom.rev_atom_id}}
      }
      'REV_ATOM' { if($e.mechanism_candidate_id){$to='MECHANISM_CANDIDATE';$ev=@{mechanism_candidate_id=[string]$e.mechanism_candidate_id}}}
      'MECHANISM_CANDIDATE' { if([string]$e.mechanism_status -eq 'VERIFIED'){$to='MECHANISM_VERIFIED';$ev=@{status='VERIFIED'}}}
      'MECHANISM_VERIFIED' { if($null -ne $e.replication_candidate_count){$to='REPLICATION_QUEUE';$ev=@{replication_candidate_count=[int]$e.replication_candidate_count}}}
    }
    if($to){
      $x=Invoke-FigureEightRpc $worker 'CONTROLLER_TRANSITION' @{
        cell_id=[string]$c.cell_id; expected_version=[int64]$c.version; from_state=[string]$c.state
        to_state=$to; evidence=$ev
      }
      Write-StructuredLog $worker 'transition' 'INFO' @{cell_id=$c.cell_id;from=$c.state;to=$to;result=$x}
    }
  }
  Set-WorkerHeartbeat $worker 'PASS'
} catch { Set-WorkerHeartbeat $worker 'ERROR' $_.Exception.Message; throw }
