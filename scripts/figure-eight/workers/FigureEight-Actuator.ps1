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
