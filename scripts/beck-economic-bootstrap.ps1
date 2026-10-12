#Requires -Version 5.1
[CmdletBinding()]
param(
    [string]$RepoRoot = "",
    [string]$ProofPath = "",
    [switch]$SkipInstall
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Economic validation, not a model-startup check. Read-only by default:
# no Supabase writes, no customer messages, no purchases, no deployments.
if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}
if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot 'package.json'))) {
    throw "BLOCKED: package.json not found under RepoRoot=$RepoRoot"
}
$RepoRoot = (Resolve-Path $RepoRoot).Path
if ([string]::IsNullOrWhiteSpace($ProofPath)) {
    $ProofRoot = if (Test-Path 'D:\') { 'D:\BrownEyeCortex\Runtime\proofs' } else { Join-Path $HOME 'BrownEyeCortex\Runtime\proofs' }
    $ProofPath = Join-Path $ProofRoot 'BECK-ECONOMIC-VALIDATION-LATEST.json'
}
$null = New-Item -ItemType Directory -Force -Path (Split-Path -Parent $ProofPath)
$checks = [System.Collections.Generic.List[object]]::new()
function Add-Check([string]$Name, [string]$Status, [string]$Detail) {
    $checks.Add([ordered]@{ name=$Name; status=$Status; detail=$Detail })
}
function Run-NodeCheck([string]$Name, [string[]]$Arguments) {
    $output = & node.exe @Arguments 2>&1
    $code = $LASTEXITCODE
    $detail = (($output | ForEach-Object { [string]$_ }) -join "`n")
    Add-Check $Name $(if ($code -eq 0) {'PASS'} else {'FAIL'}) $detail
    return $code
}
function Get-HttpResult([string]$Url) {
    try {
        $r = Invoke-WebRequest -Uri $Url -MaximumRedirection 8 -TimeoutSec 20 -UseBasicParsing
        $html = [string]$r.Content
        $stripeLinks = @([regex]::Matches($html, 'https://buy\.stripe\.com/[A-Za-z0-9]+') | ForEach-Object { $_.Value.TrimEnd('.') } | Select-Object -Unique)
        return [ordered]@{ url=$Url; status=[int]$r.StatusCode; final_url=[string]$r.BaseResponse.ResponseUri.AbsoluteUri; stripe_links=$stripeLinks }
    } catch {
        $status = 0
        try { if ($_.Exception.Response -and $_.Exception.Response.StatusCode) { $status=[int]$_.Exception.Response.StatusCode } } catch {}
        return [ordered]@{ url=$Url; status=$status; error=$_.Exception.Message; stripe_links=@() }
    }
}

$started = [DateTime]::UtcNow
$node = Get-Command node.exe -ErrorAction SilentlyContinue
$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $node -or -not $npm) { throw 'BLOCKED: Node.js 20+ and npm are required.' }
$nodeVersion = (& node.exe --version 2>&1 | Out-String).Trim()
if ($nodeVersion -notmatch '^v(\d+)\.') { throw "Could not parse Node version: $nodeVersion" }
if ([int]$Matches[1] -lt 20) { throw "BLOCKED: Node.js 20+ required; found $nodeVersion" }
Add-Check 'runtime.node' 'PASS' $nodeVersion

Push-Location $RepoRoot
try {
    if (-not $SkipInstall) {
        $installOut = & npm.cmd ci --no-audit --no-fund 2>&1
        $installCode = $LASTEXITCODE
        Add-Check 'dependencies.npm_ci' $(if ($installCode -eq 0) {'PASS'} else {'FAIL'}) (($installOut | ForEach-Object {[string]$_}) -join "`n")
    } else {
        Add-Check 'dependencies.npm_ci' 'SKIPPED' 'Operator supplied -SkipInstall; existing node_modules assumed.'
    }

    if ((@($checks | Where-Object { $_.name -eq 'dependencies.npm_ci' -and $_.status -eq 'FAIL' })).Count -eq 0) {
        $offer = @()
        $catalogPath = Join-Path $RepoRoot 'BEC-PRIME/catalog/offers/approved.json'
        if (Test-Path -LiteralPath $catalogPath) {
            $catalog = Get-Content -LiteralPath $catalogPath -Raw | ConvertFrom-Json
            $offer = @($catalog.approved | Where-Object { $_.offer_id -eq 'OFFER-DREAMLEDGER-BILLBOARD-FOUNDING-001' })
            if ($offer.Count -eq 1 -and [decimal]$offer[0].price -eq 50 -and $offer[0].currency -eq 'NZD' -and $offer[0].payment_link_status -eq 'ACTIVE_LIVEMODE' -and $offer[0].payment_link_url -match '^https://buy\.stripe\.com/') {
                Add-Check 'offer.canonical_catalog' 'PASS' 'Found one NZ$50 NZD Billboard offer with a declared live-mode Stripe URL. This is catalog evidence, not live Stripe verification.'
                $offerUrl = [string]$offer[0].payment_link_url
            } else {
                Add-Check 'offer.canonical_catalog' 'FAIL' 'Expected exactly one OFFER-DREAMLEDGER-BILLBOARD-FOUNDING-001 at NZ$50 NZD with a declared Stripe URL.'
                $offerUrl = ''
            }
        } else {
            Add-Check 'offer.canonical_catalog' 'FAIL' "Missing $catalogPath"
            $offerUrl = ''
        }

        $commands = @(
            @{name='monetization.asset_traversal'; args=@('ops/commerce/beck-monetization-scout.mjs')},
            @{name='contract.commercial_cell'; args=@('BEC-PRIME/scripts/verify-commercial-cell.js')},
            @{name='contract.execution_gate_tests'; args=@('--test','BEC-PRIME/runtime/ExecutionGate.test.js')},
            @{name='contract.cube_swarm_definition'; args=@('BEC-PRIME/scripts/verify-cube-swarm-definition.js')}
        )
        foreach ($c in $commands) { $null = Run-NodeCheck $c.name $c.args }

        $scoutProof = Join-Path $RepoRoot 'proof/commerce/latest-monetization-scout.json'
        if (Test-Path -LiteralPath $scoutProof) {
            $scout = Get-Content -LiteralPath $scoutProof -Raw | ConvertFrom-Json
            Add-Check 'monetization.recommendation' 'OBSERVED' (($scout.recommended_first_dollar_path | ConvertTo-Json -Compress) + '; inspect ranked_candidates and blockers in ' + $scoutProof)
        } else {
            Add-Check 'monetization.recommendation' 'FAIL' 'Monetization scout did not create its proof report.'
        }

        $publicUrls = @(
            'https://dreamledger.org/agent-delivery-proof-audit.html',
            'https://dreamledger.org/billboard.html',
            'https://dreamledger.org/buy/COMMANDER-DECK-DIAGNOSTIC-001',
            'https://dreamledger.org/quote-comparison/'
        )
        $livePages = @{}
        foreach ($url in $publicUrls) {
            $r = Get-HttpResult $url
            $livePages[$url] = $r
            Add-Check ('public_page.' + ([uri]$url).AbsolutePath.Trim('/').Replace('/','_')) $(if ($r.status -ge 200 -and $r.status -lt 400) {'PASS'} else {'FAIL'}) ($r | ConvertTo-Json -Compress)
        }

        # Compare the actual public CTA with canonical repository contracts.
        # This catches live-page/catalog drift, not just reachable URLs.
        $proofFeedPath = Join-Path $RepoRoot 'public/agent-products.json'
        if (Test-Path -LiteralPath $proofFeedPath) {
            $productFeed = Get-Content -LiteralPath $proofFeedPath -Raw | ConvertFrom-Json
            $proofProduct = @($productFeed | Where-Object { $_.item_id -eq 'AGENT-PROOF-AUDIT-49' })
            if ($proofProduct.Count -eq 1) {
                $proofPage = $livePages['https://dreamledger.org/agent-delivery-proof-audit.html']
                $expectedProofLink = [string]$proofProduct[0].checkout_url
                $found = @($proofPage.stripe_links | Where-Object { $_ -eq $expectedProofLink }).Count -gt 0
                Add-Check 'commercial.cta_parity.proof_audit' $(if ($proofPage.status -ge 200 -and $proofPage.status -lt 400 -and $found) {'PASS'} else {'FAIL'}) ("Expected CTA=" + $expectedProofLink + '; observed Stripe links=' + (@($proofPage.stripe_links) -join ', '))
            } else {
                Add-Check 'commercial.cta_parity.proof_audit' 'FAIL' 'Expected exactly one AGENT-PROOF-AUDIT-49 in public/agent-products.json.'
            }
        }

        if ($offer.Count -eq 1) {
            $billboardPage = $livePages['https://dreamledger.org/billboard.html']
            $expectedBillboardLink = [string]$offer[0].payment_link_url
            $billboardFound = @($billboardPage.stripe_links | Where-Object { $_ -eq $expectedBillboardLink }).Count -gt 0
            Add-Check 'commercial.cta_parity.billboard' $(if ($billboardPage.status -ge 200 -and $billboardPage.status -lt 400 -and $billboardFound) {'PASS'} else {'FAIL'}) ("Catalog CTA=" + $expectedBillboardLink + '; observed Stripe links=' + (@($billboardPage.stripe_links) -join ', '))
        }
        if ($offerUrl) {
            $r = Get-HttpResult $offerUrl
            Add-Check 'checkout.offer_url_reachable' $(if ($r.status -ge 200 -and $r.status -lt 400) {'PASS'} else {'FAIL'}) (($r | ConvertTo-Json -Compress) + '; link reachability does not prove price, livemode account ownership, payment settlement, or fulfillment.')
        }

        if ($env:STRIPE_SECRET_KEY -and $env:STRIPE_LIVE_ENABLED -eq 'true') {
            $stripeCode = Run-NodeCheck 'stripe.live_reconciliation' @('ops/commerce/reconcile-approved-offers.mjs')
            $reconPath = Join-Path $RepoRoot 'proof/commerce/latest-approved-offer-reconciliation.json'
            if ($stripeCode -eq 0 -and (Test-Path -LiteralPath $reconPath)) {
                $recon = Get-Content -LiteralPath $reconPath -Raw | ConvertFrom-Json
                $settled = @($recon.offers | Where-Object { $_.state -eq 'SETTLED_PENDING_FULFILLMENT' })
                if ($settled.Count -gt 0) {
                    Add-Check 'stripe.settled_payment_evidence' 'OBSERVED_PENDING_FULFILLMENT' ("Matched live paid Checkout Session(s): " + (($settled | ForEach-Object { $_.offer_id + ':' + $_.matched_paid_sessions.Count }) -join ', '))
                } else {
                    Add-Check 'stripe.settled_payment_evidence' 'NOT_OBSERVED' 'No paid live Checkout Session matched the approved offer and exact price/currency.'
                }
            }
        } else {
            Add-Check 'stripe.live_reconciliation' 'BLOCKED' 'Set STRIPE_SECRET_KEY in the local process environment and STRIPE_LIVE_ENABLED=true to query live Stripe. Never paste the key into chat. No Stripe API call was made.'
        }
    }
} finally {
    Pop-Location
}


# Supabase is a fulfillment dependency for the canonical Billboard offer.
# This is an unauthenticated gateway probe only, never a DB-health claim.
$sbUrl = if ($env:SUPABASE_URL) { $env:SUPABASE_URL.TrimEnd('/') } else { 'https://wbwgroygjeyukkspnqiy.supabase.co' }
$sbProbe = Get-HttpResult ($sbUrl + '/rest/v1/')
if ($sbProbe.status -eq 0 -or $sbProbe.status -ge 500) {
    Add-Check 'fulfillment.supabase_gateway' 'BLOCKED' (($sbProbe | ConvertTo-Json -Compress) + '; Supabase gateway unreachable or server error. Automated fulfillment must not be claimed.')
} elseif ($sbProbe.status -in @(401,403)) {
    Add-Check 'fulfillment.supabase_gateway' 'UNVERIFIED' (($sbProbe | ConvertTo-Json -Compress) + '; gateway responds but authenticated database/RPC health is unproven.')
} else {
    Add-Check 'fulfillment.supabase_gateway' 'UNVERIFIED' (($sbProbe | ConvertTo-Json -Compress) + '; HTTP response is not proof of database/RPC health or successful fulfillment.')
}
Add-Check 'fulfillment.end_to_end' 'UNVERIFIED' 'No safe synthetic paid-order-to-delivery test has been executed by this read-only bootstrap. Require correlated live payment, order attribution, fulfilled artifact, and delivery evidence before claiming revenue.'

$hardFails = @($checks | Where-Object { $_.status -eq 'FAIL' }).Count
$blocked = @($checks | Where-Object { $_.status -eq 'BLOCKED' }).Count
$settledEvidence = @($checks | Where-Object { $_.name -eq 'stripe.settled_payment_evidence' -and $_.status -eq 'OBSERVED_PENDING_FULFILLMENT' }).Count -gt 0
$fulfillmentUnverified = @($checks | Where-Object { $_.name -eq 'fulfillment.end_to_end' -and $_.status -ne 'PASS' }).Count -gt 0
$status = if ($hardFails -gt 0) {'FAIL'} elseif ($blocked -gt 0 -or $fulfillmentUnverified) {'BLOCKED_ECONOMIC_PATH_NOT_PROVEN'} else {'STATIC_AND_PUBLIC_CHECKS_PASS_NOT_REVENUE'}
$proof = [ordered]@{
    schema = 'BECK-ECONOMIC-VALIDATION/v1'
    status = $status
    generated_at_utc = [DateTime]::UtcNow.ToString('o')
    elapsed_seconds = [math]::Round(([DateTime]::UtcNow - $started).TotalSeconds, 2)
    repository = $RepoRoot
    checks = @($checks)
    scoreboard = [ordered]@{
        verified_revenue_nzd = 0.00
        settled_payment_evidence_observed = $settledEvidence
        fulfillment_verified = $false
        independent_buyer_verified = $false
        revenue_state = 'UNVERIFIED_UNTIL_PAYMENT_ATTRIBUTION_AND_FULFILLMENT_ARE_PROVEN'
    }
    safety = @(
        'Read-only validation: no customer outreach, no purchase, no deployment, no Supabase writes.',
        'A reachable checkout URL is not proof of a valid price or settled payment.',
        'A settled payment is not verified revenue until correct attribution, fulfillment, and delivery evidence are verified.',
        'The script never prints STRIPE_SECRET_KEY.'
    )
}
$tmp = "$ProofPath.tmp"
$proof | ConvertTo-Json -Depth 16 | Set-Content -LiteralPath $tmp -Encoding UTF8
Move-Item -LiteralPath $tmp -Destination $ProofPath -Force
$proof | ConvertTo-Json -Depth 16
Write-Host "`nECONOMIC_VALIDATION=$status"
Write-Host "PROOF=$ProofPath"
if ($hardFails -gt 0) { exit 1 }
if ($blocked -gt 0 -or $fulfillmentUnverified) { exit 2 }
exit 0
