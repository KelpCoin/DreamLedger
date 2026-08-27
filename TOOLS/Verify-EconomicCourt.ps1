#requires -version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Repo = "KelpCoin/DreamLedger"
$Root = "D:\BrownEyeCortex"
$ProofDir = Join-Path $Root "PROOFS\ECONOMIC_COURT"

if (-not (Test-Path $ProofDir)) { throw "Missing proof directory: $ProofDir" }

$Latest = Get-ChildItem -Path $ProofDir -Filter "*-economic-truth.json" -File |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1

if (-not $Latest) { throw "No Economic Court proof artifact found." }

$Data = Get-Content -Raw -LiteralPath $Latest.FullName | ConvertFrom-Json

if ($Data.product_id -ne "3000") { throw "FAIL product_id" }
if ($Data.economic_truth.revenue_nzd_proven -ne 0) { throw "FAIL revenue truth" }
if ($Data.economic_truth.external_customers_proven -ne 0) { throw "FAIL customer truth" }
if ($Data.economic_truth.first_sale_gate -ne "ONE_REAL_EXTERNAL_PAYMENT") { throw "FAIL gate" }

Write-Host "PASS"
Write-Host "Latest proof: $($Latest.FullName)"
Write-Host "Revenue proven: NZ$0"
Write-Host "Customers proven: 0"
Write-Host "Gate: ONE_REAL_EXTERNAL_PAYMENT"
