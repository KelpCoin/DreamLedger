#Requires -Version 5.1
<#
.SYNOPSIS
  Air-gap autonomy gap auditor (Windows).

.DESCRIPTION
  Mirrors ops/autonomy/audit_autonomy_gaps.py for PowerShell hosts.
  Does not call Stripe. Does not invent revenue.

.EXAMPLE
  cd D:\path\to\DreamLedger
  .\ops\autonomy\Audit-AutonomyGaps.ps1

.EXAMPLE
  .\ops\autonomy\Audit-AutonomyGaps.ps1 -Root "D:\BrownEyeCortex\DreamLedger"
#>
param(
  [string]$Root = (Get-Location).Path
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path $Root).Path
$OutDir = Join-Path $Root "ops\autonomy"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

function Test-Rel([string]$Rel) {
  $p = Join-Path $Root $Rel
  return (Test-Path -LiteralPath $p)
}

$checks = @()
function Add-Check($Id, $Name, $Severity, $Ok, $Detail, $Plug) {
  $script:checks += [pscustomobject]@{
    id = $Id; name = $Name; severity = $Severity
    present_or_ok = [bool]$Ok; detail = $Detail; how_to_plug = $Plug
  }
}

Add-Check "S1" "Settlement workflow" "critical" (Test-Rel ".github\workflows\commerce-settlement-sync.yml") "commerce-settlement-sync.yml" "Restore from git if missing"
Add-Check "S2" "Reconcile script" "critical" (Test-Rel "ops\commerce\reconcile-stripe-airtable.mjs") "reconcile script" "No secrets in file"
Add-Check "S3" "Approved offers" "critical" (Test-Rel "BEC-PRIME\catalog\offers\approved.json") "approved.json" "Align Payment Links"
Add-Check "S4" "Fulfillment registry" "critical" (Test-Rel "BEC-PRIME\fulfillment\PRODUCT-FULFILLMENT-REGISTRY.json") "fulfillment registry" "ready=true only for auto sell"
Add-Check "S5" "Loop registry" "high" (Test-Rel "BEC-PRIME\economic-loops\registry.json") "economic-loops" "Register after approval"
Add-Check "S6" "Demand sentinel" "medium" (Test-Rel "BEC-PRIME\sentinels\DEMAND-SENTINEL.md") "sentinel contract" "Wire feeds when online"
Add-Check "S7" "Intent sentinel" "medium" (Test-Rel "BEC-PRIME\sentinels\INTENT-TO-PAY-SENTINEL.md") "intent contract" "Checkout open/abandon only"
Add-Check "S8" "DemandRadar" "medium" (Test-Rel "BEC-PRIME\runtime\DemandRadar.js") "DemandRadar.js" "Hook record() from runtime"
Add-Check "S9" "Compiler control plane" "medium" ((Test-Rel "BEC-PRIME\bec.js") -or (Test-Rel "BEC-PRIME\COMPILER-CONTROL-PLANE.md")) "bec control plane" "Compile then deploy"
Add-Check "S10" "Autonomy truth contract" "low" (Test-Rel "BEC-PRIME\docs\BECK-AUTONOMY-TRUTH-CONTRACT.md") "truth contract" "LOCAL_AUTONOMY_UNPROVEN until proven"

$autoReady = @()
$fulPath = Join-Path $Root "BEC-PRIME\fulfillment\PRODUCT-FULFILLMENT-REGISTRY.json"
if (Test-Path $fulPath) {
  $ful = Get-Content -Raw -Path $fulPath | ConvertFrom-Json
  if ($ful.entries) {
    foreach ($prop in $ful.entries.PSObject.Properties) {
      $v = $prop.Value
      if ($v.ready -eq $true -and $v.operator_required -eq $false) {
        $autoReady += $prop.Name
      }
    }
  }
}

$structuralFail = @($checks | Where-Object { -not $_.present_or_ok })
$software = if ($structuralFail.Count -eq 0) { "PASS" } else { "FAIL" }

$report = [ordered]@{
  schema = "BEC-PRIME/AUTONOMY-GAP-AUDIT/v1"
  audited_at = (Get-Date).ToUniversalTime().ToString("o")
  repo_root = $Root
  policy = "This audit never declares a sale."
  structural_checks = $checks
  structural_failures = $structuralFail
  auto_ready_fulfillment_keys = $autoReady
  next_human_actions = @(
    "Confirm STRIPE_SECRET_KEY in GitHub Actions secrets"
    "Run Commerce Settlement Sync once; archive artifact"
    "Confirm Stripe webhook endpoint + signing secret on production"
    "Distribute Payment Links (demand)"
    "On first live pay: verify fulfilment proof then update loop registry"
  )
  verdict = [ordered]@{
    fully_autonomous_revenue_engine = $false
    reason = "External demand + live secrets/webhooks cannot be certified offline"
    software_scaffolding = $software
  }
}

$jsonPath = Join-Path $OutDir "LAST-GAP-AUDIT.json"
$mdPath = Join-Path $OutDir "LAST-GAP-AUDIT.md"
($report | ConvertTo-Json -Depth 8) | Set-Content -Encoding UTF8 -Path $jsonPath

$md = @()
$md += "# Autonomy gap audit"
$md += ""
$md += "Audited: $($report.audited_at)"
$md += "Root: `$Root`"
$md += ""
$md += "## Verdict"
$md += ""
$md += "- Fully autonomous: **False**"
$md += "- Software scaffolding: **$software**"
$md += ""
$md += "## Structural"
foreach ($c in $checks) {
  $mark = if ($c.present_or_ok) { "OK" } else { "MISSING" }
  $md += "- **$($c.id)** [$mark] $($c.name) — $($c.detail)"
}
$md += ""
$md += "## Next human actions"
foreach ($a in $report.next_human_actions) { $md += "- [ ] $a" }
$md -join "`n" | Set-Content -Encoding UTF8 -Path $mdPath

Write-Host "Wrote $jsonPath"
Write-Host "Wrote $mdPath"
Write-Host "software_scaffolding=$software"
if ($software -ne "PASS") { exit 2 }
exit 0
