[CmdletBinding()]
param(
    [string]$SpecPath = (Join-Path $PSScriptRoot '..\docs\777\agent-bridge-economics-gate-2026-10-20.json'),
    [string]$ProofRoot = 'D:\BrownEye\BROWNEYE_ARTIFACTS\777\AGENT_BRIDGE_ECONOMICS_GATE_20261020'
)
$ErrorActionPreference = 'Stop'
$checks = New-Object System.Collections.Generic.List[object]
function Add-Check([string]$Name, [bool]$Pass, [string]$Detail) {
    $script:checks.Add([ordered]@{ name = $Name; pass = $Pass; detail = $Detail })
}
try {
    if (-not (Test-Path -LiteralPath $SpecPath -PathType Leaf)) { throw "SPEC_NOT_FOUND:$SpecPath" }
    $raw = Get-Content -LiteralPath $SpecPath -Raw -Encoding UTF8
    $spec = $raw | ConvertFrom-Json
    Add-Check 'schema_version' ($spec.schema_version -eq 'dreamledger.agent-bridge-economics-gate.v1') ([string]$spec.schema_version)
    Add-Check 'truth_baseline_zero' ([double]$spec.economic_baseline.verified_external_revenue_nzd -eq 0) ([string]$spec.economic_baseline.verified_external_revenue_nzd)
    Add-Check 'no_independent_buyer_claim' ([int]$spec.economic_baseline.independent_external_buyers_verified -eq 0) ([string]$spec.economic_baseline.independent_external_buyers_verified)
    Add-Check 'no_new_sku' ([bool]$spec.principles.no_new_sku) 'no_new_sku must remain true'
    Add-Check 'approval_gate' (([bool]$spec.principles.no_publication_without_approval) -and ([bool]$spec.principles.no_spend_without_approval)) 'publication and spend require approval'
    Add-Check 'cost_unknown_not_zero' ($null -eq $spec.unit_economics.current_measured_cost_nzd -and $null -eq $spec.unit_economics.current_measured_contribution_margin_percent) 'unmeasured costs and margin remain null'
    $probe = $spec.existing_offer_candidates | Where-Object { $_.offer_id -eq 'TOLL-PROBE-50C' } | Select-Object -First 1
    $pack = $spec.existing_offer_candidates | Where-Object { $_.offer_id -eq 'AGENT-BRIDGE-EVENTS-100' } | Select-Object -First 1
    Add-Check 'existing_probe_held' ($null -ne $probe -and [double]$probe.recorded_price_nzd -eq 0.5 -and -not [bool]$probe.activation_allowed) 'existing NZD 0.50 offer is not auto-enabled'
    Add-Check 'existing_pack_held' ($null -ne $pack -and [double]$pack.recorded_price_nzd -eq 19 -and [int]$pack.recorded_units -eq 100 -and -not [bool]$pack.activation_allowed) 'existing NZD 19 / 100 offer is not auto-enabled'
    Add-Check 'required_acceptance_gates' ($spec.required_acceptance_gates.Count -ge 9) ([string]$spec.required_acceptance_gates.Count)
    Add-Check 'no_parallel_ledger' ([bool]$spec.principles.no_parallel_ledger) 'reuse canonical settlement ledger'
    $status = if (@($checks | Where-Object { -not $_.pass }).Count -eq 0) { 'PASS' } else { 'FAIL' }
    $proof = [ordered]@{
        schema = 'dreamledger.agent-bridge-economics-gate.verification/v1'
        checked_at_utc = [DateTime]::UtcNow.ToString('o')
        status = $status
        spec_path = (Resolve-Path -LiteralPath $SpecPath).Path
        spec_sha256 = (Get-FileHash -LiteralPath $SpecPath -Algorithm SHA256).Hash.ToLowerInvariant()
        checks_passed = @($checks | Where-Object { $_.pass }).Count
        checks_failed = @($checks | Where-Object { -not $_.pass }).Count
        checks = @($checks)
        external_actions_performed = $false
        revenue_changed = $false
    }
    if (-not (Test-Path -LiteralPath $ProofRoot)) { New-Item -ItemType Directory -Path $ProofRoot -Force | Out-Null }
    $proofPath = Join-Path $ProofRoot 'VERIFICATION-PROOF.json'
    $proof | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $proofPath -Encoding UTF8
    Write-Output ($proof | ConvertTo-Json -Depth 8)
    Write-Output "PROOF_PATH=$proofPath"
    if ($status -ne 'PASS') { exit 1 }
} catch {
    Write-Error $_
    exit 2
}