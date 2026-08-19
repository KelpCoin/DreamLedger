$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$checks = @(
  (Join-Path $root 'agentic\AGENT-COMMERCE-MONETIZATION-001.md'),
  (Join-Path $root 'compiled\website\agentic-commerce\index.html'),
  (Join-Path $root 'compiled\website\.well-known\agent-commerce.json'),
  (Join-Path $root 'scripts\verify-agentic-commerce.js'),
  (Join-Path $root 'catalog\offers.json'),
  (Join-Path $root 'catalog\offers\approved.json')
)
$missing = @($checks | Where-Object { -not (Test-Path $_) })
$result = [ordered]@{
  status = if ($missing.Count -eq 0) { 'PASS' } else { 'FAIL' }
  checked_at_utc = [DateTime]::UtcNow.ToString('o')
  repo_root = $root
  missing = $missing
  revenue_claim = 'NONE'
  next_gate = 'FIRST_REAL_PAYMENT'
}
$result | ConvertTo-Json -Depth 5
if ($missing.Count -gt 0) { exit 1 }
