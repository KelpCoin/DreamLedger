#requires -version 5.1
[CmdletBinding()] param([int]$Limit=20)
. (Join-Path $PSScriptRoot '..\FigureEight.Common.ps1')
function Pick([bool]$Condition,[string]$WhenTrue,[string]$WhenFalse){if($Condition){return $WhenTrue}else{return $WhenFalse}}
$worker='verifier'; Set-WorkerHeartbeat $worker 'RUNNING'
try {
  $r=Invoke-FigureEightRpc $worker 'VERIFIER_CANDIDATES' @{limit=$Limit}
  foreach($row in @($r.events)){
    $id=[string]$row.checkout_session_id
    if($id -notmatch '^cs_'){continue}
    $sess=Invoke-StripeGetRaw ("checkout/sessions/"+$id+"?expand[]=payment_intent")
    $s=$sess.body|ConvertFrom-Json
    $piid=[string]$row.payment_intent_id
    if([string]::IsNullOrWhiteSpace($piid)){$piid=[string]$s.payment_intent.id}
    if([string]::IsNullOrWhiteSpace($piid)){continue}
    $pi=Invoke-StripeGetRaw ("payment_intents/"+$piid)
    $p=$pi.body|ConvertFrom-Json
    $amountOk=([int64]$p.amount_received -eq [int64]$s.amount_total)
    $currencyOk=([string]$p.currency -eq [string]$s.currency)
    $verified=([bool]$s.livemode -and [string]$s.status -eq 'complete' -and [string]$s.payment_status -eq 'paid' -and [string]$p.status -eq 'succeeded' -and $amountOk -and $currencyOk)
    $hash=Get-Sha256Text ([string]$sess.body + [Environment]::NewLine + [string]$pi.body)
    $input=@{session_id=$id;payment_intent_id=$piid;live_mode=[bool]$s.livemode;session_status=[string]$s.status;payment_status=[string]$s.payment_status;payment_intent_status=[string]$p.status;amount_total=[int64]$s.amount_total;amount_received=[int64]$p.amount_received;currency=[string]$s.currency;amount_match=$amountOk;currency_match=$currencyOk}
    $contentHash=Get-Sha256Text ($hash+'|'+($input|ConvertTo-Json -Compress))
    $verdict=Pick ([bool]$verified) 'VERIFIED' 'REJECTED'
    Invoke-FigureEightRpc $worker 'VERIFIER_RECORD' @{
      cell_id=[string]$row.cell_id;reconciliation_event_id=[string]$row.reconciliation_event_id;provenance='OBSERVED'
      source='stripe_api_direct';verdict=$verdict;query_used=($sess.uri+';'+$pi.uri);raw_response_sha256=$hash;verdict_input=$input;content_hash=$contentHash
    }|Out-Null
    if($verified){
      Invoke-FigureEightRpc $worker 'ATTACH_CELL_EVIDENCE' @{
        cell_id=[string]$row.cell_id
        patch=@{verification_provenance='OBSERVED';verification_fossil_sha256=$hash;verification_verdict='VERIFIED';mode='EXTERNAL_INDEPENDENT_SETTLEMENT';verified='true';external_buyer=@{buyer_observed=$true};settlement=@{amount_nzd=([decimal]$s.amount_total/100);currency=[string]$s.currency;payment_intent_id=$piid};attribution=@{verified=$true;checkout_session_id=$id};attribution_verified='true';fulfillment_verified='false'}
      }|Out-Null
    }
  }
  Set-WorkerHeartbeat $worker 'PASS'
} catch { Set-WorkerHeartbeat $worker 'ERROR' $_.Exception.Message; throw }
