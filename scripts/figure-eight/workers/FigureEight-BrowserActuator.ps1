#requires -version 5.1
[CmdletBinding()] param()

. (Join-Path $PSScriptRoot '..\FigureEight.Common.ps1')

$worker = 'browser-actuator'
Set-WorkerHeartbeat $worker 'RUNNING'

function Invoke-LocalBrowserAdapter {
  param([hashtable]$Action)
  $base = [string]$env:DREAMLEDGER_BROWSER_ACTUATOR_URL
  if([string]::IsNullOrWhiteSpace($base)){ throw 'DREAMLEDGER_BROWSER_ACTUATOR_URL is not configured' }
  $uri = $base.TrimEnd('/') + '/v1/execute'
  $json = $Action | ConvertTo-Json -Depth 20 -Compress
  Invoke-RestMethod -Method Post -Uri $uri -ContentType 'application/json' -Body $json -TimeoutSec 120
}

try {
  $r = Invoke-FigureEightRpc $worker 'ACTUATOR_CLAIM' @{}
  if($r.idle){ Set-WorkerHeartbeat $worker 'PASS'; exit 0 }

  $o = $r.outbox
  $c = $r.cell
  $action = $o.action_payload
  $type = [string]$o.action_type

  if([string]$c.state -ne 'ACTION_READY'){ throw "Browser actuator refused non-ACTION_READY cell $($c.cell_id)" }
  if($type -notin @('TRADEME_CREATE_LISTING','TRADEME_EDIT_LISTING','TRADEME_WITHDRAW_LISTING','TRADEME_RELIST')){
    throw "Unsupported browser action type $type"
  }

  if(-not $action.approval_id){ throw 'Browser action requires approval_id' }
  if(-not $action.idempotency_key){ throw 'Browser action requires idempotency_key' }
  if($action.financial_impact -and [decimal]$action.financial_impact.amount -gt 0){
    throw 'Browser actuator refuses spending actions'
  }

  $attempt = Invoke-LocalBrowserAdapter -Action @{
    action_id = [string]$action.action_id
    action_type = $type
    approval_id = [string]$action.approval_id
    idempotency_key = [string]$action.idempotency_key
    target_platform = 'trademe'
    target_account = [string]$action.target_account
    exact_payload = $action.exact_payload
    expected_external_effect = [string]$action.expected_external_effect
    expected_evidence = $action.expected_evidence
    verification_method = [string]$action.verification_method
    risk_class = [string]$action.risk_class
  }

  $receipt = @{
    status = 'ATTEMPTED'
    action_id = [string]$action.action_id
    action_type = $type
    outbox_id = [string]$o.outbox_id
    cell_id = [string]$c.cell_id
    actuator = [string]$attempt.actuator
    external_ref = [string]$attempt.external_ref
    external_url = [string]$attempt.external_url
    attempted_at = [string]$attempt.attempted_at
    request_hash = [string]$attempt.request_hash
    verifier_required = $true
  }

  Invoke-FigureEightRpc $worker 'ACTUATOR_MARK_DISPATCHED' @{
    outbox_id = [string]$o.outbox_id
    external_ref = [string]$attempt.external_ref
    external_url = [string]$attempt.external_url
    request_hash = [string]$attempt.request_hash
    response_hash = [string]$attempt.response_hash
    authorization_hash = [string]$attempt.authorization_hash
    receipt = $receipt
  } | Out-Null

  Set-WorkerHeartbeat $worker 'PASS'
} catch {
  try {
    if($o.outbox_id){
      Invoke-FigureEightRpc $worker 'ACTUATOR_MARK_FAILED' @{
        outbox_id = [string]$o.outbox_id
        error = $_.Exception.Message
      } | Out-Null
    }
  } catch {}
  Set-WorkerHeartbeat $worker 'ERROR' $_.Exception.Message
  throw
}
