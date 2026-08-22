#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$RepoRoot = (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)),
    [string]$BaseUrl = 'https://dreamledger.org',
    [string]$ProofPath = 'D:\BrownEyeCortex\BEC-PRIME\RUN-PROOFS\GAUNTLET\DREAMLEDGER-GAUNTLET-LATEST.json'
)

$ErrorActionPreference = 'Stop'
$started = Get-Date
$checks = @()
function Add-Check {
    param([string]$Id,[bool]$Pass,[string]$Message)
    $script:checks += [ordered]@{ id=$Id; status=if($Pass){'PASS'}else{'FAIL'}; message=$Message }
    if (-not $Pass) { throw "$Id: $Message" }
}

$bec = Join-Path $RepoRoot 'BEC-PRIME'
$gauntlet = Join-Path $bec 'gauntlet\GauntletV6.js'
$approvedPath = Join-Path $bec 'catalog\offers\approved.json'
$checkoutPath = Join-Path $RepoRoot 'api\stripe-link.ts'

try {
    Add-Check 'files.gauntlet' (Test-Path $gauntlet) 'GauntletV6.js exists'
    Add-Check 'files.approved' (Test-Path $approvedPath) 'Approved offer catalog exists'
    Add-Check 'files.checkout' (Test-Path $checkoutPath) 'Stripe checkout function exists'

    $approved = Get-Content -Raw $approvedPath | ConvertFrom-Json
    $audit = @($approved.approved | Where-Object { $_.offer_id -eq 'OFFER-BEC-PRIME-ARCHITECTURE-AUDIT' }) | Select-Object -First 1
    Add-Check 'offer.approved' ($null -ne $audit) 'Architecture audit is explicitly approved'
    Add-Check 'offer.price' ([int]$audit.price -eq 49) 'Approved price is NZD 49'
    Add-Check 'offer.currency' ([string]$audit.currency -eq 'NZD') 'Approved currency is NZD'
    Add-Check 'offer.live' ([string]$audit.payment_link_status -eq 'ACTIVE_LIVEMODE') 'Payment link is marked ACTIVE_LIVEMODE'
    Add-Check 'offer.link' ([string]$audit.payment_link_url -like 'https://buy.stripe.com/*') 'Approved payment link is a Stripe checkout link'

    $checkoutText = Get-Content -Raw $checkoutPath
    Add-Check 'checkout.amount' ($checkoutText -match 'amount_nzd_cents:\s*4900') 'Server-side architecture audit amount is NZD 49'
    Add-Check 'checkout.silo' ($checkoutText -match "silo:\s*'commerce'") 'Architecture audit is in commerce silo'

    $node = Get-Command node -ErrorAction SilentlyContinue
    Add-Check 'runtime.node' ($null -ne $node) 'Node.js is available'
    Push-Location $bec
    try {
        $gauntletOutput = & node -e "const g=require('./gauntlet/GauntletV6.js'); const r=g.run({writeProof:false}); console.log(JSON.stringify(r)); if(r.status!=='PASS') process.exit(2);" 2>&1
        Add-Check 'gauntlet.v6' ($LASTEXITCODE -eq 0) 'GauntletV6 returned PASS'
    } finally {
        Pop-Location
    }

    $live = Invoke-WebRequest -Uri $BaseUrl -UseBasicParsing -TimeoutSec 20
    Add-Check 'live.frontdoor' ([int]$live.StatusCode -eq 200) 'DreamLedger front door returns HTTP 200'
    Add-Check 'live.offer' ($live.Content -match 'Agentic Commerce Readiness Audit') 'Live front door exposes approved audit'
    Add-Check 'live.price' ($live.Content -match 'NZD 49') 'Live front door shows NZD 49'

    $status = 'PASS'
    $economicTruth = [ordered]@{
        payment_link = 'VERIFIED_CONFIGURED'
        purchase_executed = $false
        payment_provider_event = $false
        sale_settled = $false
        economic_proof = $false
    }
} catch {
    $status = 'FAIL'
    $economicTruth = [ordered]@{
        payment_link = 'VERIFIED_CONFIGURED'
        purchase_executed = $false
        payment_provider_event = $false
        sale_settled = $false
        economic_proof = $false
    }
    $checks += [ordered]@{ id='gauntlet.exception'; status='FAIL'; message=$_.Exception.Message }
} finally {
    $proof = [ordered]@{
        schema_version = 'DREAMLEDGER-GAUNTLET-LOCAL-1'
        status = $status
        started_at_utc = $started.ToUniversalTime().ToString('o')
        finished_at_utc = (Get-Date).ToUniversalTime().ToString('o')
        base_url = $BaseUrl
        economic_truth = $economicTruth
        checks = $checks
        public_actions = 'approval-gated'
        financial_actions = 'approval-gated'
    }
    $parent = Split-Path -Parent $ProofPath
    if ($parent -and -not (Test-Path $parent)) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
    $proof | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $ProofPath -Encoding ASCII
}

Write-Host "GAUNTLET_STATUS=$status"
Write-Host "PROOF=$ProofPath"
Write-Host "ECONOMIC_PROOF=$($economicTruth.economic_proof)"
if ($status -ne 'PASS') { exit 1 }
exit 0
