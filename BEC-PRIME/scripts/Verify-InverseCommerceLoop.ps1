#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$Root = 'C:\BrownEyeCortex\DreamLedger\BEC-PRIME',
    [string]$ProofRoot = 'D:\BrownEyeCortex\InverseShopping\proof'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$checks = New-Object System.Collections.Generic.List[object]
function Check([string]$Name,[bool]$Pass,[string]$Detail) { $checks.Add([pscustomobject]@{name=$Name;status=$(if($Pass){'PASS'}else{'FAIL'});detail=$Detail}) }

Check 'WANTED_ROUTE' (Test-Path (Join-Path $Root 'routes\wanted.js')) 'routes/wanted.js exists'
Check 'HUNT_ENGINE' (Test-Path (Join-Path $Root 'hunt\HuntEngine.js')) 'hunt/HuntEngine.js exists'
Check 'PROOF_VERIFIER' (Test-Path (Join-Path $Root 'scripts\verify-wanted-hunt-proof.js')) 'independent proof verifier exists'
Check 'PROOF_RUNNER' (Test-Path (Join-Path $Root 'scripts\Invoke-WantedHuntProof.ps1')) 'live proof runner exists'
Check 'ECONOMIC_CONTRACT' (Test-Path (Join-Path $Root 'inverse-commerce\ECONOMIC_LOOP_V1.json')) 'economic loop contract exists'
Check 'PAYMENT_CONTRACT' (Test-Path (Join-Path $Root 'inverse-commerce\payment.config.example.json')) 'approval-gated payment contract exists'
Check 'NO_PUBLIC_PAYMENT_URL_IN_EXAMPLE' ((Get-Content (Join-Path $Root 'inverse-commerce\payment.config.example.json') -Raw) -match '"payment_link_url"\s*:\s*null') 'example does not fabricate a payment URL'
Check 'PROOF_DIR' ((New-Item -ItemType Directory -Force -Path $ProofRoot).Exists) 'proof directory available'

$latest = Get-ChildItem -LiteralPath $ProofRoot -Filter 'WANTED-HUNT-PROOF-*.json' -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
Check 'LATEST_PROOF' ($null -ne $latest) 'a live proof artifact exists' 

$pass = @($checks | Where-Object status -eq 'FAIL').Count -eq 0
$report = [ordered]@{schema='inverse-commerce-health-v1';timestamp=[DateTime]::UtcNow.ToString('o');status=$(if($pass){'PASS'}else{'FAIL'});checks=$checks}
$proofFile = Join-Path $ProofRoot ('INVERSE-COMMERCE-HEALTH-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.json')
$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $proofFile -Encoding UTF8
$report | ConvertTo-Json -Depth 8
Write-Host ('PROOF_FILE=' + $proofFile)
if (-not $pass) { exit 1 }
