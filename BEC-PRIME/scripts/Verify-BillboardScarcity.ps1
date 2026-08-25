#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
    [string]$BaseUrl = '',
    [string]$ProofRoot = 'D:\BrownEyeCortex\Proof'
)

$ErrorActionPreference = 'Stop'
$results = New-Object System.Collections.Generic.List[object]
function Check($Name, $Pass, $Detail) {
    $results.Add([pscustomobject]@{ name = $Name; pass = [bool]$Pass; detail = [string]$Detail })
}
function ReadText($Path) {
    if (-not (Test-Path -LiteralPath $Path)) { throw "Missing file: $Path" }
    return [IO.File]::ReadAllText($Path)
}

try {
    $offersPath = Join-Path $RepoRoot 'commerce\dreamledger-regional-billboard-offers.json'
    $htmlPath = Join-Path $RepoRoot 'BEC-PRIME\compiled\website\billboard.html'
    $checkoutPath = Join-Path $RepoRoot 'api\molt-beach-checkout.ts'
    $webhookPath = Join-Path $RepoRoot 'api\molt-beach-webhook.ts'
    $inventoryPath = Join-Path $RepoRoot 'api\molt-beach-inventory.ts'
    $submitPath = Join-Path $RepoRoot 'api\billboard\submit.ts'
    $foundingPath = Join-Path $RepoRoot 'BEC-PRIME\catalog\products\DREAMLEDGER-BILLBOARD-FOUNDING-001.json'

    $offers = Get-Content -LiteralPath $offersPath -Raw | ConvertFrom-Json
    $html = ReadText $htmlPath
    $checkout = ReadText $checkoutPath
    $webhook = ReadText $webhookPath
    $inventory = ReadText $inventoryPath
    $submit = ReadText $submitPath
    $founding = Get-Content -LiteralPath $foundingPath -Raw | ConvertFrom-Json

    Check 'Founding price NZD 50' ($founding.price -eq 5000) ('price_minor=' + $founding.price)
    Check 'Founding inventory 100' ($founding.inventory -eq 100) ('inventory=' + $founding.inventory)
    Check 'Six markets' ($offers.boards.Count -eq 6) ('markets=' + $offers.boards.Count)
    Check 'No unlimited inventory' ($html -notmatch 'Takeover|1000x1000') 'takeover text absent from canonical surface'
    Check 'Swipe-first catalogue' ($html -match 'Swipe-first catalogue') 'present'
    Check 'Real inventory endpoint' ($html -match '/api/molt-beach-inventory') 'present'
    Check 'Canonical submit endpoint' ($html -match '/api/billboard/submit') 'present'
    Check 'Signed webhook state' ($webhook -match 'PAID_PENDING_REVIEW') 'present'
    Check 'Webhook creative metadata' (($webhook -match 'image_url') -and ($webhook -match 'destination_url') -and ($webhook -match 'title')) 'present'
    Check '100-unit server cap' (($checkout -match 'FOUNDING_UNITS=100') -and ($inventory -match 'FOUNDING_UNITS=100')) 'present'
    Check '100px allocation grid' ($checkout -match 'x\+=100') 'present'
    Check 'Dynamic Stripe checkout' ($checkout -match 'checkout/sessions') 'present'
    Check 'No static takeover in submit API' ($submit -notmatch 'takeover') 'present'

    if ($BaseUrl) {
        foreach ($market in @('GLOBAL','NZ','AU','ZA','AMERICAS','EUROPE')) {
            $uri = $BaseUrl.TrimEnd('/') + '/api/molt-beach-inventory?market=' + $market
            try {
                $r = Invoke-RestMethod -Uri $uri -Method Get -TimeoutSec 15
                $ok = ($r.total_founding_units -eq 100 -and $null -ne $r.remaining_founding_units)
                Check ('Live inventory ' + $market) $ok ('remaining=' + $r.remaining_founding_units)
            } catch {
                Check ('Live inventory ' + $market) $false $_.Exception.Message
            }
        }
    }

    $fail = @($results | Where-Object { -not $_.pass })
    $status = if ($fail.Count -eq 0) { 'PASS' } else { 'BLOCKED' }
    New-Item -ItemType Directory -Force -Path $ProofRoot | Out-Null
    $proof = [ordered]@{
        timestamp_utc = [DateTime]::UtcNow.ToString('o')
        status = $status
        repo_root = $RepoRoot
        base_url = $BaseUrl
        checks = @($results)
        blocker_count = $fail.Count
        revenue_nzd_verified = 0
        external_buyer_count = 0
        public_action_performed = $false
    }
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $proofPath = Join-Path $ProofRoot ('BILLBOARD-SCARCITY-VERIFY-' + $stamp + '.json')
    $proof | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $proofPath -Encoding ASCII
    $results | Format-Table -AutoSize
    Write-Host ('STATUS=' + $status)
    Write-Host ('PROOF=' + $proofPath)
    if ($fail.Count -gt 0) { exit 2 }
    exit 0
}
catch {
    Write-Host ('STATUS=ERROR')
    Write-Host $_.Exception.Message
    exit 3
}
