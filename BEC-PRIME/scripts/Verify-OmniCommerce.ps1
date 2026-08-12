#requires -Version 5.1
[CmdletBinding()]
param(
  [string]$Root = (Join-Path $PSScriptRoot '..')
)
$ErrorActionPreference = 'Stop'
$rootPath = (Resolve-Path $Root).Path
$manifest = Join-Path $rootPath 'BEC-PRIME/compiled/omni-commerce-manifest.json'
$sellers = Join-Path $rootPath 'BEC-PRIME/data/marketplace/sellers.json'
$proof = Join-Path $rootPath 'BEC-PRIME/PROOF-OMNI-COMMERCE-VERIFICATION.json'
$required = @($manifest,$sellers)
foreach($file in $required){ if(-not (Test-Path -LiteralPath $file)){ throw "MISSING:$file" } }
$m = Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json
$s = Get-Content -LiteralPath $sellers -Raw | ConvertFrom-Json
$checks = [ordered]@{
  manifest_pass = ($m.status -eq 'PASS')
  multi_vendor_cart = ($m.architecture.multi_vendor_cart -eq $true)
  single_checkout = ($m.architecture.single_stripe_checkout -eq $true)
  stripe_connect_settlement = ($m.architecture.stripe_connect_settlement -eq $true)
  zero_platform_commission = ($m.architecture.platform_commission_bps -eq 0)
  amplissa_excluded = ($m.silo_policy.amplissa_excluded -eq $true)
  adult_excluded = ($m.silo_policy.adult_material_excluded -eq $true)
  forbidden_tokens_checked = ($m.silo_policy.forbidden_tokens_checked -eq $true)
  sellers_json_array = ($s -is [array])
}
$bad = @($checks.GetEnumerator() | Where-Object { -not $_.Value })
$result = [ordered]@{
  schema_version = 'BEC-OMNI-VERIFY-1.0'
  status = if($bad.Count -eq 0){'PASS'}else{'FAIL'}
  checked_at_utc = (Get-Date).ToUniversalTime().ToString('o')
  checks = $checks
  failures = @($bad.Name)
  manifest_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $manifest).Hash
}
$json = $result | ConvertTo-Json -Depth 8
$json | Set-Content -LiteralPath $proof -Encoding UTF8
$json
if($bad.Count -gt 0){ exit 1 }
