#requires -version 5.1
[CmdletBinding()] param([int]$Limit=20)
. (Join-Path $PSScriptRoot '..\FigureEight.Common.ps1')
function Pick([bool]$Condition,[string]$WhenTrue,[string]$WhenFalse){if($Condition){return $WhenTrue}else{return $WhenFalse}}
$worker='reconciler'; Set-WorkerHeartbeat $worker 'RUNNING'
try {
  $r=Invoke-FigureEightRpc $worker 'RECONCILER_CANDIDATES' @{limit=$Limit}
  foreach($row in @($r.cells)){
    $ref=[string]$row.external_ref
    if($ref -notmatch '^cs_'){continue}
    $raw=Invoke-StripeGetRaw ("checkout/sessions/"+$ref+"?expand[]=payment_intent")
    $o=$raw.body|ConvertFrom-Json
    $paid=([string]$o.payment_status -eq 'paid')
    $mode=Pick ([bool]$o.livemode) 'EXTERNAL_INDEPENDENT_SETTLEMENT' 'TEST_MODE'
    $facts=@{checkout_session_id=$ref;payment_intent_id=[string]$o.payment_intent.id;payment_status=[string]$o.payment_status;status=[string]$o.status;livemode=[bool]$o.livemode;amount_total=[int64]$o.amount_total;currency=[string]$o.currency}
    $key=Get-Sha256Text ($ref+'|'+$raw.body_sha256+'|'+$raw.status_code)
    $rec=Invoke-FigureEightRpc $worker 'RECONCILER_RECORD' @{
      cell_id=[string]$row.cell_id;source='STRIPE_API_POLL';event_key=$key;checkout_session_id=$ref
      payment_intent_id=[string]$o.payment_intent.id;mode=$mode;verified=($paid -and [bool]$o.livemode)
      query_used=$raw.uri;raw_response=$raw.body;facts=$facts
    }
    Invoke-FigureEightRpc $worker 'ATTACH_CELL_EVIDENCE' @{
      cell_id=[string]$row.cell_id
      patch=@{reconciliation_event_id=[string]$rec.reconciliation_event.reconciliation_event_id;external_ref=$ref;settlement_pending=($paid -and [bool]$o.livemode)}
    }|Out-Null
  }
  Set-WorkerHeartbeat $worker 'PASS'
} catch { Set-WorkerHeartbeat $worker 'ERROR' $_.Exception.Message; throw }
