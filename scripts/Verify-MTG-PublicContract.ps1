#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'
$checks = New-Object System.Collections.ArrayList
$script:FailureCount = 0
$eligible = New-Object System.Collections.Generic.List[object]
$quarantined = New-Object System.Collections.Generic.List[object]

function Add-Check {
    param(
        [string]$Id,
        [bool]$Pass,
        [string]$Detail
    )
    $item = [ordered]@{
        id = $Id
        pass = [bool]$Pass
        detail = $Detail
    }
    [void]$script:checks.Add($item)
    if (-not $Pass) {
        $script:FailureCount++
    }
}

function Read-JsonFile {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Required file missing: $Path"
    }
    return (Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json)
}

function Is-PositiveInteger {
    param($Value)
    if ($null -eq $Value) { return $false }
    $number = 0.0
    if (-not [double]::TryParse([string]$Value, [ref]$number)) { return $false }
    return ($number -gt 0 -and $number -eq [math]::Truncate($number))
}

function Is-Blank {
    param($Value)
    return [string]::IsNullOrWhiteSpace([string]$Value)
}

$root = (Resolve-Path -LiteralPath $RepoRoot).Path
$serverPath = Join-Path $root 'public\server.js'
$pagePath = Join-Path $root 'public\mtg\index.html'
$feedPath = Join-Path $root 'public\data\mtg-catalog.json'
$aggregatePath = Join-Path $root 'public\catalog.json'
$diagnosticPath = Join-Path $root 'BEC-PRIME\catalog\products\COMMANDER-DECK-DIAGNOSTIC-001.json'
$timestamp = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
$driveRoot = 'D:\BrownEyeCortexData'
if (-not (Test-Path -LiteralPath 'D:\')) {
    $driveRoot = 'C:\BrownEyeCortexData'
}
$proofDir = Join-Path $driveRoot 'PROOF\DreamLedgerMTG'
$logDir = Join-Path $driveRoot 'LOGS\DreamLedgerMTG'
New-Item -ItemType Directory -Force -Path $proofDir, $logDir | Out-Null
$proofPath = Join-Path $proofDir ('MTG-PUBLIC-CONTRACT-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.json')
$logPath = Join-Path $logDir ('MTG-PUBLIC-CONTRACT-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
$logLines = New-Object System.Collections.Generic.List[string]
$logLines.Add('DreamLedger MTG source contract verification')
$logLines.Add('timestamp_utc=' + $timestamp)
$logLines.Add('repo_root=' + $root)
$logLines.Add('production_probe=NOT_RUN')
$logLines.Add('verified_external_revenue_nzd=0.00')

try {
    $server = Get-Content -LiteralPath $serverPath -Raw
    $page = Get-Content -LiteralPath $pagePath -Raw
    $feed = Read-JsonFile -Path $feedPath
    $aggregate = Read-JsonFile -Path $aggregatePath
    $diagnostic = Read-JsonFile -Path $diagnosticPath
    $publicDiagnostic = @($aggregate.products | Where-Object { $_.id -eq 'COMMANDER-DECK-DIAGNOSTIC-001' } | Select-Object -First 1)
    if ($publicDiagnostic.Count -gt 0) {
        $publicDiagnostic = $publicDiagnostic[0]
    } else {
        $publicDiagnostic = $null
    }

    $routePass = $server.Contains("'/mtg':'mtg/index.html'") -and
        $server.Contains("'/mtg/':'mtg/index.html'") -and
        $server.Contains("'/mtg.html':'mtg/index.html'") -and
        (Test-Path -LiteralPath $pagePath -PathType Leaf) -and
        ($page -notmatch 'http-equiv\s*=\s*["'']refresh["'']')
    Add-Check -Id 'mtg_route_without_redirect_loop' -Pass $routePass -Detail 'The three MTG aliases serve public/mtg/index.html and that page has no meta refresh loop.'

    $versionPass = $server.Contains("commit:COMMIT")
    Add-Check -Id 'production_version_has_commit_identity' -Pass $versionPass -Detail 'The read-only /version endpoint includes the deployed commit.'

    $markerPass = $page -match 'name=["'']dreamledger-mtg-contract["'']\s+content=["'']v1["'']'
    Add-Check -Id 'mtg_catalogue_marker' -Pass $markerPass -Detail 'The MTG page carries the v1 route-contract marker.'

    $failClosedPass = $page.Contains("fetch('/data/mtg-catalog.json'") -and
        $page.Contains("fetch('/api/products'") -and
        $page.Contains('Catalogue sources could not be reconciled') -and
        $page.Contains("grid.innerHTML=''")
    Add-Check -Id 'two_catalogue_read_fail_closed' -Pass $failClosedPass -Detail 'Listings require both catalogues; missing or inconsistent data hides cards.'

    $diagPagePass = (-not $page.Contains('/buy/COMMANDER-DECK-DIAGNOSTIC-001')) -and
        ($page -notmatch 'https://buy\.stripe\.com/') -and
        $page.Contains('Commander Deck Diagnostic: currently held')
    Add-Check -Id 'diagnostic_not_advertised_for_payment' -Pass $diagPagePass -Detail 'The MTG page says the diagnostic is held and has no direct diagnostic checkout link.'

    $canonicalPass = $diagnostic.status -eq 'held' -and
        [int]$diagnostic.inventory -eq 0 -and
        $diagnostic.checkout.mode -eq 'disabled' -and
        $null -eq $diagnostic.checkout.url -and
        $diagnostic.commercial_truth.approval_required -eq $true -and
        $diagnostic.commercial_truth.sellable -eq $false
    Add-Check -Id 'canonical_diagnostic_remains_held' -Pass $canonicalPass -Detail 'Canonical diagnostic is held, inventory zero, checkout disabled, and approval required.'

    $publicDiagPass = $null -ne $publicDiagnostic -and
        $publicDiagnostic.status -eq 'held' -and
        $publicDiagnostic.checkout_available -eq $false -and
        (Is-Blank $publicDiagnostic.checkout_url)
    Add-Check -Id 'public_diagnostic_remains_non_purchasable' -Pass $publicDiagPass -Detail 'The public aggregate catalogue keeps the diagnostic held without a checkout URL.'

    $eligible = New-Object System.Collections.Generic.List[object]
    $quarantined = New-Object System.Collections.Generic.List[object]
    $liveProducts = @($aggregate.products)
    foreach ($item in @($feed.products)) {
        $id = [string]$item.id
        $matches = @($liveProducts | Where-Object {
            $_.id -eq $id -and $_.silo -eq 'mtg' -and $_.status -eq 'published'
        })
        $reason = ''
        $live = $null

        if ([string]::IsNullOrWhiteSpace($id)) {
            $reason = 'INVALID_PRODUCT_ID'
        } elseif ($matches.Count -ne 1) {
            if ($matches.Count -gt 1) { $reason = 'DUPLICATE_LIVE_ID' }
            else { $reason = 'NO_UNIQUE_PUBLISHED_MTG_MATCH' }
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
                $manual = $item.checkout_available -eq $false -and
                    $live.checkout_available -eq $false -and
                    (Is-Blank $item.checkout_url) -and
                    (Is-Blank $live.checkout_url) -and
                    $item.sale_mode -eq 'claim_by_message'
                $online = $item.checkout_available -eq $true -and
                    $live.checkout_available -eq $true -and
                    $item.checkout_approved -eq $true -and
                    $live.commercial_truth.approval_required -eq $false -and
                    (-not (Is-Blank $item.checkout_url)) -and
                    ([string]$item.checkout_url -eq [string]$live.checkout_url) -and
                    ([string]$item.checkout_url -match '^https://buy\.stripe\.com/[A-Za-z0-9]+')
                if (-not $manual -and -not $online) {
                    $reason = 'SALE_MODE_NOT_EXPLICITLY_ALLOWED'
                } else {
                    $mode = if ($online) { 'approved_online_checkout' } else { 'manual_enquiry' }
                    $eligible.Add([ordered]@{
                        id = $id
                        name = [string]$(if ($live.name) { $live.name } else { $item.name })
                        price_nzd = [double]$item.price
                        inventory = [math]::Min([int]$item.inventory, [int]$live.inventory)
                        mode = $mode
                        checkout_available = [bool]$online
                    })
                }
            }
        }
        if ($reason) {
            $quarantined.Add([ordered]@{ id = $id; reason = $reason })
        }
    }

    $eligibleIds = @($eligible | ForEach-Object { [string]$_.id })
    $expectedIds = @('EDH_QUINTORIUS_0002', 'EDH_DWYNEN_0003')
    $eligiblePass = (($eligibleIds -join ',') -eq ($expectedIds -join ',')) -and $eligible.Count -eq 2
    Add-Check -Id 'two_source_inventory_reconciles' -Pass $eligiblePass -Detail ('Eligible matched listings: ' + ($eligibleIds -join ', '))

    $quarantinedIds = @($quarantined | ForEach-Object { [string]$_.id })
    $conflictPass = ($eligibleIds -notcontains 'EDH_0001') -and
        ($eligibleIds -notcontains 'EDH_JON_IRENICUS_0004') -and
        ($quarantinedIds -contains 'EDH_0001') -and
        ($quarantinedIds -contains 'EDH_JON_IRENICUS_0004')
    Add-Check -Id 'known_conflicts_are_quarantined' -Pass $conflictPass -Detail 'The EDH_0001 identity/price conflict and Jon Irenicus NZ$90/NZ$220 price mismatch stay hidden.'

    $noOnline = @($eligible | Where-Object { $_.checkout_available -eq $true }).Count -eq 0
    Add-Check -Id 'no_unapproved_online_checkout' -Pass $noOnline -Detail 'No MTG item currently passes the explicit dual-catalogue checkout approval rule.'
} catch {
    Add-Check -Id 'source_read_and_parse' -Pass $false -Detail $_.Exception.Message
}

$passCount = @($checks | Where-Object { $_.pass -eq $true }).Count
$status = if ($script:FailureCount -eq 0 -and $checks.Count -ge 9) {
    'PASS_SOURCE_CONTRACT_ONLY'
} else {
    'FAIL_SOURCE_CONTRACT'
}
$commit = 'unknown'
try {
    $git = Get-Command git -ErrorAction SilentlyContinue
    if ($git) {
        $value = & git -C $root rev-parse HEAD 2>$null
        if ($LASTEXITCODE -eq 0 -and $value) { $commit = [string]$value }
    }
} catch {
    $commit = 'unknown'
}
$hashes = [ordered]@{}
foreach ($relative in @(
    'public/server.js',
    'public/mtg/index.html',
    'public/data/mtg-catalog.json',
    'public/catalog.json',
    'BEC-PRIME/catalog/products/COMMANDER-DECK-DIAGNOSTIC-001.json'
)) {
    $target = Join-Path $root $relative
    if (Test-Path -LiteralPath $target -PathType Leaf) {
        $hashes[$relative] = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
    }
}
$report = [ordered]@{
    schema = 'DREAMLEDGER-MTG-PUBLIC-CONTRACT/v1'
    status = $status
    production_status = 'NOT_PROBED'
    timestamp_utc = $timestamp
    repository = 'KelpCoin/DreamLedger'
    local_commit = $commit
    repo_root = $root
    verified_external_revenue_nzd = 0.0
    checkout_created = $false
    production_mutated = $false
    candidate_silos_changed = 0
    eligible_listings = @($eligible)
    quarantined_listings = @($quarantined)
    file_sha256 = $hashes
    check_count = $checks.Count
    pass_count = $passCount
    fail_count = $script:FailureCount
    checks = @($checks)
}
$report | ConvertTo-Json -Depth 15 | Set-Content -LiteralPath $proofPath -Encoding UTF8
foreach ($item in $checks) {
    $prefix = if ($item.pass) { 'PASS ' } else { 'FAIL ' }
    $line = $prefix + $item.id + ' :: ' + $item.detail
    $logLines.Add($line)
    Write-Host $line
}
$logLines.Add('status=' + $status)
$logLines.Add('proof=' + $proofPath)
$logLines.Add('verified_external_revenue_nzd=0.00')
$logLines | Set-Content -LiteralPath $logPath -Encoding ASCII

Write-Host ('MTG_CONTRACT_STATUS=' + $status)
Write-Host ('PROOF_FILE=' + $proofPath)
Write-Host ('LOG_FILE=' + $logPath)
Write-Host 'PRODUCTION_STATUS=NOT_PROBED'
Write-Host 'VERIFIED_EXTERNAL_REVENUE_NZD=0.00'
if ($status -ne 'PASS_SOURCE_CONTRACT_ONLY') { exit 1 }
