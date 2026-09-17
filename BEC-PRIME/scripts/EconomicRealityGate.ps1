# Economic Reality Gate
# PowerShell 5.1 compatible. ASCII only. Read-only. No financial or production mutation.
# Purpose: stop infrastructure activity from being mistaken for economic progress.

[CmdletBinding()]
param(
    [string]$ProofRoot = 'D:\BrownEyeCortex\Proof',
    [string]$CellId = '',
    [string]$RequiredState = 'VERIFIED_EXTERNAL_REVENUE'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$validStates = @(
    'NO_BUYER_SIGNAL',
    'BUYER_SIGNAL',
    'CHECKOUT_READY',
    'PAYMENT_SETTLED',
    'FULFILLMENT_COMPLETE',
    'CUSTOMER_OUTCOME_PROVEN',
    'VERIFIED_EXTERNAL_REVENUE',
    'REPEATABILITY_PROVEN'
)

function Get-TruthState {
    param([object]$Packet)
    if ($null -ne $Packet.final_truth_state) { return [string]$Packet.final_truth_state }
    if ($null -ne $Packet.economic_state) { return [string]$Packet.economic_state }
    if ($null -ne $Packet.figure_eight.economic_proof -and $Packet.figure_eight.economic_proof -eq 'NOT_YET_PROVEN') {
        return 'NO_BUYER_SIGNAL'
    }
    return 'NO_BUYER_SIGNAL'
}

function Get-StateRank {
    param([string]$State)
    $index = [array]::IndexOf($validStates, $State)
    if ($index -lt 0) { return -1 }
    return $index
}

$files = @()
if (Test-Path $ProofRoot) {
    $files = Get-ChildItem -Path $ProofRoot -Filter '*.json' -File -Recurse -ErrorAction SilentlyContinue
}

$packets = @()
foreach ($file in $files) {
    try {
        $obj = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
        $state = Get-TruthState $obj
        if ((Get-StateRank $state) -ge 0) {
            $packets += [pscustomobject]@{
                path = $file.FullName
                state = $state
                generated_at = $obj.generated_at
                cell_id = $obj.cell_id
            }
        }
    } catch {
        # Ignore non-packet JSON. This gate is observational only.
    }
}

if ($CellId) {
    $packets = @($packets | Where-Object { $_.cell_id -eq $CellId })
}

$latest = $null
if ($packets.Count -gt 0) {
    $latest = $packets | Sort-Object generated_at -Descending | Select-Object -First 1
}

$latestRank = if ($latest) { Get-StateRank $latest.state } else { -1 }
$requiredRank = Get-StateRank $RequiredState

if ($requiredRank -lt 0) {
    Write-Host ('INVALID_REQUIRED_STATE={0}' -f $RequiredState)
    exit 3
}

# Hard rule: infrastructure artifacts never advance the economic state.
$activityOnlyPatterns = @(
    'CI', 'BUILD', 'DEPLOY', 'COMMIT', 'QUEUE', 'JOB', 'DASHBOARD',
    'TEST', 'SIMULATED', 'INTERNAL', 'AGENT', 'BRIDGE', 'FIGURE_EIGHT'
)

$economicVerified = $false
if ($latest -and $latest.state -eq 'VERIFIED_EXTERNAL_REVENUE') {
    $economicVerified = $true
}

$decision = 'BLOCK'
$reason = 'No evidence establishes the requested economic state.'
$nextAction = 'Create or inspect the smallest proof required for the next economic transition.'

if ($latest -and $latestRank -ge $requiredRank) {
    $decision = 'PASS'
    $reason = 'An evidence packet reaches the requested economic state.'
    $nextAction = 'Stop building infrastructure for this gate and inspect the next real economic transition.'
}

if ($RequiredState -eq 'VERIFIED_EXTERNAL_REVENUE' -and -not $economicVerified) {
    $decision = 'BLOCK'
    $reason = 'No complete external buyer, settled payment, attribution, fulfillment, and evidence chain is present.'
    $nextAction = 'Run the smallest real transaction path. Do not substitute CI, Stripe object existence, tests, or simulations.'
}

$timestamp = (Get-Date).ToString('o')
$proofDir = Join-Path $ProofRoot 'economic_gate'
if (-not (Test-Path $proofDir)) {
    New-Item -ItemType Directory -Path $proofDir -Force | Out-Null
}

$proofPath = Join-Path $proofDir ('economic_gate_{0}.json' -f (Get-Date).ToString('yyyyMMdd_HHmmss'))

$result = [ordered]@{
    schema = 'economic_reality_gate.v1'
    generated_at = $timestamp
    cell_id = $CellId
    requested_state = $RequiredState
    decision = $decision
    reason = $reason
    latest_economic_state = $(if ($latest) { $latest.state } else { 'NO_BUYER_SIGNAL' })
    latest_packet = $(if ($latest) { $latest.path } else { $null })
    infrastructure_activity_is_not_revenue = $true
    next_action = $nextAction
    stop_condition = $(if ($decision -eq 'PASS') { 'STOP: requested state is already evidenced.' } else { 'STOP: do not add infrastructure unless the next action changes the economic state or produces required evidence.' })
    trust_rule = 'Real external settled payment plus attribution plus fulfillment plus proof is required for VERIFIED_EXTERNAL_REVENUE.'
}

$result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $proofPath -Encoding ASCII

Write-Host ''
Write-Host 'ECONOMIC REALITY GATE'
Write-Host '====================='
Write-Host ('DECISION={0}' -f $decision)
Write-Host ('LATEST_ECONOMIC_STATE={0}' -f $result.latest_economic_state)
Write-Host ('REQUESTED_STATE={0}' -f $RequiredState)
Write-Host ('REASON={0}' -f $reason)
Write-Host ('NEXT_ACTION={0}' -f $nextAction)
Write-Host ('PROOF={0}' -f $proofPath)
Write-Host ''

if ($decision -eq 'PASS') {
    exit 0
}
exit 2