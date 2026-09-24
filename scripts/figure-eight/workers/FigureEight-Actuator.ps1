#requires -version 5.1
[CmdletBinding()] param()
. (Join-Path $PSScriptRoot '..\FigureEight.Common.ps1')
$worker='actuator'; Set-WorkerHeartbeat $worker 'RUNNING'
try {
  $r=Invoke-FigureEightRpc $worker 'ACTUATOR_CLAIM' @{}
  if($r.idle){Set-WorkerHeartbeat $worker 'PASS';exit 0}
  $o=$r.outbox; $c=$r.cell; $action=$o.action_payload; $type=[string]$o.action_type
  if([string]$c.state -ne 'ACTION_READY'){throw "Actuator refused non-ACTION_READY cell $($c.cell_id)"}
  switch($type){
    'OPEN_STRIPE_CHECKOUT' {
      $url=[string]$action.checkout_url
      if([string]::IsNullOrWhiteSpace($url)){throw 'OPEN_STRIPE_CHECKOUT requires checkout_url'}
      Invoke-FigureEightRpc $worker 'ACTUATOR_MARK_DISPATCHED' @{
        outbox_id=[string]$o.outbox_id; external_ref=$url; external_url=$url
        request_hash=(Get-Sha256Text ($o.action_payload|ConvertTo-Json -Compress))
        response_hash=(Get-Sha256Text ($url+'|'+[string]$c.cell_id))
        authorization_hash=(Get-Sha256Text ([string]$c.state_evidence.approval_id))
      }|Out-Null
    }
    'TRADEME_CREATE_LISTING' {
      $base=[string]$env:DREAMLEDGER_BROWSER_ACTUATOR_URL
      if([string]::IsNullOrWhiteSpace($base)){throw 'DREAMLEDGER_BROWSER_ACTUATOR_URL is not configured'}
      if(-not $action.approval_id){throw 'TRADEME_CREATE_LISTING requires approval_id'}
      if(-not $action.idempotency_key){throw 'TRADEME_CREATE_LISTING requires idempotency_key'}
      if($action.financial_impact -and [decimal]$action.financial_impact.amount -gt 0){throw 'Browser actuator refuses spending actions'}
      $payload=@{
        action_id=[string]$action.action_id
        action_type=$type
        approval_id=[string]$action.approval_id
        idempotency_key=[string]$action.idempotency_key
        target_platform='trademe'
        target_account=[string]$action.target_account
        exact_payload=$action.exact_payload
        expected_external_effect=[string]$action.expected_external_effect
        expected_evidence=$action.expected_evidence
        verification_method=[string]$action.verification_method
        risk_class=[string]$action.risk_class
      }
      $attempt=Invoke-RestMethod -Method Post -Uri ($base.TrimEnd('/')+'/v1/execute') -ContentType 'application/json' -Body ($payload|ConvertTo-Json -Depth 20 -Compress) -TimeoutSec 120
      if([string]$attempt.status -ne 'ATTEMPTED'){throw 'Browser adapter did not return ATTEMPTED'}
      Invoke-FigureEightRpc $worker 'ACTUATOR_MARK_DISPATCHED' @{
        outbox_id=[string]$o.outbox_id
        external_ref=[string]$attempt.external_ref
        external_url=[string]$attempt.external_url
        request_hash=[string]$attempt.request_hash
        response_hash=[string]$attempt.response_hash
        authorization_hash=(Get-Sha256Text ([string]$action.approval_id))
        receipt=$attempt
      }|Out-Null
    }
    'TRADEME_EDIT_LISTING' {
      throw 'TRADEME_EDIT_LISTING requires the same authenticated browser adapter and is intentionally not enabled until CREATE_LISTING is verified'
    }
    'TRADEME_WITHDRAW_LISTING' {
      throw 'TRADEME_WITHDRAW_LISTING requires the same authenticated browser adapter and is intentionally not enabled until CREATE_LISTING is verified'
    }
    'TRADEME_RELIST' {
      throw 'TRADEME_RELIST requires the same authenticated browser adapter and is intentionally not enabled until CREATE_LISTING is verified'
    }
    'CREATE_STRIPE_CHECKOUT_SESSION' {
      $form=@{
        mode='payment'; success_url=[string]$action.success_url; cancel_url=[string]$action.cancel_url
        client_reference_id=[string]$c.cell_id
        'line_items[0][price]'=[string]$action.price_id; 'line_items[0][quantity]'='1'
        'metadata[cell_id]'=[string]$c.cell_id
      }
      $s=Invoke-StripePost 'checkout/sessions' $form ([string]$o.dedup_key)
      Invoke-FigureEightRpc $worker 'ACTUATOR_MARK_DISPATCHED' @{
        outbox_id=[string]$o.outbox_id; external_ref=[string]$s.id; external_url=[string]$s.url
        request_hash=(Get-Sha256Text ($form|ConvertTo-Json -Compress))
        response_hash=(Get-Sha256Text ($s|ConvertTo-Json -Compress))
        authorization_hash=(Get-Sha256Text ([string]$c.state_evidence.approval_id))
      }|Out-Null
    }
    default {throw "Unsupported action_type $type"}
  }
  Set-WorkerHeartbeat $worker 'PASS'
} catch {
  try { if($o.outbox_id){Invoke-FigureEightRpc $worker 'ACTUATOR_MARK_FAILED' @{outbox_id=[string]$o.outbox_id;error=$_.Exception.Message}|Out-Null} } catch {}
  Set-WorkerHeartbeat $worker 'ERROR' $_.Exception.Message; throw
}
