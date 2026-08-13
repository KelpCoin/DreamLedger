$ErrorActionPreference = 'Stop'
$EngineRoot = 'D:\DreamLedger\SovereignSpine'
$Layers = @(
  '1_Sensors\RawSignals',
  '2_Brain\Opportunities',
  '3_Factory\SKU_Store',
  '4_CashRegister\Ledger',
  '5_EvolutionLoop\Metrics',
  'Proof\Fossils',
  'Infrastructure\Deployment'
)

function Initialize-SovereignSpine {
  foreach ($layer in $Layers) {
    New-Item -Path (Join-Path $EngineRoot $layer) -ItemType Directory -Force | Out-Null
  }
  Write-Host 'Sovereign Spine directories initialized.' -ForegroundColor Green
}

function Write-DreamLedgerEvent {
  param(
    [Parameter(Mandatory=$true)][string]$Type,
    [Parameter(Mandatory=$true)][string]$FlowId,
    [hashtable]$Data = @{}
  )
  $eventId = [Guid]::NewGuid().ToString()
  $event = [ordered]@{
    object_type = 'ledger_event'
    event_id = $eventId
    flow_id = $FlowId
    timestamp = [DateTime]::UtcNow.ToString('o')
    type = $Type
    payload = $Data
  }
  $path = Join-Path $EngineRoot ('4_CashRegister\Ledger\' + $eventId + '.json')
  $event | ConvertTo-Json -Depth 20 | Set-Content -Path $path -Encoding UTF8
  return $path
}

function Invoke-BrowningGauntlet {
  param([Parameter(Mandatory=$true)]$Signal)
  if ($null -eq $Signal) { return $false }
  return $true
}

function Start-RevenueCycle {
  param([string]$Source = 'Demand_Radar')
  $flowId = 'FLOW_' + [DateTime]::UtcNow.ToString('yyyyMMdd_HHmmss_fff')
  Write-DreamLedgerEvent -Type 'SIGNAL_RECEIVED' -FlowId $flowId -Data @{ source = $Source } | Out-Null
  if (-not (Invoke-BrowningGauntlet -Signal $Source)) { return $flowId }
  Write-DreamLedgerEvent -Type 'OPPORTUNITY_CREATED' -FlowId $flowId -Data @{ gauntlet = 'PASS' } | Out-Null
  Write-Host "Opportunity created: $flowId" -ForegroundColor Yellow
  return $flowId
}

function New-Fossil {
  param([Parameter(Mandatory=$true)][string]$FlowId)
  throw 'FOSSIL BLOCKED: payment verification and fulfillment evidence are required. This function will not fabricate commercial proof.'
}

Initialize-SovereignSpine
Write-Host 'Sovereign Spine ready. No revenue is claimed without observed payment plus fulfillment evidence.' -ForegroundColor Cyan
