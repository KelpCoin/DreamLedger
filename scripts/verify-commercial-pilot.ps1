# Verify the DreamLedger commercial pilot contract.
# Run from the repository root in PowerShell 7 or Windows PowerShell 5.1.
$ErrorActionPreference = 'Stop'
$relative = 'docs/commercial/RT-NOTE-001-response-and-document-extraction-pilot.md'
$path = Join-Path (Get-Location).Path $relative
$proofRoot = 'D:\BrownEyeCortex\Proofs'
$logRoot = 'D:\BrownEyeCortex\Logs'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$proofPath = Join-Path $proofRoot "dreamledger-commercial-pilot-verify-$stamp.json"
$logPath = Join-Path $logRoot "dreamledger-commercial-pilot-verify-$stamp.log"
New-Item -ItemType Directory -Force -Path $proofRoot, $logRoot | Out-Null
$checks = [ordered]@{}
$checks.file_exists = Test-Path -LiteralPath $path -PathType Leaf
$body = if ($checks.file_exists) { Get-Content -LiteralPath $path -Raw } else { '' }
$required = @(
  'independent buyer',
  'settled payment',
  'delivery evidence',
  'untrusted data',
  'explicit approval',
  'REVIEW_REQUIRED',
  'No sales or accuracy targets should be represented as achieved'
)
foreach ($needle in $required) {
  $key = 'contains_' + ($needle -replace '[^A-Za-z0-9]+','_').Trim('_').ToLowerInvariant()
  $checks[$key] = $body.Contains($needle)
}
$checks.no_obvious_live_secret = -not ($body -match '(?i)(sk_live_[A-Za-z0-9]{12,}|whsec_[A-Za-z0-9]{12,})')
$failed = @($checks.GetEnumerator() | Where-Object { -not $_.Value } | ForEach-Object { $_.Key })
$sha256 = if ($checks.file_exists) { (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash } else { $null }
$result = [ordered]@{
  schema = 'dreamledger.commercial-pilot-verification.v1'
  timestamp_utc = [DateTime]::UtcNow.ToString('o')
  status = if ($failed.Count -eq 0) { 'PASS' } else { 'FAIL' }
  repository_root = (Get-Location).Path
  contract_path = $relative
  contract_sha256 = $sha256
  checks = $checks
  failed_checks = $failed
  note = 'Local contract verification only; does not prove deployment, buyer demand, payment, fulfillment, or revenue.'
}
$json = $result | ConvertTo-Json -Depth 8
Set-Content -LiteralPath $proofPath -Value $json -Encoding UTF8
$logLines = @(
  "status=$($result.status)"
  "contract=$relative"
  "sha256=$sha256"
  "proof=$proofPath"
  "failed_checks=$($failed -join ',')"
)
Set-Content -LiteralPath $logPath -Value ($logLines -join [Environment]::NewLine) -Encoding UTF8
$logLines | ForEach-Object { Write-Output $_ }
if ($failed.Count -gt 0) { exit 1 }
exit 0
