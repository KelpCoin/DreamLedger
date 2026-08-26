param(
  [string]$EventFile = $(if ($env:INVERSE_ECONOMIC_EVENT_FILE) { $env:INVERSE_ECONOMIC_EVENT_FILE } else { 'C:\BrownEyeCortex\BEC-PRIME\data\inverse-commerce\economic-events.jsonl' })
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if (-not (Test-Path -LiteralPath $EventFile)) {
  Write-Host 'EVENT_LEDGER: EMPTY'
  Write-Host ('FILE: ' + $EventFile)
  exit 0
}

$lines = @(Get-Content -LiteralPath $EventFile | Where-Object { $_.Trim() })
$events = @()
foreach ($line in $lines) {
  try { $events += ($line | ConvertFrom-Json) }
  catch { throw ('Invalid JSONL event: ' + $line) }
}

$ids = @($events | ForEach-Object { [string]$_.event_id })
$duplicates = @($ids | Group-Object | Where-Object { $_.Count -gt 1 })
if ($duplicates.Count -gt 0) { throw 'Duplicate event_id detected' }

$bad = @($events | Where-Object {
  $_.schema_version -ne 'economic-event-v1' -or
  $_.event_type -ne 'PAYMENT_SETTLED' -or
  $_.source -ne 'stripe' -or
  $_.livemode -ne $true -or
  $_.sku -ne 'INVERSE-SHOPPING-SOURCE-001' -or
  $_.commercial_signal -ne 'PASS'
})
if ($bad.Count -gt 0) { throw 'One or more economic events failed the invariant checks' }

Write-Host 'EVENT_LEDGER: PASS'
Write-Host ('COUNT: ' + $events.Count)
Write-Host ('FILE: ' + $EventFile)
Write-Host 'COMMERCIAL_SIGNAL_EVENTS: PASS'
exit 0
