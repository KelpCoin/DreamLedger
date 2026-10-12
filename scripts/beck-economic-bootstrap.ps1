#Requires -Version 5.1
[CmdletBinding()]
param(
    [string]$RepoRoot = "",
    [string]$ProofPath = "",
    [switch]$InstallDependencies,
    [switch]$SkipInstall
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Economic validation, not a model-startup check. Read-only by default:
# no Supabase writes, no customer messages, no purchases, no deployments.
# SkipInstall is retained as a legacy no-op because the existing base-branch CI workflow still passes it.
if ($InstallDependencies -and $SkipInstall) { throw 'Choose either -InstallDependencies or legacy -SkipInstall, not both.' }
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
        $truthRedirect = $html -match 'truth-oracle\.html'
        $retiredOfferCopy = $html -match 'AGENT-PROOF-AUDIT-49|Agent Delivery Proof Audit|NZ\$49|Purchase the audit'
        return [ordered]@{ url=$Url; status=[int]$r.StatusCode; final_url=[string]$r.BaseResponse.ResponseUri.AbsoluteUri; stripe_links=$stripeLinks; truth_oracle_redirect=[bool]$truthRedirect; retired_offer_copy=[bool]$retiredOfferCopy }
    } catch {
        $status = 0
        try { if ($_.Exception.Response -and $_.Exception.Response.StatusCode) { $status=[int]$_.Exception.Response.StatusCode } } catch {}
        return [ordered]@{ url=$Url; status=$status; error=$_.Exception.Message; stripe_links=@(); truth_oracle_redirect=$false; retired_offer_copy=$false }
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
        # Traverse the existing offer catalog and monetizable substrate before selecting work.
        $scoutCode = Run-NodeCheck 'substrate.monetization_traversal' @('ops/commerce/beck-monetization-scout.mjs')
        $scoutPath = Join-Path $RepoRoot 'proof/commerce/latest-monetization-scout.json'
        if ($scoutCode -eq 0 -and (Test-Path -LiteralPath $scoutPath)) {
            try {
                $scout = Get-Content -LiteralPath $scoutPath -Raw | ConvertFrom-Json
                $decision = $scout.monetization_decision
                Write-Host "`n=== EXISTING SUBSTRATE: MONETIZATION PRIORITY ===" -ForegroundColor Cyan
                Write-Host ("First path: " + $decision.first_path)
                Write-Host ("Reason: " + $decision.why)
                foreach ($asset in @($scout.substrate_inventory)) {
                    Write-Host ("- {0} | {1} | repo coverage {2}% | present files {3}/{4}" -f $asset.id,$asset.readiness,$asset.repository_coverage,$asset.present_files.Count,$asset.files.Count)
                }
                foreach ($blocker in @($scout.blockers)) {
                    Write-Host ("BLOCKER [{0}] {1}: {2}" -f $blocker.code,$blocker.offer,$blocker.detail) -ForegroundColor Yellow
                }
                Add-Check 'substrate.monetization_report' 'PASS' ("Read-only inventory generated. First path: " + $decision.first_path + ". This is a ranked candidate, not demand or revenue proof.")
            } catch {
                Add-Check 'substrate.monetization_report' 'FAIL' ("Scout report could not be parsed: " + $_.Exception.Message)
            }
        } else {
            Add-Check 'substrate.monetization_report' 'FAIL' 'Monetization scout failed or did not produce proof/commerce/latest-monetization-scout.json.'
        }
        $offer = @()
    if ($InstallDependencies -and -not $SkipInstall) {
        # This repository branch does not contain package-lock.json, so npm ci is invalid here.
        # Keep installation explicit; do not mutate dependencies as a surprise during preflight.
        $installOut = & npm.cmd install --no-package-lock --no-audit --no-fund 2>&1
        $installCode = $LASTEXITCODE
        Add-Check 'dependencies.npm_install' $(if ($installCode -eq 0) {'PASS'} else {'FAIL'}) (($installOut | ForEach-Object {[string]$_}) -join "`n")
    } else {
        Add-Check 'dependencies.npm_install' 'SKIPPED' 'Default is read-only preflight; dependency installation was not requested or was explicitly skipped.'
    }

    if ((@($checks | Where-Object { $_.name -eq 'dependencies.npm_install' -and $_.status -eq 'FAIL' })).Count -eq 0) {
        $productFeedPath = Join-Path $RepoRoot 'public/agent-products.json'
        if (Test-Path -LiteralPath $productFeedPath) {
            $productFeed = Get-Content -LiteralPath $productFeedPath -Raw | ConvertFrom-Json
            $offer = @($productFeed | Where-Object { $_.item_id -eq 'DREAMLEDGER-BILLBOARD-FOUNDING-001' })
            $retiredOffer = @($productFeed | Where-Object { $_.item_id -eq 'AGENT-PROOF-AUDIT-49' })
            if ($offer.Count -eq 1 -and [string]$offer[0].price -eq '50 NZD' -and [string]$offer[0].url -eq 'https://dreamledger.org/billboard.html' -and $offer[0].enable_checkout -eq $false -and $offer[0].availability -eq 'review_required' -and $retiredOffer.Count -eq 0) {
                Add-Check 'offer.canonical_catalog' 'PASS' 'Founding Billboard is the selected NZ$50 offer; public checkout remains held and the retired standalone audit SKU is absent. This is catalog evidence, not proof of fulfillment.'
                $offerUrl = ''
            } else {
                Add-Check 'offer.canonical_catalog' 'FAIL' 'Expected one DREAMLEDGER-BILLBOARD-FOUNDING-001 at NZ$50 on the Billboard page, checkout held, and zero retired standalone audit listings.'
                $offerUrl = ''
            }
        } else {
            Add-Check 'offer.canonical_catalog' 'FAIL' "Missing $productFeedPath"
            $offerUrl = ''
        }

        $commands = @(
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
            'https://dreamledger.org/truth-oracle.html',
            'https://dreamledger.org/agent-delivery-proof-audit.html',
            'https://dreamledger.org/billboard.html',
            'https://dreamledger.org/buy/COMMANDER-DECK-DIAGNOSTIC-001',
            'https://dreamledger.org/quote-comparison/'
        )
        $livePages = @{}
        foreach ($url in $publicUrls) {
            $r = Get-HttpResult $url
            $livePages[$url] = $r
            $pageName = 'public_page.' + ([uri]$url).AbsolutePath.Trim('/').Replace('/','_')
            if ($url -eq 'https://dreamledger.org/truth-oracle.html') {
                $ok = $r.status -ge 200 -and $r.status -lt 400 -and @($r.stripe_links).Count -eq 0 -and -not $r.retired_offer_copy
                Add-Check $pageName $(if ($ok) {'PASS'} else {'FAIL'}) (($r | ConvertTo-Json -Compress) + '; public Truth Oracle guide must remain free and contain no separate audit checkout.')
            } elseif ($url -eq 'https://dreamledger.org/agent-delivery-proof-audit.html') {
                $redirected = ([string]$r.final_url -match '/truth-oracle\.html/?$') -or ($r.truth_oracle_redirect -eq $true)
                $ok = $r.status -ge 200 -and $r.status -lt 400 -and $redirected -and @($r.stripe_links).Count -eq 0 -and -not $r.retired_offer_copy
                Add-Check $pageName $(if ($ok) {'PASS'} else {'FAIL'}) (($r | ConvertTo-Json -Compress) + '; retired route must redirect to Truth Oracle without an old offer or checkout.')
            } else {
                Add-Check $pageName 'DIAGNOSTIC_ONLY' (($r | ConvertTo-Json -Compress) + '; secondary candidate route, not a gate for the Truth Oracle path.')
            }
        }

        # Founding Billboard is the selected NZ$50 path; Truth Oracle remains the free destination for the retired audit.
        $proofFeedPath = Join-Path $RepoRoot 'public/agent-products.json'
        if (Test-Path -LiteralPath $proofFeedPath) {
            $productFeed = Get-Content -LiteralPath $proofFeedPath -Raw | ConvertFrom-Json
            $billboardProduct = @($productFeed | Where-Object { $_.item_id -eq 'DREAMLEDGER-BILLBOARD-FOUNDING-001' })
            $retiredProduct = @($productFeed | Where-Object { $_.item_id -eq 'AGENT-PROOF-AUDIT-49' })
            $billboardPage = $livePages['https://dreamledger.org/billboard.html']
            $truthPage = $livePages['https://dreamledger.org/truth-oracle.html']
            $legacyPage = $livePages['https://dreamledger.org/agent-delivery-proof-audit.html']
            $legacyRedirected = ([string]$legacyPage.final_url -match '/truth-oracle\.html/?$') -or ($legacyPage.truth_oracle_redirect -eq $true)
            $held = $billboardProduct.Count -eq 1 -and [string]$billboardProduct[0].price -eq '50 NZD' -and $billboardProduct[0].url -eq 'https://dreamledger.org/billboard.html' -and $billboardProduct[0].enable_checkout -eq $false -and $billboardProduct[0].availability -eq 'review_required'
            $ok = $billboardProduct.Count -eq 1 -and $retiredProduct.Count -eq 0 -and $held -and $billboardPage.status -ge 200 -and $billboardPage.status -lt 400 -and @($billboardPage.stripe_links).Count -eq 0 -and $truthPage.status -ge 200 -and $truthPage.status -lt 400 -and @($truthPage.stripe_links).Count -eq 0 -and $legacyPage.status -ge 200 -and $legacyPage.status -lt 400 -and $legacyRedirected -and @($legacyPage.stripe_links).Count -eq 0 -and -not $legacyPage.retired_offer_copy
            Add-Check 'commercial.billboard_offer_parity' $(if ($ok) {'PASS'} else {'FAIL'}) ('Billboard held=' + $held + '; retired catalog entries=' + $retiredProduct.Count + '; Truth Oracle legacy route redirected=' + $legacyRedirected + '; public checkout remains held until allocation and delivery proof.')
        }
        }
        if ($offerUrl) {
            $r = Get-HttpResult $offerUrl
            Add-Check 'checkout.offer_url_reachable' $(if ($r.status -ge 200 -and $r.status -lt 400) {'PASS'} else {'FAIL'}) (($r | ConvertTo-Json -Compress) + '; link reachability does not prove price, livemode account ownership, payment settlement, or fulfillment.')
        }

        if ($env:STRIPE_SECRET_KEY -and $env:STRIPE_LIVE_ENABLED -eq 'true') {
            $webhookCode = Run-NodeCheck 'stripe.webhook_routing_reconciliation' @('ops/commerce/reconcile-stripe-webhook-routing.mjs')
            $webhookPath = Join-Path $RepoRoot 'proof/commerce/latest-stripe-webhook-routing.json'
            if ($webhookCode -eq 0 -and (Test-Path -LiteralPath $webhookPath)) {
                $webhook = Get-Content -LiteralPath $webhookPath -Raw | ConvertFrom-Json
                Add-Check 'stripe.webhook_routing' 'BLOCKED' (("Configured endpoints=" + $webhook.endpoint_count + "; enabled live endpoints=" + $webhook.enabled_live_endpoint_count + "; unknown destinations=" + $webhook.unknown_enabled_live_targets.Count + "; duplicate event routes=" + $webhook.duplicate_event_routing.Count) + '. Inventory is read-only; canonical routing and successful delivery still require review.')
            } else {
                Add-Check 'stripe.webhook_routing' 'BLOCKED' 'Webhook endpoint inventory failed. No endpoint was created, changed, or disabled.'
            }
            $firstDollarCode = Run-NodeCheck 'stripe.first_dollar_offer_reconciliation' @('ops/commerce/reconcile-truth-oracle-access.mjs')
            $firstDollarPath = Join-Path $RepoRoot 'proof/commerce/latest-first-dollar-stripe-reconciliation.json'
            if ($firstDollarCode -eq 0 -and (Test-Path -LiteralPath $firstDollarPath)) {
                $firstDollar = Get-Content -LiteralPath $firstDollarPath -Raw | ConvertFrom-Json
                Add-Check 'offer.retired_offer_retirement' $(if ($firstDollar.retired_offer.retirement_verified -eq $true) {'PASS'} else {'FAIL'}) ('Retired standalone payment link active=' + $firstDollar.retired_offer.payment_link_active + '; product active=' + $firstDollar.retired_offer.product_active + '; price active=' + $firstDollar.retired_offer.price_active)
                Add-Check 'offer.billboard_checkout_hold' $(if ($firstDollar.retired_offer.billboard_checkout_hold_verified -eq $true) {'PASS'} else {'BLOCKED'}) ('Billboard Stripe payment link active=' + $firstDollar.retired_offer.billboard_payment_link_active + '; public checkout enabled=' + $firstDollar.offer.checkout_enabled_in_public_catalog)
                $paidCount = @($firstDollar.live_stripe.exact_paid_live_sessions).Count
                if ($firstDollar.live_stripe.exact_payment_link_found -ne $true) {
                    Add-Check 'stripe.first_dollar_payment_link' 'CONTRADICTED' 'Founding Billboard payment link was not found in this live Stripe account.'
                } elseif ($paidCount -gt 0) {
                    Add-Check 'stripe.first_dollar_settlement_evidence' 'OBSERVED_PENDING_FULFILLMENT' ("Exact-price paid Founding Billboard sessions: " + $paidCount + '. Fulfillment and independent buyer remain unverified.')
                } else {
                    Add-Check 'stripe.first_dollar_settlement_evidence' 'NOT_OBSERVED' 'No paid live Checkout Session matched the Founding Billboard link, NZD currency, NZ$50 amount, and livemode.'
                }
            }
            $stripeCode = Run-NodeCheck 'stripe.approved_offer_reconciliation' @('ops/commerce/reconcile-approved-offers.mjs')
            $reconPath = Join-Path $RepoRoot 'proof/commerce/latest-approved-offer-reconciliation.json'
            if ($stripeCode -eq 0 -and (Test-Path -LiteralPath $reconPath)) {
                $recon = Get-Content -LiteralPath $reconPath -Raw | ConvertFrom-Json
                $settled = @($recon.offers | Where-Object { $_.state -eq 'SETTLED_PENDING_FULFILLMENT' })
                Add-Check 'stripe.approved_offer_settlement_evidence' $(if ($settled.Count -gt 0) {'OBSERVED_PENDING_FULFILLMENT'} else {'NOT_OBSERVED'}) ("Matched paid sessions across approved catalog offers: " + (($settled | ForEach-Object { $_.offer_id + ':' + $_.matched_paid_sessions.Count }) -join ', '))
            }
        } else {
            Add-Check 'stripe.live_reconciliation' 'BLOCKED' 'Set STRIPE_SECRET_KEY in the local process environment and STRIPE_LIVE_ENABLED=true to query live Stripe. Never paste the key into chat. No Stripe API call was made.'
            Add-Check 'stripe.webhook_routing' 'BLOCKED' 'Webhook destinations were not inspected because live Stripe credentials were not enabled. No endpoint was changed.'
            Add-Check 'offer.retired_offer_retirement' 'BLOCKED' 'Live Stripe credentials not enabled; retired standalone payment link/product/price state cannot be verified.'
            Add-Check 'offer.billboard_checkout_hold' 'BLOCKED' 'Live Stripe credentials not enabled; Billboard Stripe/public checkout state cannot be reconciled.'
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

# Run the commercial Gauntlet only after every current-run commerce and fulfillment check exists.
# The validator is expected to exit 2 while real buyer/payment/fulfillment evidence is absent.
$interimDir = Join-Path $RepoRoot 'proof/commerce'
$null = New-Item -ItemType Directory -Path $interimDir -Force
$interimPath = Join-Path $interimDir 'latest-economic-validation.json'
$interim = [ordered]@{
    schema = 'BECK-ECONOMIC-VALIDATION/v1'
    generated_at_utc = [DateTime]::UtcNow.ToString('o')
    run_started_at_utc = $started.ToUniversalTime().ToString('o')
    checks = @($checks)
}
$interim | ConvertTo-Json -Depth 16 | Set-Content -LiteralPath $interimPath -Encoding UTF8
Push-Location $RepoRoot
try {
    $gauntletOutput = & node.exe 'ops/commerce/gauntlet-economic-verdict.mjs' 2>&1
    $gauntletCode = $LASTEXITCODE
} finally {
    Pop-Location
}
$gauntletPath = Join-Path $RepoRoot 'proof/commerce/latest-gauntlet-economic-verdict.json'
if (Test-Path -LiteralPath $gauntletPath) {
    $g = Get-Content -LiteralPath $gauntletPath -Raw | ConvertFrom-Json
    if ($g.schema -ne 'DREAMLEDGER-GAUNTLET-ECONOMIC-VERDICT/v1' -or -not $g.generated_at_utc) {
        Add-Check 'gauntlet.economic_verdict' 'FAIL' 'Gauntlet artifact schema or timestamp is invalid.'
    } elseif ($gauntletCode -eq 0 -and [string]$g.verdict -eq 'ELIGIBLE_FOR_SMALL_CONTROLLED_SCALE_NOT_A_WEALTH_GUARANTEE') {
        Add-Check 'gauntlet.economic_verdict' 'PASS' ("Commercial Gauntlet eligible verdict; score=" + $g.score_out_of_100 + '/100. See ' + $gauntletPath)
    } elseif ($gauntletCode -eq 2 -and [string]$g.verdict -in @('BLOCKED_PENDING_FIRST_PAID_ORDER_AND_FULFILLMENT_PROOF','PAYMENT_SIGNAL_ONLY_DO_NOT_SCALE_UNTIL_FULFILLMENT_AND_DEMAND_PASS')) {
        Add-Check 'gauntlet.economic_verdict' 'BLOCKED' ("Commercial Gauntlet ran and correctly withheld approval; verdict=" + $g.verdict + '; score=' + $g.score_out_of_100 + '/100. See ' + $gauntletPath)
    } else {
        Add-Check 'gauntlet.economic_verdict' 'FAIL' ("Unexpected Gauntlet exit/verdict combination: exit=" + $gauntletCode + '; verdict=' + $g.verdict + '; output=' + (($gauntletOutput | ForEach-Object { [string]$_ }) -join "`n"))
    }
} else {
    Add-Check 'gauntlet.economic_verdict' 'FAIL' ("Commercial Gauntlet did not produce its verdict artifact. " + (($gauntletOutput | ForEach-Object { [string]$_ }) -join "`n"))
}
# Preserve the complete current-run checks for the next inspection; this is not revenue proof.
$finalInterim = [ordered]@{
    schema = 'BECK-ECONOMIC-VALIDATION/v1'
    generated_at_utc = [DateTime]::UtcNow.ToString('o')
    run_started_at_utc = $started.ToUniversalTime().ToString('o')
    checks = @($checks)
}
$finalInterim | ConvertTo-Json -Depth 16 | Set-Content -LiteralPath $interimPath -Encoding UTF8


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
if ($blocked -gt 0 -or $fulfillmentUnverified) {
    # CI passes when the validator truthfully proves the system is BLOCKED; this is not a commerce PASS.
    # Keep local runs distinct so a person sees exit code 2 and can tell a dependency/proof gate remains open.
    if ($env:GITHUB_ACTIONS -eq 'true' -or $env:CI -eq 'true') {
        Write-Host 'CI_BLOCKED_VERDICT_ACCEPTED=true'
        exit 0