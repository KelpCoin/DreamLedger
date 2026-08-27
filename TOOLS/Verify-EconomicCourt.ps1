#requires -version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Repo = "KelpCoin/DreamLedger"
$Root = "D:\BrownEyeCortex"
$TruthDir = Join-Path $Root "PROOFS\TRUTH"
$MirrorDir = Join-Path $Root "PROOFS\ECONOMIC_COURT"
$VerifyLogDir = Join-Path $MirrorDir "VERIFY"

if (-not (Test-Path (Join-Path $Root ".git"))) { throw "FAIL canonical Git repository not found: $Root" }

Write-Host "Pulling canonical Court state..."
& git -C $Root pull --ff-only
if ($LASTEXITCODE -ne 0) { throw "FAIL git pull" }
if (-not (Test-Path $TruthDir)) { throw "FAIL missing truth directory: $TruthDir" }

$Latest = Get-ChildItem -Path $TruthDir -Filter "*-economic-truth.json" -File | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
if (-not $Latest) { throw "FAIL no Economic Court truth artifact found." }

$HashFile = [System.IO.Path]::ChangeExtension($Latest.FullName, ".sha256")
if (-not (Test-Path $HashFile)) { throw "FAIL missing SHA-256 manifest: $HashFile" }

$Manifest = (Get-Content -Raw -LiteralPath $HashFile).Trim()
$Parts = $Manifest -split "\s+", 2
if ($Parts.Count -lt 2) { throw "FAIL malformed SHA-256 manifest" }
$ExpectedHash = $Parts[0].ToLowerInvariant()
$ExpectedName = $Parts[1].Trim()
if ($ExpectedName -ne $Latest.Name) { throw "FAIL manifest filename mismatch" }

$ActualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $Latest.FullName).Hash.ToLowerInvariant()
if ($ActualHash -ne $ExpectedHash) { throw "FAIL SHA-256 mismatch" }

$Data = Get-Content -Raw -LiteralPath $Latest.FullName | ConvertFrom-Json
if ([int]$Data.schema_version -ne 2) { throw "FAIL schema_version: expected 2" }
if ([string]$Data.product_id -ne "3000") { throw "FAIL product_id" }
if ([int]$Data.facts.supabase_http -ne 200) { throw "FAIL Supabase HTTP" }
if ($Data.facts.overlap_pairs.Count -ne 0) { throw "FAIL overlap check" }
if ([string]$Data.economic_truth.first_sale_gate -ne "ONE_REAL_EXTERNAL_PAYMENT") { throw "FAIL gate" }

$Revenue = [decimal]$Data.economic_truth.revenue_nzd_proven
$Customers = [int]$Data.economic_truth.external_customers_proven
$StripeCheck = [string]$Data.economic_truth.stripe_settlement_independent_check
$VerifiedPayments = @($Data.stripe_independent_observation.verified_payments)

if ($Revenue -lt 0) { throw "FAIL negative revenue" }
if ($Customers -lt 0) { throw "FAIL negative customer count" }
if ($StripeCheck -notin @("PASS", "FAIL", "NOT_CONFIGURED")) { throw "FAIL Stripe check state" }

$State = "UNKNOWN"
if ($Revenue -eq 0 -and $Customers -eq 0) {
    $State = "PRE_SALE"
    if ($VerifiedPayments.Count -ne 0) { throw "FAIL PRE_SALE contains verified payments" }
}
elseif ($Revenue -gt 0 -and $Customers -gt 0) {
    $State = "ECONOMIC_GATE_PASSED"
    if ($StripeCheck -ne "PASS") { throw "FAIL revenue cannot be proven without independent Stripe PASS" }
    if ($VerifiedPayments.Count -ne $Customers) { throw "FAIL customer count does not match verified payment count" }
}
else {
    throw "FAIL illegal economic state: revenue/customer counts are inconsistent"
}

$CalculatedRevenue = [decimal]0
foreach ($Payment in $VerifiedPayments) {
    if ([string]$Payment.status -ne "succeeded") { throw "FAIL verified payment is not succeeded" }
    if ([string]$Payment.currency -ne "nzd") { throw "FAIL verified payment currency is not nzd" }
    if ([decimal]$Payment.amount_nzd -ne 50) { throw "FAIL verified payment amount is not NZ$50" }
    $CalculatedRevenue += [decimal]$Payment.amount_nzd
}
if ($Revenue -ne $CalculatedRevenue) { throw "FAIL revenue does not equal independently verified Stripe settlement total" }

New-Item -ItemType Directory -Force -Path $MirrorDir | Out-Null
New-Item -ItemType Directory -Force -Path $VerifyLogDir | Out-Null
Copy-Item -LiteralPath $Latest.FullName -Destination (Join-Path $MirrorDir $Latest.Name) -Force
Copy-Item -LiteralPath $HashFile -Destination (Join-Path $MirrorDir ([System.IO.Path]::GetFileName($HashFile))) -Force

$Proof = [ordered]@{
    verified_at = (Get-Date).ToUniversalTime().ToString("o")
    repository = $Repo
    latest_truth_artifact = $Latest.Name
    proof_sha256 = $ActualHash
    state = $State
    revenue_proven_nzd = [double]$Revenue
    customers_proven = $Customers
    stripe_settlement_independent_check = $StripeCheck
    gate = [string]$Data.economic_truth.first_sale_gate
    verifier_status = "PASS"
}
$LogFile = Join-Path $VerifyLogDir ((Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHHmmssZ") + "-verify.json")
$Proof | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $LogFile -Encoding UTF8

Write-Host "VERIFICATION PASS"
Write-Host "Repository: $Repo"
Write-Host "Latest proof: $($Latest.FullName)"
Write-Host "SHA-256: $ActualHash"
Write-Host "STATE: $State"
Write-Host "Revenue proven: NZ$$($Revenue)"
Write-Host "Customers proven: $Customers"
Write-Host "Stripe independent check: $StripeCheck"
Write-Host "Gate: $($Data.economic_truth.first_sale_gate)"
Write-Host "Local verification proof: $LogFile"
Write-Host "VERIFIER_STATUS: PASS"
