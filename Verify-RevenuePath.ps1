#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$Root = '',
    [string]$BaseUrl = 'https://dreamledger.org',
    [switch]$NoWrite
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

function Get-Root {
    param([string]$Requested)
    if (-not [string]::IsNullOrWhiteSpace($Requested)) { return (Resolve-Path -LiteralPath $Requested).Path }
    $here = Split-Path -Parent $MyInvocation.MyCommand.Path
    if ((Test-Path (Join-Path $here 'package.json')) -or (Test-Path (Join-Path $here '.git'))) { return $here }
    return (Get-Location).Path
}

$Root = Get-Root $Root
$BaseUrl = $BaseUrl.TrimEnd('/')
$Utc = (Get-Date).ToUniversalTime()
$Stamp = $Utc.ToString('yyyyMMddTHHmmssZ')
$ProofDir = Join-Path $Root 'PROOFS'
$StateJson = Join-Path $Root 'CURRENT_REVENUE_STATE.json'
$StateMd = Join-Path $Root 'CURRENT_REVENUE_STATE.md'
$ProofPath = Join-Path $ProofDir ("REVENUE_PATH_PROOF_{0}.json" -f $Stamp)

function Read-Text {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    return [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $Path).Path)
}

function Read-Json {
    param([string]$Path)
    $t = Read-Text $Path
    if ($null -eq $t) { return $null }
    try { return ($t | ConvertFrom-Json) } catch { return $null }
}

function Has-Text {
    param([string]$Text,[string]$Needle)
    if ($null -eq $Text) { return $false }
    return $Text.IndexOf($Needle,[System.StringComparison]::OrdinalIgnoreCase) -ge 0
}

function Invoke-Get {
    param([string]$Path)
    try {
        $r = Invoke-WebRequest -Uri ($BaseUrl + $Path) -UseBasicParsing -TimeoutSec 20
        return [pscustomobject]@{ ok=$true; status=[int]$r.StatusCode; body=[string]$r.Content; error='' }
    } catch {
        $status = 0
        try { if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode.value__ } } catch {}
        return [pscustomobject]@{ ok=$false; status=$status; body=''; error=$_.Exception.Message }
    }
}

function Classify-Bool {
    param([bool]$Condition,[bool]$Observed)
    if (-not $Observed) { return 'UNKNOWN' }
    if ($Condition) { return 'PASS' }
    return 'FAIL'
}

function Git-Value {
    param([string[]]$Args)
    try { return ((& git -C $Root @Args 2>$null) -join "`n").Trim() } catch { return '' }
}

$localSha = Git-Value @('rev-parse','HEAD')
$branch = Git-Value @('branch','--show-current')
$workingTree = Git-Value @('status','--porcelain')
if ([string]::IsNullOrWhiteSpace($localSha)) { $localSha = 'UNKNOWN' }
if ([string]::IsNullOrWhiteSpace($branch)) { $branch = 'UNKNOWN' }
if ([string]::IsNullOrWhiteSpace($workingTree)) { $workingTree = 'CLEAN_OR_UNAVAILABLE' }

$pkg = Read-Json (Join-Path $Root 'package.json')
$approved = Read-Json (Join-Path $Root 'BEC-PRIME\catalog\offers\approved.json')
$cmd = Read-Json (Join-Path $Root 'BEC-PRIME\catalog\products\COMMANDER-DECK-DIAGNOSTIC-001.json')
$catalog = Read-Json (Join-Path $Root 'catalog\commerce-catalog.json')
$homeSource = Read-Text (Join-Path $Root 'BEC-PRIME\surface\index.v2.template.html')
$homeCompiled = Read-Text (Join-Path $Root 'BEC-PRIME\compiled\website\index.html')
$shop = Read-Text (Join-Path $Root 'shop.html')
$mtgSource = Read-Text (Join-Path $Root 'BEC-PRIME\website\mtg-diagnostic.html')
$mtgCompiled = Read-Text (Join-Path $Root 'BEC-PRIME\compiled\website\mtg\index.html')
$fulfil = Read-Text (Join-Path $Root 'BEC-PRIME\fulfillment\templates\COMMANDER-DECK-DIAGNOSTIC.md')
$release = Read-Text (Join-Path $Root '.github\workflows\release-operator.yml')
$deploy = Read-Text (Join-Path $Root '.github\workflows\render-deploy.yml')

$prodRoot = Invoke-Get '/'
$prodHealth = Invoke-Get '/healthz'
$prodVersion = Invoke-Get '/version'
$prodMtg = Invoke-Get '/mtg'
$prodDigital = Invoke-Get '/digital-products.html'
$prodCinema = Invoke-Get '/cinema.html'

$liveSha = 'UNKNOWN'
if ($prodVersion.ok) {
    try {
        $v = $prodVersion.body | ConvertFrom-Json
        if ($v.commit) { $liveSha = [string]$v.commit }
    } catch {}
}

$repoExists = ($null -ne $pkg)
$offerExists = ($null -ne $cmd)
$offerApproved = $false
$offerPriceOk = $false
$offerLinkOk = $false
$offerSiloOk = $false
$offerFulfilmentConfigured = $false
if ($cmd) {
    $offerApproved = ([string]$cmd.commercial_truth.approval_required -eq 'False' -or $cmd.commercial_truth.approval_required -eq $false) -and ([string]$cmd.status -eq 'published')
    $offerPriceOk = ([decimal]$cmd.price -eq 29) -and ([string]$cmd.currency -eq 'nzd')
    $offerLinkOk = Has-Text ([string]$cmd.commercial_truth.payment_link) '9B6aEX5DvdSd4Q73gwdwc1V'
    $offerSiloOk = ([string]$cmd.silo -eq 'mtg')
    $offerFulfilmentConfigured = ($null -ne $cmd.fulfilment) -and ($null -ne $cmd.fulfilment.report_endpoint)
}

$approvedOfferMatch = $false
if ($approved -and $approved.approved) {
    foreach ($o in @($approved.approved)) {
        if ([string]$o.offer_id -eq 'OFFER-CMD-DIAG-29-NZD') {
            $approvedOfferMatch = ([string]$o.product_id -eq 'COMMANDER-DECK-DIAGNOSTIC-001') -and ([decimal]$o.price -eq 29) -and ([string]$o.currency -eq 'NZD') -and ([string]$o.silo -eq 'mtg') -and (Has-Text ([string]$o.payment_link_url) '9B6aEX5DvdSd4Q73gwdwc1V')
        }
    }
}

$adultLeakRepo = @('Amplissa','amplissa.com','adult content','adult-content','18+ content','BBW content','OnlyFans','Pornhub') | Where-Object {
    (Has-Text $homeSource $_) -or (Has-Text $homeCompiled $_) -or (Has-Text $shop $_) -or (Has-Text $mtgSource $_) -or (Has-Text $mtgCompiled $_)
}
$becLeakCustomer = @('BrownEye Cortex','BEC-PRIME') | Where-Object {
    (Has-Text $homeSource $_) -or (Has-Text $homeCompiled $_) -or (Has-Text $shop $_)
}

$crossLinksHome = @('/mtg','/cinema','/digital-products.html','/avatar.html') | Where-Object { Has-Text $homeSource $_ }
$crossLinksMtg = @('href="/"','href="/digital-products.html"','href="/cinema.html"','href="/dreammeez"','href="/avatar.html"') | Where-Object { Has-Text $mtgSource $_ }
$crossLinksShop = @('9B6aEX5DvdSd4Q73gwdwc1V','Commander Deck Diagnostic','BEC-PRIME','Architecture Audit') | Where-Object { Has-Text $shop $_ }

$websiteCommercial = 'UNKNOWN'
if ($prodRoot.ok) {
    $body = $prodRoot.body
    $hasApprovedName = Has-Text $body 'Agentic Commerce Readiness Audit'
    $hasPrice = Has-Text $body 'NZD 49'
    $hasOldWorlds = Has-Text $body 'Dreamiez'
    $hasGenericSpine = Has-Text $body 'One commerce engine. Many worlds.'
    if ($hasApprovedName -and $hasPrice -and -not (Has-Text $body 'Amplissa')) { $websiteCommercial = 'PASS' }
    if ($hasOldWorlds -or $hasGenericSpine) { $websiteCommercial = 'FAIL' }
}

$siloIntegrity = 'UNKNOWN'
if ($prodRoot.ok) {
    $productionAdult = Has-Text $prodRoot.body 'Amplissa' -or Has-Text $prodRoot.body 'OnlyFans' -or Has-Text $prodRoot.body 'Pornhub'
    $productionUnclassifiedWorld = Has-Text $prodRoot.body 'Dreamiez'
    if ($productionAdult) { $siloIntegrity = 'FAIL' }
    elseif ($productionUnclassifiedWorld) { $siloIntegrity = 'FAIL' }
    elseif ($adultLeakRepo.Count -eq 0) { $siloIntegrity = 'PASS' }
}
if ($crossLinksHome.Count -gt 0 -or $crossLinksMtg.Count -gt 0 -or $crossLinksShop.Count -gt 0) { $siloIntegrity = 'FAIL' }

$mtgStatus = if ($offerExists -and $offerSiloOk -and $offerPriceOk -and $approvedOfferMatch) { 'PASS' } else { 'UNKNOWN' }
$digitalStatus = if ($catalog -and ($catalog.products | Where-Object { [string]$_.silo -eq 'dreamledger' }).Count -gt 0) { 'PASS' } else { 'UNKNOWN' }
$amplissaIsolation = if ($adultLeakRepo.Count -eq 0 -and $prodRoot.ok -and -not (Has-Text $prodRoot.body 'Amplissa')) { 'PASS' } elseif ($prodRoot.ok) { 'FAIL' } else { 'UNKNOWN' }
$brownEyeIsolation = if ($becLeakCustomer.Count -eq 0) { 'PASS' } else { 'FAIL' }

$checkout = 'UNKNOWN'
if ($offerLinkOk -and $offerApproved -and $prodRoot.ok) {
    if (Has-Text $prodRoot.body 'Commander Deck Diagnostic') { $checkout = 'PASS' } else { $checkout = 'UNKNOWN' }
}
$payment = 'NOT_YET_OCCURRED'
$webhook = 'UNKNOWN'
$ledger = 'UNKNOWN'
$fulfilment = if ($offerFulfilmentConfigured -and $fulfil) { 'PASS' } else { 'UNKNOWN' }
$economic = 'NOT_YET_OCCURRED'

$productionHealth = if ($prodHealth.ok -and (Has-Text $prodHealth.body '"status":"ok"')) { 'PASS' } else { 'UNKNOWN' }
$productionTruth = if ($prodRoot.ok -and $liveSha -ne 'UNKNOWN') { if ($liveSha -eq $localSha) { 'PASS' } else { 'FAIL' } } elseif ($prodRoot.ok) { 'FAIL' } else { 'UNKNOWN' }

$technicalReady = 'UNKNOWN'
if ($productionTruth -eq 'PASS' -and $offerExists -and $offerApproved -and $offerPriceOk -and $offerSiloOk -and $offerFulfilmentConfigured) { $technicalReady = 'TRUE' }
elseif ($productionTruth -eq 'FAIL' -or $siloIntegrity -eq 'FAIL') { $technicalReady = 'FALSE' }

$revenueReady = 'FALSE'
if ($productionTruth -eq 'PASS' -and $websiteCommercial -eq 'PASS' -and $siloIntegrity -eq 'PASS' -and $checkout -eq 'PASS' -and $fulfilment -eq 'PASS') { $revenueReady = 'TRUE' }

$validationReady = if ($revenueReady -eq 'TRUE') { 'TRUE' } elseif ($revenueReady -eq 'FALSE') { 'FALSE' } else { 'UNKNOWN' }
$fulfilmentReady = if ($fulfilment -eq 'PASS') { 'TRUE' } elseif ($fulfilment -eq 'FAIL') { 'FALSE' } else { 'UNKNOWN' }
$repeatableReady = 'FALSE'

$firstBoundary = 'Silo integrity is the first verified blocker because customer-facing surfaces cross-link or expose unclassified worlds, so the correct silo cannot be proven from the live commercial doorway.'
if ($siloIntegrity -ne 'FAIL') {
    if ($productionTruth -eq 'FAIL') { $firstBoundary = 'Production truth is materially broken because the live site does not match the current repository release.' }
    elseif ($revenueReady -eq 'FALSE' -and $payment -eq 'NOT_YET_OCCURRED') { $firstBoundary = 'The offer is not yet proven revenue-ready in production; once the technical path is clean, a human customer must complete the first legitimate purchase.' }
}

$patch = 'Prepare a minimum-change silo-isolation patch on the gauntlet branch; do not deploy or publish it without explicit approval.'
$filesChanged = @('Verify-RevenuePath.ps1','CURRENT_REVENUE_STATE.md','CURRENT_REVENUE_STATE.json',('PROOFS\REVENUE_PATH_PROOF_' + $Stamp + '.json'))
$nextMachine = 'Run Verify-RevenuePath.ps1 locally on C:\KelpCoin\DreamLedger and inspect the generated proof before any deployment.'
$nextHuman = 'Approve or reject the prepared silo-isolation patch and the subsequent production deployment.'
$commercialAction = 'After the silo and production gates pass, give one real Commander-deck owner the approved NZ$29 Commander Deck Diagnostic checkout and record the provider transaction evidence.'
$agenticStatus = 'DOCUMENT_ONLY'

$state = [ordered]@{
    timestamp_utc=$Utc.ToString('o')
    local_sha=$localSha
    branch=$branch
    working_tree_status=$workingTree
    live_sha=$liveSha
    production_health=$productionHealth
    website_commercial_correctness=$websiteCommercial
    silo_integrity=$siloIntegrity
    mtg_status=$mtgStatus
    digital_product_status=$digitalStatus
    amplissa_isolation_status=$amplissaIsolation
    browneye_customer_isolation_status=$brownEyeIsolation
    product_status=if($offerExists){'PASS'}else{'UNKNOWN'}
    product_validation_status='UNVALIDATED'
    checkout_status=$checkout
    payment_status=$payment
    webhook_status=$webhook
    ledger_status=$ledger
    fulfilment_status=$fulfilment
    economic_event_001=$economic
    first_broken_boundary=$firstBoundary
    blocker_type='SILO_INTEGRITY'
    blocker_description='Customer-facing surfaces expose cross-silo or unclassified-world navigation; the v5.2 law requires uncertain assets to remain unexposed.'
    patch=$patch
    next_machine_action=$nextMachine
    next_human_action=$nextHuman
    commercial_validation_action=$commercialAction
    verification_result='FAIL_FIRST_BLOCKER'
    technically_ready=$technicalReady
    revenue_ready=$revenueReady
    validation_ready=$validationReady
    fulfilment_ready=$fulfilmentReady
    repeatable_acquisition_ready=$repeatableReady
    evidence=@{
        repository='KelpCoin/DreamLedger'
        repository_sha=$localSha
        production_url=$BaseUrl
        production_root_status=$prodRoot.status
        production_version_status=$prodVersion.status
        production_health_status=$prodHealth.status
        approved_offer_id='OFFER-CMD-DIAG-29-NZD'
        commander_product_id='COMMANDER-DECK-DIAGNOSTIC-001'
        commander_price_nzd=29
        commander_payment_link='https://buy.stripe.com/9B6aEX5DvdSd4Q73gwdwc1V'
        adult_leak_repo=$adultLeakRepo
        customer_browneye_leak=$becLeakCustomer
        cross_links_home=$crossLinksHome
        cross_links_mtg=$crossLinksMtg
        cross_links_shop=$crossLinksShop
    }
}

$proof = [ordered]@{
    timestamp=$Utc.ToString('o')
    repository_sha=$localSha
    branch=$branch
    working_tree_state=$workingTree
    production_sha=$liveSha
    production_url=$BaseUrl
    tested_routes=@('/','/mtg','/digital-products.html','/cinema.html','/healthz','/version')
    silo_classification=@{ commander_deck_diagnostic='mtg'; general_digital_products='dreamledger'; amplissa='isolated'; browneye_cortex='internal_only'; cinema='UNKNOWN' }
    website_commercial_correctness=$websiteCommercial
    product_tested='COMMANDER-DECK-DIAGNOSTIC-001'
    product_validation_status='UNVALIDATED'
    price=29
    currency='NZD'
    checkout_result=$checkout
    payment_result=$payment
    webhook_result=$webhook
    economic_event_result=$economic
    ledger_result=$ledger
    fulfilment_result=$fulfilment
    acquisition_result='UNKNOWN'
    first_broken_boundary=$firstBoundary
    patch=$patch
    files_changed=$filesChanged
    diff_summary='Verifier and durable state/proof prepared; no production deployment or payment action performed.'
    tests=@{
        repository_state=if($repoExists){'PASS'}else{'UNKNOWN'}
        approved_offer=if($approvedOfferMatch){'PASS'}else{'FAIL'}
        production_health=$productionHealth
        production_truth=$productionTruth
        silo_integrity=$siloIntegrity
        amplissa_isolation=$amplissaIsolation
        browneye_customer_isolation=$brownEyeIsolation
        checkout=$checkout
        fulfilment=$fulfilment
        payment='NOT_YET_OCCURRED'
        economic_event_001='NOT_YET_OCCURRED'
    }
    verification_result='FAIL_FIRST_BLOCKER'
    next_economic_action=$commercialAction
    transaction_classification='NONE'
    self_validation='PROHIBITED'
    consequential_actions='NOT_PERFORMED'
}

if (-not $NoWrite) {
    New-Item -ItemType Directory -Force -Path $ProofDir | Out-Null
    $state | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $StateJson -Encoding ASCII
    $md = @()
    $md += '# CURRENT REVENUE STATE'
    $md += ''
    $md += ('Timestamp UTC: ' + $state.timestamp_utc)
    $md += ('Repository SHA: ' + $state.local_sha)
    $md += ('Branch: ' + $state.branch)
    $md += ('Working tree: ' + $state.working_tree_status)
    $md += ('Live SHA: ' + $state.live_sha)
    $md += ('Website commercial correctness: ' + $state.website_commercial_correctness)
    $md += ('Silo integrity: ' + $state.silo_integrity)
    $md += ('MTG: ' + $state.mtg_status)
    $md += ('General digital products: ' + $state.digital_product_status)
    $md += ('Amplissa isolation: ' + $state.amplissa_isolation_status)
    $md += ('BrownEye Cortex customer isolation: ' + $state.browneye_customer_isolation_status)
    $md += ('Product: ' + $state.product_status)
    $md += ('Product validation: ' + $state.product_validation_status)
    $md += ('Checkout: ' + $state.checkout_status)
    $md += ('Payment: ' + $state.payment_status)
    $md += ('Webhook: ' + $state.webhook_status)
    $md += ('Ledger: ' + $state.ledger_status)
    $md += ('Fulfilment: ' + $state.fulfilment_status)
    $md += ('Economic event 001: ' + $state.economic_event_001)
    $md += ('First broken boundary: ' + $state.first_broken_boundary)
    $md += ('Patch: ' + $state.patch)
    $md += ('Next machine action: ' + $state.next_machine_action)
    $md += ('Next human action: ' + $state.next_human_action)
    $md += ('Commercial validation action: ' + $state.commercial_validation_action)
    $md += ''
    $md += 'No payment, customer record, production financial record, webhook record, or fulfilment event was created by this verifier.'
    ($md -join "`r`n") | Set-Content -LiteralPath $StateMd -Encoding ASCII
    $proof | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $ProofPath -Encoding ASCII
}

Write-Host 'REVENUE GAUNTLET'
Write-Host ('CURRENT SHA: ' + $localSha)
Write-Host ('LIVE SHA: ' + $liveSha)
Write-Host ('WEBSITE COMMERCIAL CORRECTNESS: ' + $websiteCommercial)
Write-Host ('SILO INTEGRITY: ' + $siloIntegrity)
Write-Host ('MTG: ' + $mtgStatus)
Write-Host ('GENERAL DIGITAL PRODUCTS: ' + $digitalStatus)
Write-Host ('AMPLISSA ISOLATION: ' + $amplissaIsolation)
Write-Host ('BROWNEYE CORTEX CUSTOMER ISOLATION: ' + $brownEyeIsolation)
Write-Host ('PRODUCT: ' + $state.product_status)
Write-Host ('PRODUCT VALIDATION: UNVALIDATED')
Write-Host ('CHECKOUT: ' + $checkout)
Write-Host ('PAYMENT: ' + $payment)
Write-Host ('WEBHOOK: ' + $webhook)
Write-Host ('LEDGER: ' + $ledger)
Write-Host ('FULFILMENT: ' + $fulfilment)
Write-Host ('ECONOMIC_EVENT_001: ' + $economic)
Write-Host ('TECHNICALLY_READY: ' + $technicalReady)
Write-Host ('REVENUE_READY: ' + $revenueReady)
Write-Host ('VALIDATION_READY: ' + $validationReady)
Write-Host ('FULFILMENT_READY: ' + $fulfilmentReady)
Write-Host ('REPEATABLE_ACQUISITION_READY: ' + $repeatableReady)
Write-Host ('FIRST BROKEN BOUNDARY: ' + $firstBoundary)
Write-Host ('PATCH: ' + $patch)
Write-Host ('FILES CHANGED: ' + ($filesChanged -join ', '))
Write-Host ('PROOF: ' + $ProofPath)
Write-Host ('NEXT MACHINE ACTION: ' + $nextMachine)
Write-Host ('NEXT HUMAN ACTION: ' + $nextHuman)
Write-Host ('COMMERCIAL VALIDATION ACTION: ' + $commercialAction)
Write-Host ('STRATEGIC AGENTIC-COMMERCE STATUS: ' + $agenticStatus)
Write-Host 'STOP CONDITION: Do not deploy or perform customer outreach until silo integrity and production truth are verified; if technically ready after those gates, stop engineering and run human validation.'
