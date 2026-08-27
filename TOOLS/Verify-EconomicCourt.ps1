#requires -version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Repo = "KelpCoin/DreamLedger"
$Root = "D:\BrownEyeCortex"
$TruthDir = Join-Path $Root "PROOFS\TRUTH"
$LegacyDir = Join-Path $Root "PROOFS\ECONOMIC_COURT"

if (-not (Test-Path (Join-Path $Root ".git"))) {
    throw "FAIL canonical Git repository not found: $Root"
}

Write-Host "Pulling canonical Court state..."
& git -C $Root pull --ff-only
if ($LASTEXITCODE -ne 0) { throw "FAIL git pull" }

if (-not (Test-Path $TruthDir)) { throw "FAIL missing truth directory: $TruthDir" }

$Latest = Get-ChildItem -Path $TruthDir -Filter "*-economic-truth.json" -File |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1

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

if ($Data.schema_version -ne 2) { throw "FAIL schema_version" }
if ($Data.product_id -ne "3000") { throw "FAIL product_id" }
if ($Data.facts.supabase_http -ne 200) { throw "FAIL Supabase HTTP" }
if ($Data.facts.overlap_pairs.Count -ne 0) { throw "FAIL overlap check" }
if ($Data.economic_truth.first_sale_gate -ne "ONE_REAL_EXTERNAL_PAYMENT") { throw "FAIL gate" }
if ($null -eq $Data.economic_truth.revenue_nzd_proven) { throw "FAIL revenue field" }
if ($null -eq $Data.economic_truth.external_customers_proven) { throw "FAIL customer field" }

$StripeCheck = [string]$Data.economic_truth.stripe_settlement_independent_check
if ($StripeCheck -notin @("PASS", "FAIL", "NOT_CONFIGURED")) { throw "FAIL Stripe check state" }

if ([double]$Data.economic_truth.revenue_nzd_proven -gt 0 -and $StripeCheck -ne "PASS") {
    throw "FAIL revenue cannot be proven without independent Stripe PASS"
}

New-Item -ItemType Directory -Force -Path $LegacyDir | Out-Null
Copy-Item -LiteralPath $Latest.FullName -Destination (Join-Path $LegacyDir $Latest.Name) -Force
Copy-Item -LiteralPath $HashFile -Destination (Join-Path $LegacyDir ([System.IO.Path]::GetFileName($HashFile))) -Force

Write-Host "PASS"
Write-Host "Repository: $Repo"
Write-Host "Latest proof: $($Latest.FullName)"
Write-Host "SHA-256: $ActualHash"
Write-Host "Revenue proven: NZ$$($Data.economic_truth.revenue_nzd_proven)"
Write-Host "Customers proven: $($Data.economic_truth.external_customers_proven)"
Write-Host "Stripe independent check: $StripeCheck"
Write-Host "Gate: $($Data.economic_truth.first_sale_gate)"
Write-Host "VERIFIER_STATUS: PASS"
