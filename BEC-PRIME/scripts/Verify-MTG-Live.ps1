#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$BaseUrl = 'https://dreamledger.org',
    [string]$ExpectedCommit = ''
)

$ErrorActionPreference = 'Stop'
$base = $BaseUrl.TrimEnd('/')
$checks = New-Object System.Collections.ArrayList
$script:FailureCount = 0

function Add-Check {
    param([string]$Id, [bool]$Pass, [string]$Detail)
    [void]$script:checks.Add([ordered]@{
        id = $Id
        pass = [bool]$Pass
        detail = $Detail
    })
    if (-not $Pass) { $script:FailureCount++ }
}

function Get-Text {
    param([string]$Route)
    try {
        $response = Invoke-WebRequest -Uri ($script:Base + $Route) -UseBasicParsing -TimeoutSec 15 -MaximumRedirection 0
        $ok = $response.StatusCode -eq 200
        Add-Check -Id ('http_' + ($Route -replace '[^a-zA-Z0-9]+', '_')) -Pass $ok -Detail ($Route + ' returned HTTP ' + $response.StatusCode + '.')
        return [string]$response.Content
    } catch {
        $status = 'unavailable'
        try {
            if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
                $status = [string][int]$_.Exception.Response.StatusCode
            }
        } catch {}
        Add-Check -Id ('http_' + ($Route -replace '[^a-zA-Z0-9]+', '_')) -Pass $false -Detail ($Route + ' request failed (' + $status + '): ' + $_.Exception.Message)
        return $null
    }
}

function Get-Json {
    param([string]$Route)
    $body = Get-Text -Route $Route
    if ($null -eq $body) { return $null }
    try {
        return ($body | ConvertFrom-Json)
    } catch {
        Add-Check -Id ('json_' + ($Route -replace '[^a-zA-Z0-9]+', '_')) -Pass $false -Detail ('Invalid JSON at ' + $Route + ': ' + $_.Exception.Message)
        return $null
    }
}

function Is-PositiveInteger {
    param($Value)
    if ($null -eq $Value) { return $false }
    $number = 0.0
    if (-not [double]::TryParse([string]$Value, [ref]$number)) { return $false }
    return ($number -gt 0 -and $number -eq [math]::Truncate($number))
}

$driveRoot = 'D:\BrownEyeCortexData'
if (-not (Test-Path -LiteralPath 'D:\')) { $driveRoot = 'C:\BrownEyeCortexData' }
$proofDir = Join-Path $driveRoot 'PROOF\DreamLedgerMTG'
$logDir = Join-Path $driveRoot 'LOGS\DreamLedgerMTG'
New-Item -ItemType Directory -Force -Path $proofDir, $logDir | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$proofPath = Join-Path $proofDir ('MTG-LIVE-CONTRACT-' + $stamp + '.json')
$logPath = Join-Path $logDir ('MTG-LIVE-CONTRACT-' + $stamp + '.log')
$script:Base = $base

$page = Get-Text -Route '/mtg'
$pageSlash = Get-Text -Route '/mtg/'
foreach ($pair in @(@{ route = '/mtg'; body = $page }, @{ route = '/mtg/'; body = $pageSlash })) {
    $body = [string]$pair.body
    $isPage = $body -match 'name=["'']dreamledger-mtg-contract["'']\s+content=["'']v1["'']'
    Add-Check -Id ('page_marker_' + ($pair.route -replace '[^a-zA-Z0-9]+', '_')) -Pass $isPage -Detail ($pair.route + ' returned the canonical MTG catalogue page.')
    $noLoop = $body -notmatch 'http-equiv\s*=\s*["'']refresh["'']'
    Add-Check -Id ('page_no_loop_' + ($pair.route -replace '[^a-zA-Z0-9]+', '_')) -Pass $noLoop -Detail ($pair.route + ' does not return a meta-refresh redirect loop.')
    $heldNotice = $body.Contains('Commander Deck Diagnostic: currently held') -and
        (-not $body.Contains('/buy/COMMANDER-DECK-DIAGNOSTIC-001'))
    Add-Check -Id ('diagnostic_hold_notice_' + ($pair.route -replace '[^a-zA-Z0-9]+', '_')) -Pass $heldNotice -Detail ($pair.route + ' communicates that the diagnostic is held without a dead buy path.')
}

$health = Get-Json -Route '/healthz'
$healthPass = $null -ne $health -and $health.ok -eq $true -and $health.service -eq 'dreamledger-storefront'
Add-Check -Id 'health_contract' -Pass $healthPass -Detail 'The live storefront health endpoint reports ok=true and the expected service name.'

$version = Get-Json -Route '/version'
$liveCommit = ''
if ($null -ne $version) { $liveCommit = [string]$version.commit }
$commitPass = -not [string]::IsNullOrWhiteSpace($liveCommit) -and $liveCommit -ne 'unknown'
if (-not [string]::IsNullOrWhiteSpace($ExpectedCommit)) { $commitPass = $commitPass -and ($liveCommit -eq $ExpectedCommit) }
Add-Check -Id 'deployed_commit_identity' -Pass $commitPass -Detail ('Expected ' + $(if ($ExpectedCommit) { $ExpectedCommit } else { 'a non-unknown commit' }) + '; live ' + $(if ($liveCommit) { $liveCommit } else { '(missing)' }) + '.')

$published = Get-Json -Route '/api/products'
$aggregate = Get-Json -Route '/catalog.json'
$feed = Get-Json -Route '/data/mtg-catalog.json'
$robots = Get-Text -Route '/robots.txt'
$sitemap = Get-Text -Route '/sitemap.xml'

$diag = $null
if ($aggregate -and $aggregate.products) {
    $diag = @($aggregate.products | Where-Object { $_.id -eq 'COMMANDER-DECK-DIAGNOSTIC-001' } | Select-Object -First 1)
    if ($diag.Count -gt 0) { $diag = $diag[0] } else { $diag = $null }
}
$apiDiag = $null
if ($published -and $published.products) {
    $apiDiag = @($published.products | Where-Object { $_.id -eq 'COMMANDER-DECK-DIAGNOSTIC-001' } | Select-Object -First 1)
    if ($apiDiag.Count -gt 0) { $apiDiag = $apiDiag[0] } else { $apiDiag = $null }
}
$diagPass = $null -ne $diag -and $diag.status -eq 'held' -and
    $diag.checkout_available -eq $false -and
    [string]::IsNullOrWhiteSpace([string]$diag.checkout_url) -and
    $null -eq $apiDiag
Add-Check -Id 'diagnostic_live_hold' -Pass $diagPass -Detail 'The full live catalogue records the diagnostic as held and the published-product API does not offer it.'

$eligible = New-Object System.Collections.Generic.List[object]
$quarantined = New-Object System.Collections.Generic.List[object]
if ($feed -and $feed.products -and $aggregate -and $aggregate.products) {
    foreach ($item in @($feed.products)) {
        $id = [string]$item.id
        $matches = @($aggregate.products | Where-Object {
            $_.id -eq $id -and $_.silo -eq 'mtg' -and $_.status -eq 'published'
        })
        $reason = ''
        if ([string]::IsNullOrWhiteSpace($id)) {
            $reason = 'INVALID_PRODUCT_ID'
        } elseif ($matches.Count -ne 1) {
            $reason = if ($matches.Count -gt 1) { 'DUPLICATE_LIVE_ID' } else { 'NO_UNIQUE_PUBLISHED_MTG_MATCH' }
        } else {
            $live = $matches[0]
            if ($item.silo -ne 'mtg' -or $live.silo -ne 'mtg') {
                $reason = 'SILO_MISMATCH'
            } elseif ($item.status -ne 'published' -or $live.status -ne 'published') {
                $reason = 'STATUS_NOT_PUBLISHED'
            } elseif ($item.category -ne 'commander-deck' -and $id -notmatch '^EDH') {
                $reason = 'NOT_A_COMMANDER_DECK'
            } elseif ([string]$item.currency -notmatch '(?i)^nzd$' -or [string]$live.currency -notmatch '(?i)^nzd$') {
                $reason = 'CURRENCY_NOT_NZD'
            } elseif (-not (Is-PositiveInteger $item.inventory) -or -not (Is-PositiveInteger $live.inventory)) {
                $reason = 'STOCK_NOT_CONFIRMED_IN_BOTH_CATALOGUES'
            } elseif ([double]$item.price -le 0 -or [double]$item.price -ne [double]$live.price) {
                $reason = 'PRICE_MISMATCH'
            } else {
                $manual = $item.checkout_available -eq $false -and $live.checkout_available -eq $false -and
                    [string]::IsNullOrWhiteSpace([string]$item.checkout_url) -and
                    [string]::IsNullOrWhiteSpace([string]$live.checkout_url) -and
                    $item.sale_mode -eq 'claim_by_message'
                $online = $item.checkout_available -eq $true -and $live.checkout_available -eq $true -and
                    $item.checkout_approved -eq $true -and
                    $live.commercial_truth.approval_required -eq $false -and
                    (-not [string]::IsNullOrWhiteSpace([string]$item.checkout_url)) -and
                    ([string]$item.checkout_url -eq [string]$live.checkout_url) -and
                    ([string]$item.checkout_url -match '^https://buy\.stripe\.com/[A-Za-z0-9]+')
                if (-not $manual -and -not $online) {
                    $reason = 'SALE_MODE_NOT_EXPLICITLY_ALLOWED'
                } else {
                    $mode = if ($online) { 'approved_online_checkout' } else { 'manual_enquiry' }
                    $eligible.Add([ordered]@{
                        id = $id
                        price_nzd = [double]$item.price
                        inventory = [math]::Min([int]$item.inventory, [int]$live.inventory)
                        mode = $mode
                        checkout_available = [bool]$online
                    })
                }
            }
        }
        if ($reason) { $quarantined.Add([ordered]@{ id = $id; reason = $reason }) }
    }
}
$eligibleIds = @($eligible | ForEach-Object { [string]$_.id })
$eligiblePass = (($eligibleIds -join ',') -eq 'EDH_QUINTORIUS_0002,EDH_DWYNEN_0003') -and $eligible.Count -eq 2
Add-Check -Id 'live_catalogue_reconciles' -Pass $eligiblePass -Detail ('Listings eligible after two-source reconciliation: ' + ($eligibleIds -join ', '))

$knownConflictPass = ($eligibleIds -notcontains 'EDH_0001') -and
    ($eligibleIds -notcontains 'EDH_JON_IRENICUS_0004') -and
    (@($quarantined | Where-Object { $_.id -eq 'EDH_0001' }).Count -gt 0) -and
    (@($quarantined | Where-Object { $_.id -eq 'EDH_JON_IRENICUS_0004' }).Count -gt 0)
Add-Check -Id 'live_catalogue_conflicts_hidden' -Pass $knownConflictPass -Detail 'Known ID and price conflicts remain quarantined from the live storefront.'

$reportStatus = if ($script:FailureCount -eq 0) { 'PASS_LIVE_ROUTE_AND_HOLD_CONTRACT' } else { 'FAIL_LIVE_ROUTE_AND_HOLD_CONTRACT' }
$productionStatus = if ($script:FailureCount -eq 0) { 'VERIFIED_ROUTE_AND_HOLD_STATE' } else { 'NOT_VERIFIED' }
$expectedCommitValue = if ($ExpectedCommit) { $ExpectedCommit } else { $null }
$liveCommitValue = if ($liveCommit) { $liveCommit } else { $null }
$timestamp = (Get-Date).ToUniversalTime().ToString('o')
$report = [ordered]@{
    schema = 'DREAMLEDGER-MTG-PUBLIC-CONTRACT/v1'
    status = $reportStatus
    production_status = $productionStatus
    timestamp_utc = $timestamp
    base_url = $base
    expected_commit = $expectedCommitValue
    live_commit = $liveCommitValue
    verified_external_revenue_nzd = 0.0
    checkout_created = $false
    production_mutated = $false
    eligible_listings = @($eligible)
    quarantined_listings = @($quarantined)
    check_count = $checks.Count
    pass_count = @($checks | Where-Object { $_.pass }).Count
    fail_count = $script:FailureCount
    checks = @($checks)
}
$report | ConvertTo-Json -Depth 15 | Set-Content -LiteralPath $proofPath -Encoding UTF8
$log = New-Object System.Collections.Generic.List[string]
$log.Add('DreamLedger live MTG contract verification')
$log.Add('timestamp_utc=' + $timestamp)
$log.Add('base_url=' + $base)
$log.Add('expected_commit=' + $ExpectedCommit)
$log.Add('live_commit=' + $liveCommit)
foreach ($check in $checks) {
    $prefix = if ($check.pass) { 'PASS ' } else { 'FAIL ' }
    $line = $prefix + $check.id + ' :: ' + $check.detail
    $log.Add($line)
    Write-Host $line
}
$log.Add('status=' + $reportStatus)
$log.Add('proof=' + $proofPath)
$log.Add('verified_external_revenue_nzd=0.00')
$log | Set-Content -LiteralPath $logPath -Encoding ASCII
Write-Host ('MTG_LIVE_STATUS=' + $reportStatus)
Write-Host ('PROOF_FILE=' + $proofPath)
Write-Host ('LOG_FILE=' + $logPath)
Write-Host 'VERIFIED_EXTERNAL_REVENUE_NZD=0.00'
if ($script:FailureCount -gt 0) { exit 1 }
