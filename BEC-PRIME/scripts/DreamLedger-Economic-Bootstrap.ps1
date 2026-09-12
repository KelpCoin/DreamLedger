[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [string]$ConfigPath = (Join-Path $PSScriptRoot '..\config\economic-supervisor.json'),
    [string]$EvidenceRoot = $null
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# This module is intentionally read-only against external systems.
# It discovers replaceable economic cells and existing Cortex capabilities.
# It does not publish, contact buyers, mutate Stripe, mutate Supabase, or deploy.

Set-Location $RepoRoot

$config = Get-Content $ConfigPath -Raw | ConvertFrom-Json

if (-not $EvidenceRoot) {
    if ($env:ECONOMIC_BOOTSTRAP_ROOT) {
        $EvidenceRoot = $env:ECONOMIC_BOOTSTRAP_ROOT
    } else {
        $EvidenceRoot = Join-Path $RepoRoot 'data\economic-bootstrap'
    }
}

$runId = 'BOOT-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + ([guid]::NewGuid().ToString('N').Substring(0,8))
$runDir = Join-Path $EvidenceRoot $runId
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

$warnings = New-Object System.Collections.ArrayList
$contradictions = New-Object System.Collections.ArrayList
$cells = New-Object System.Collections.ArrayList

function Write-Evidence([string]$Name, [object]$Data) {
    $path = Join-Path $runDir ($Name + '.json')
    $Data | ConvertTo-Json -Depth 30 | Set-Content -Path $path -Encoding UTF8
    return $path
}

function Warn([string]$Message) {
    [void]$warnings.Add(@{ timestamp=(Get-Date).ToUniversalTime().ToString('o'); message=$Message })
}

function Contradiction([string]$Component,[string]$Expected,[string]$Observed,[string]$EconomicEffect,[string]$RequiredFix) {
    [void]$contradictions.Add(@{
        severity='HIGH'
        component=$Component
        expected=$Expected
        observed=$Observed
        economic_effect=$EconomicEffect
        required_fix=$RequiredFix
    })
}

function SafeGet([string]$Uri,[hashtable]$Headers=@{},[int]$Timeout=20) {
    try {
        $r = Invoke-WebRequest -Uri $Uri -Method GET -Headers $Headers -TimeoutSec $Timeout -UseBasicParsing -ErrorAction Stop
        return @{ ok=$true; status=[int]$r.StatusCode; content=$r.Content }
    } catch {
        $status=$null
        if ($_.Exception.Response) { try { $status=[int]$_.Exception.Response.StatusCode } catch {} }
        return @{ ok=$false; status=$status; error=$_.Exception.Message }
    }
}

function SafeJson([string]$Uri,[hashtable]$Headers=@{},[int]$Timeout=20) {
    $r=SafeGet $Uri $Headers $Timeout
    if (-not $r.ok) { return $r }
    try { return @{ ok=$true; status=$r.status; data=($r.content | ConvertFrom-Json) } }
    catch { return @{ ok=$false; status=$r.status; error=('Invalid JSON: ' + $_.Exception.Message) } }
}

function FirstValue([object]$Object,[string[]]$Names) {
    foreach ($name in $Names) {
        if ($null -ne $Object -and $null -ne $Object.PSObject.Properties[$name]) {
            $v=$Object.PSObject.Properties[$name].Value
            if ($null -ne $v -and -not [string]::IsNullOrWhiteSpace([string]$v)) { return $v }
        }
    }
    return $null
}

function StripeMajor([decimal]$Amount,[string]$Currency) {
    $zero=@('bif','clp','djf','gnf','jpy','kmf','krw','mga','pyg','rwf','ugx','vnd','vuv','xaf','xof','xpf')
    if ($zero -contains $Currency.ToLowerInvariant()) { return [math]::Round($Amount,0) }
    return [math]::Round($Amount / 100,2)
}

function StripeGet([string]$Path) {
    if ([string]::IsNullOrWhiteSpace($env:STRIPE_SECRET_KEY)) { return @{ ok=$false; error='STRIPE_SECRET_KEY missing' } }
    $headers=@{ Authorization=('Bearer ' + $env:STRIPE_SECRET_KEY) }
    return SafeJson ('https://api.stripe.com/v1' + $Path) $headers 20
}

function StripePaged([string]$Path,[int]$MaxPages=100) {
    $items=New-Object System.Collections.ArrayList
    $after=$null
    for ($page=1; $page -le $MaxPages; $page++) {
        $q=if ($Path.Contains('?')) { '&limit=100' } else { '?limit=100' }
        if ($after) { $q += '&starting_after=' + [uri]::EscapeDataString($after) }
        $r=StripeGet ($Path+$q)
        if (-not $r.ok) { return @{ ok=$false; error=$r.error; items=$items; pages=$page } }
        foreach ($i in @($r.data.data)) { [void]$items.Add($i) }
        if (-not $r.data.has_more -or @($r.data.data).Count -eq 0) { return @{ ok=$true; items=$items; pages=$page } }
        $after=$r.data.data[@($r.data.data).Count-1].id
    }
    return @{ ok=$true; items=$items; pages=$MaxPages; truncated=$true }
}

# 1. Local and credential state
$health=@{
    schema='economic-health-1.0'
    bootstrap_version='2.1.0'
    run_id=$runId
    powershell=$PSVersionTable.PSVersion.ToString()
    stripe_configured=(-not [string]::IsNullOrWhiteSpace($env:STRIPE_SECRET_KEY))
    supabase_configured=(-not [string]::IsNullOrWhiteSpace($env:SUPABASE_URL)) -and ((-not [string]::IsNullOrWhiteSpace($env:SUPABASE_SECRET_KEY)) -or (-not [string]::IsNullOrWhiteSpace($env:SUPABASE_SERVICE_KEY)))
    agentbridge_configured=(-not [string]::IsNullOrWhiteSpace($env:AGENTBRIDGE_BASE_URL))
    side_effects='DISABLED'
    timestamp=(Get-Date).ToUniversalTime().ToString('o')
}
Write-Evidence '01_SYSTEM_HEALTH' $health | Out-Null

# 2. Public capability discovery
$capabilities=@()
foreach ($surface in @($config.surfaces)) {
    $url=$config.base_url.TrimEnd('/') + $surface.path
    $r=SafeGet $url
    $capabilities += @{
        id=$surface.id
        class=$surface.class
        path=$surface.path
        reachable=$r.ok
        status=$r.status
        error=$r.error
    }
}
Write-Evidence '02_CAPABILITIES' @{ schema='capability-state-1.0'; run_id=$runId; capabilities=$capabilities } | Out-Null

# 3. Canonical public offer discovery
$offerResponse=SafeJson ($config.base_url.TrimEnd('/') + '/api/offers')
$offers=@()
if ($offerResponse.ok) {
    $raw=$offerResponse.data
    if ($raw.PSObject.Properties['offers']) { $raw=$raw.offers }
    elseif ($raw.PSObject.Properties['data']) { $raw=$raw.data }
    foreach ($o in @($raw)) {
        $offers += @{
            offer_id=(FirstValue $o $config.cell_field_aliases.offer_id)
            sku=(FirstValue $o $config.cell_field_aliases.sku)
            name=(FirstValue $o $config.cell_field_aliases.name)
            price=(FirstValue $o $config.cell_field_aliases.price)
            currency=(FirstValue $o $config.cell_field_aliases.currency)
            checkout=(FirstValue $o $config.cell_field_aliases.checkout)
            public_path=(FirstValue $o $config.cell_field_aliases.public_path)
            fulfilment=(FirstValue $o $config.cell_field_aliases.fulfilment)
            approval_required=(FirstValue $o $config.cell_field_aliases.approval_required)
        }
    }
} else { Warn 'Public /api/offers could not be read.' }
Write-Evidence '03_OFFER_DISCOVERY' @{ schema='offer-discovery-1.0'; reachable=$offerResponse.ok; status=$offerResponse.status; offers=$offers } | Out-Null

# 4. Stripe inventory and payment-link reconciliation
$stripeLinks=@{}
if ($health.stripe_configured) {
    $links=StripePaged '/payment_links' 100
    if ($links.ok) {
        foreach ($link in @($links.items)) { $stripeLinks[$link.id]=$link }
    } else { Warn ('Stripe Payment Link enumeration failed: ' + $links.error) }
}

# 5. Economic cells are normalized from whatever inventory exists today.
foreach ($offer in $offers) {
    $cellId=if ($offer.offer_id) { [string]$offer.offer_id } elseif ($offer.sku) { [string]$offer.sku } else { [guid]::NewGuid().ToString('N') }
    $cell=@{
        schema='economic-cell-1.0'
        cell_id=$cellId
        offer_id=$offer.offer_id
        sku=$offer.sku
        name=$offer.name
        price=$offer.price
        currency=$offer.currency
        checkout=$offer.checkout
        public_path=$offer.public_path
        fulfilment=$offer.fulfilment
        approval_required=$offer.approval_required
        checks=@{ offer_discovered=$true; checkout_present=$false; stripe_resolved=$false; stripe_live=$false; active_checkout=$false; public_reachable=$null; fulfilment_declared=$false; currency_nzd=$null }
        contradictions=@()
        score=0
        readiness='NOT_READY'
    }

    if ($offer.checkout) {
        $cell.checks.checkout_present=$true
        $cell.score += 15
        $matching=$null
        foreach ($link in @($stripeLinks.Values)) {
            if ([string]$link.url -eq [string]$offer.checkout) { $matching=$link; break }
        }
        if ($matching) {
            $cell.checks.stripe_resolved=$true
            $cell.checks.stripe_live=[bool]$matching.livemode
            $cell.checks.active_checkout=[bool]$matching.active
            $cell.stripe=@{ id=$matching.id; url=$matching.url; active=$matching.active; livemode=$matching.livemode; metadata=$matching.metadata }
            if ($matching.active) { $cell.score += 25 }
            if ($matching.livemode) { $cell.score += 15 } else {
                Contradiction $cellId 'Live Stripe checkout' 'Payment Link is not live mode' 'Cannot use as production checkout' 'Replace with a live checkout.'
                $cell.contradictions += 'STRIPE_NOT_LIVE'
            }
        } elseif ([string]$offer.checkout -match '^https://buy\.stripe\.com/') {
            # Opaque buy URLs are still real checkout candidates, but the
            # supervisor refuses to claim Stripe object verification.
            $cell.checkout_classification='STRIPE_URL_PRESENT_OBJECT_UNVERIFIED'
            $cell.score += 10
        } else {
            Contradiction $cellId 'Resolvable checkout' 'Checkout reference did not match a discovered Stripe Payment Link' 'Buyer checkout may be broken or stale' 'Reconcile the offer checkout reference.'
            $cell.contradictions += 'CHECKOUT_UNRESOLVED'
        }
    }

    if ($offer.public_path) {
        $publicUrl=if ([string]$offer.public_path -match '^https?://') { [string]$offer.public_path } else { $config.base_url.TrimEnd('/') + '/' + ([string]$offer.public_path).TrimStart('/') }
        $pr=SafeGet $publicUrl
        $cell.checks.public_reachable=$pr.ok
        $cell.public_surface=@{ url=$publicUrl; reachable=$pr.ok; status=$pr.status }
        if ($pr.ok) { $cell.score += 10 }
    }

    if ($offer.fulfilment) { $cell.checks.fulfilment_declared=$true; $cell.score += 10 }
    if ($offer.currency) {
        $cell.checks.currency_nzd=([string]$offer.currency).ToUpperInvariant() -eq 'NZD'
        if ($cell.checks.currency_nzd) { $cell.score += 5 }
    }

    if ($cell.contradictions.Count -eq 0) { $cell.score += 10 }

    if ($cell.checks.stripe_resolved -and $cell.checks.stripe_live -and $cell.checks.active_checkout -and $cell.checks.fulfilment_declared -and $cell.contradictions.Count -eq 0) {
        $cell.readiness='READY_TO_SELL'
    } elseif ($cell.checks.stripe_resolved -and $cell.checks.stripe_live -and $cell.checks.active_checkout) {
        $cell.readiness='CHECKOUT_READY_FULFILMENT_UNVERIFIED'
    } elseif ($cell.checks.checkout_present) {
        $cell.readiness='CHECKOUT_PRESENT_UNVERIFIED'
    }

    [void]$cells.Add($cell)
}

# 6. Explicitly reconcile known surfaces without permanently binding the system to them.
$billboard=SafeGet ($config.base_url.TrimEnd('/') + '/billboard')
$billboardOffers=@($cells | Where-Object { ([string]$_.offer_id -match 'BILLBOARD') -or ([string]$_.sku -match 'BILLBOARD') })
$billboardState=@{
    page_reachable=$billboard.ok
    page_status=$billboard.status
    offer_discovered=$billboardOffers.Count -gt 0
    classification='UNVERIFIED'
}
if ($billboard.ok -and $billboardOffers.Count -eq 0) {
    $billboardState.classification='PAGE_REACHABLE_OFFER_NOT_IN_PUBLIC_REGISTRY'
    Contradiction 'BILLBOARD' 'Public page and canonical offer registry agree' '/billboard is reachable but Billboard is absent from /api/offers' 'Commercial discovery is inconsistent' 'Reconcile the existing offer mapping/deployment.'
} elseif ($billboard.ok) { $billboardState.classification='SURFACE_AND_OFFER_DISCOVERED' }
else { $billboardState.classification='PAGE_UNREACHABLE' }
Write-Evidence '04_SURFACE_RECONCILIATION' @{ schema='surface-reconciliation-1.0'; billboard=$billboardState } | Out-Null

# 7. Supabase is treated as a replaceable control/evidence adapter.
$supabase=@{ configured=$health.supabase_configured; reachable=$false; probes=@() }
if ($health.supabase_configured) {
    $sbKey=if ($env:SUPABASE_SECRET_KEY) { $env:SUPABASE_SECRET_KEY } else { $env:SUPABASE_SERVICE_KEY }
    $headers=@{ apikey=$sbKey; Authorization=('Bearer ' + $sbKey) }
    foreach ($table in @($config.supabase_probe_tables)) {
        $r=SafeJson ($env:SUPABASE_URL.TrimEnd('/') + '/rest/v1/' + $table + '?select=*&limit=1') $headers
        $supabase.probes += @{ table=$table; reachable=$r.ok; status=$r.status; error=$r.error }
        if ($r.ok) { $supabase.reachable=$true }
    }
}
Write-Evidence '05_SUPABASE_ADAPTER' @{ schema='supabase-adapter-state-1.0'; state=$supabase } | Out-Null

# 8. AgentBridge is discovered, not assumed.
$bridge=@{ configured=(-not [string]::IsNullOrWhiteSpace($env:AGENTBRIDGE_BASE_URL)); reachable=$false; endpoints=@() }
if ($bridge.configured) {
    $bh=@{}
    if ($env:AGENTBRIDGE_TOKEN) { $bh.Authorization='Bearer ' + $env:AGENTBRIDGE_TOKEN }
    foreach ($path in @($config.agentbridge_paths)) {
        $r=SafeJson ($env:AGENTBRIDGE_BASE_URL.TrimEnd('/') + $path) $bh
        $bridge.endpoints += @{ path=$path; reachable=$r.ok; status=$r.status }
        if ($r.ok) { $bridge.reachable=$true }
    }
}
Write-Evidence '06_AGENTBRIDGE' @{ schema='agentbridge-adapter-state-1.0'; state=$bridge } | Out-Null

# 9. Truth Oracle remains an independent verification component.
$truth=SafeGet ($config.base_url.TrimEnd('/') + '/truth-oracle')
Write-Evidence '07_TRUTH_ORACLE' @{ schema='truth-oracle-surface-1.0'; reachable=$truth.ok; status=$truth.status } | Out-Null

# 10. Stripe live payment evidence. No payment is created or modified.
$settlement=@{
    schema='stripe-money-evidence-1.0'
    source='stripe_live'
    pages=0
    charges_examined=0
    gross_paid_nzd=[decimal]0
    refunded_nzd=[decimal]0
    disputed_nzd=[decimal]0
    unknown_buyer_nzd=[decimal]0
    verified_stranger_revenue_nzd=[decimal]0
    records=@()
    verification_rule='This bootstrap never promotes a payment to verified stranger revenue without independent verification.'
}
if ($health.stripe_configured) {
    $charges=StripePaged '/charges' 100
    if ($charges.ok) {
        $settlement.pages=$charges.pages
        $settlement.charges_examined=$charges.items.Count
        foreach ($charge in @($charges.items)) {
            if ($charge.paid -ne $true) { continue }
            $amount=StripeMajor ([decimal]$charge.amount) ([string]$charge.currency)
            $currency=([string]$charge.currency).ToUpperInvariant()
            $record=@{ charge_id=$charge.id; payment_intent=$charge.payment_intent; amount=$amount; currency=$currency; created=$charge.created; livemode=$charge.livemode; refunded=$charge.refunded; disputed=$charge.disputed; metadata=$charge.metadata }
            if ($currency -ne 'NZD') { $record.classification='NON_NZD'; $settlement.records += $record; continue }
            if ($charge.refunded) { $settlement.refunded_nzd += $amount; $record.classification='REFUNDED_EXCLUDED'; $settlement.records += $record; continue }
            if ($charge.disputed) { $settlement.disputed_nzd += $amount; $record.classification='DISPUTED_EXCLUDED'; $settlement.records += $record; continue }
            $settlement.gross_paid_nzd += $amount
            $record.classification='PAID_NOT_INDEPENDENTLY_VERIFIED_AS_STRANGER'
            $settlement.unknown_buyer_nzd += $amount
            $settlement.records += $record
        }
    } else { Warn ('Stripe charges could not be read: ' + $charges.error) }
}
Write-Evidence '08_STRIPE_MONEY' $settlement | Out-Null

# 11. Economic decision engine. This is deliberately generic and replaceable.
$ready=@($cells | Where-Object { $_.readiness -eq 'READY_TO_SELL' } | Sort-Object @{Expression={-1 * $_.score}})
$best=if ($ready.Count -gt 0) { $ready[0] } elseif ($cells.Count -gt 0) { @($cells | Sort-Object @{Expression={-1 * $_.score}})[0] } else { $null }

$blocker='INVENTORY_DISCOVERY'
$action=@{
    type='DISCOVER_EXISTING_INVENTORY'
    approval_required=$false
    action='Connect the supervisor to the existing canonical inventory/offer source; do not invent another commercial system.'
}
$doNotBuild='Do not add another marketplace, payment rail, agent framework, or product until the existing economic surface is reconciled.'

if ($settlement.gross_paid_nzd -gt 0) {
    $blocker='POST_PAYMENT_VERIFICATION_OR_FULFILMENT'
    $action=@{ type='VERIFY_AND_FULFIL'; approval_required=$false; action='Independently verify the live payment evidence and process the corresponding fulfilment/proof path before expanding infrastructure.' }
    $doNotBuild='Do not expand architecture while an existing paid order needs verification or fulfilment.'
} elseif ($ready.Count -gt 0) {
    $blocker='BUYER'
    $action=@{ type='SELL_EXISTING_CELL'; approval_required=$true; cell_id=$best.cell_id; offer_id=$best.offer_id; sku=$best.sku; price=$best.price; currency=$best.currency; action='Present the highest-ranked ready economic cell to one real external buyer through an approved channel.' }
    $doNotBuild='Do not build another commercial surface. The nearest blocker is a buyer.'
} elseif ($billboardState.classification -eq 'PAGE_REACHABLE_OFFER_NOT_IN_PUBLIC_REGISTRY') {
    $blocker='OFFER_SURFACE_CONTRADICTION'
    $action=@{ type='RECONCILE_EXISTING_CELL'; approval_required=$false; cell='BILLBOARD'; action='Reconcile the existing Billboard page with the canonical offer registry/deployment.' }
    $doNotBuild='Do not create another Billboard SKU or replace the marketplace. Repair the existing mapping.'
} elseif ($cells.Count -gt 0) {
    $blocker='CHECKOUT_OR_FULFILMENT'
    $action=@{ type='REPAIR_EXISTING_CELL'; approval_required=$false; cell_id=$best.cell_id; action='Repair the highest-ranked existing economic cell until checkout and fulfilment are independently verifiable.' }
    $doNotBuild='Do not create a new product while an existing commercial cell is still the strongest repair candidate.'
}

$state=@{
    schema='economic-state-1.0'
    run_id=$runId
    verified_stranger_revenue_nzd=$settlement.verified_stranger_revenue_nzd
    stripe_paid_candidates_nzd=$settlement.gross_paid_nzd
    discovered_cells=$cells.Count
    ready_to_sell=$ready.Count
    best_cell=$best
    primary_blocker=$blocker
    next_action=$action
    do_not_build=$doNotBuild
    contradictions=$contradictions.Count
    modularity=@{
        component_specific_business_logic='NONE'
        offer_specific_business_logic='NONE'
        replaceable_adapters=$true
        external_side_effects=$false
    }
}
Write-Evidence '09_ECONOMIC_STATE' $state | Out-Null
Write-Evidence '10_CONTRADICTIONS' @{ schema='contradictions-1.0'; count=$contradictions.Count; items=$contradictions } | Out-Null
Write-Evidence '11_WARNINGS' @{ schema='warnings-1.0'; count=$warnings.Count; items=$warnings } | Out-Null

# 12. Manifest excludes itself so verification is deterministic.
$manifestItems=@()
foreach ($f in Get-ChildItem $runDir -Filter '*.json' | Where-Object { $_.Name -ne '00_MANIFEST.json' } | Sort-Object Name) {
    $h=Get-FileHash $f.FullName -Algorithm SHA256
    $manifestItems += @{ file=$f.Name; sha256=$h.Hash; bytes=$f.Length }
}
Write-Evidence '00_MANIFEST' @{ schema='economic-evidence-manifest-1.0'; run_id=$runId; files=$manifestItems; generated=(Get-Date).ToUniversalTime().ToString('o') } | Out-Null

# 13. Human-readable and machine-readable final decision.
$summary=@{
    schema='economic-next-action-1.0'
    run_id=$runId
    verified_stranger_revenue_nzd=$settlement.verified_stranger_revenue_nzd
    stripe_paid_candidates_nzd=$settlement.gross_paid_nzd
    best_cell=$best
    primary_blocker=$blocker
    next_action=$action
    do_not_build=$doNotBuild
    evidence_root=$runDir
}
Write-Evidence '12_NEXT_ACTION' $summary | Out-Null

Write-Host ''
Write-Host '============================================================'
Write-Host 'DREAMLEDGER ECONOMIC SUPERVISOR'
Write-Host '============================================================'
Write-Host ('Run: ' + $runId)
Write-Host ('Verified stranger revenue: NZ$' + ('{0:N2}' -f $settlement.verified_stranger_revenue_nzd))
Write-Host ('Stripe paid candidates: NZ$' + ('{0:N2}' -f $settlement.gross_paid_nzd))
Write-Host ('Economic cells discovered: ' + $cells.Count)
Write-Host ('Ready to sell: ' + $ready.Count)
Write-Host ('Primary blocker: ' + $blocker)
Write-Host ('NEXT ACTION: ' + $action.action)
Write-Host ('DO NOT BUILD: ' + $doNotBuild)
Write-Host ('Contradictions: ' + $contradictions.Count)
Write-Host ('Evidence: ' + $runDir)
Write-Host '============================================================'
