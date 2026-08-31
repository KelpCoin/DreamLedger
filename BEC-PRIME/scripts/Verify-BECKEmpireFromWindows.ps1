$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$proofRoot = 'D:\BrownEyeCortex\BECK\proofs'
New-Item -ItemType Directory -Force -Path $proofRoot | Out-Null

$checks = @()
function Add-Check($Name, $Ok, $Detail) {
    $script:checks += [pscustomobject]@{ name = $Name; ok = [bool]$Ok; detail = [string]$Detail }
}

$registry = Join-Path $repo 'docs\BECK-EMPIRE-SILO-REGISTRY.json'
$fee = Join-Path $repo 'docs\BECK-SILO-FEE-POLICY.json'
if (-not (Test-Path $registry)) { throw "Missing registry: $registry" }
if (-not (Test-Path $fee)) { throw "Missing fee policy: $fee" }

$r = Get-Content $registry -Raw | ConvertFrom-Json
$f = Get-Content $fee -Raw | ConvertFrom-Json

Add-Check 'MTG zero fee' ($r.silos.MTG.platform_fee_bps -eq 0) ('bps=' + $r.silos.MTG.platform_fee_bps)
Add-Check 'Amplissa five percent' ($r.silos.AMPLISSA.platform_fee_bps -eq 500) ('bps=' + $r.silos.AMPLISSA.platform_fee_bps)
Add-Check 'BBW five percent' ($r.silos.BBW_SSBBW.platform_fee_bps -eq 500) ('bps=' + $r.silos.BBW_SSBBW.platform_fee_bps)
Add-Check 'DreamMeez five percent' ($r.silos.DREAMMEEZ.platform_fee_bps -eq 500) ('bps=' + $r.silos.DREAMMEEZ.platform_fee_bps)
Add-Check 'Default five percent' ($f.rules.default.platform_fee_bps -eq 500) ('bps=' + $f.rules.default.platform_fee_bps)
Add-Check 'Only MTG is zero' ((@($r.silos.PSObject.Properties | Where-Object { $_.Value.platform_fee_bps -eq 0 })).Count -eq 1) 'registry invariant'

$version = $null
$products = $null
try { $version = Invoke-RestMethod 'https://dreamledger.org/version' -TimeoutSec 20 } catch { Add-Check 'DreamLedger version reachable' $false $_.Exception.Message }
if ($null -ne $version) { Add-Check 'DreamLedger version reachable' $true ($version.commit + ' / ' + $version.surface) }
try { $products = Invoke-WebRequest 'https://dreamledger.org/api/products' -UseBasicParsing -TimeoutSec 20 } catch { Add-Check 'DreamLedger products reachable' $false $_.Exception.Message }
if ($null -ne $products) { Add-Check 'DreamLedger products reachable' ($products.StatusCode -eq 200) ('HTTP=' + $products.StatusCode) }

$stamp = (Get-Date).ToUniversalTime().ToString('o')
$proof = [ordered]@{
    schema = 'BECK/WINDOWS-EMPIRE-PROOF/v1'
    generated_at = $stamp
    repository = $repo
    checks = $checks
    pass = (@($checks | Where-Object { -not $_.ok }).Count -eq 0)
    first_dollar_target = 'EDH_0001'
    mtg_fee_bps = 0
    non_mtg_fee_bps = 500
}
$out = Join-Path $proofRoot 'BECK-EMPIRE-LATEST.json'
$proof | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 $out
$proof | ConvertTo-Json -Depth 8
Write-Host "PROOF: $out"
if (-not $proof.pass) { exit 1 }
Write-Host 'BECK_EMPIRE_VERIFY: PASS'
