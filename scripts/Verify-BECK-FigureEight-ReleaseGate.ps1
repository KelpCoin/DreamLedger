#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$EvidencePath = (Join-Path $PSScriptRoot "..\evidence\BECK-FIGURE-EIGHT-RELEASE-GATE-20261026.json")
)
$ErrorActionPreference = "Stop"
$script:Results = New-Object System.Collections.Generic.List[string]
$logRoot = "D:\BrownEyeCortex\PROOF"
if (-not (Test-Path -LiteralPath "D:\")) {
    $logRoot = "C:\BrownEyeCortex\PROOF"
}
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$logPath = Join-Path $logRoot ("BECK-FigureEight-ReleaseGate-" + $stamp + ".log")
function Assert-Equal([string]$Name, $Actual, $Expected) {
    if ([string]$Actual -ceq [string]$Expected) {
        $script:Results.Add("PASS " + $Name)
    } else {
        $script:Results.Add("FAIL " + $Name + " expected=" + $Expected + " actual=" + $Actual)
    }
}
try {
    if (-not (Test-Path -LiteralPath $EvidencePath -PathType Leaf)) {
        throw ("Evidence file not found: " + $EvidencePath)
    }
    $raw = Get-Content -LiteralPath $EvidencePath -Raw -Encoding UTF8
    $e = $raw | ConvertFrom-Json
    Assert-Equal "schema_version" $e.schema_version "1.0.0"
    Assert-Equal "artifact_id" $e.artifact_id "BECK-FIGURE-EIGHT-RELEASE-GATE-20261026"
    Assert-Equal "release_gate" $e.release_gate "BLOCKED"
    Assert-Equal "production_health" $e.production_health "NOT_VERIFIED"
    Assert-Equal "external_revenue" $e.external_revenue "NOT_ESTABLISHED"
    Assert-Equal "github_pr_state" $e.observations.github_pr.state "open"
    Assert-Equal "github_pr_merged" $e.observations.github_pr.merged $false
    Assert-Equal "vercel_failure_marker" $e.observations.vercel.reported_failure_marker "build-rate-limit"
    Assert-Equal "render_service_state" $e.observations.render.state "suspended"
    Assert-Equal "render_suspend_reason" $e.observations.render.suspend_reason "billing"
    Assert-Equal "recovery_public_schema_count" $e.observations.supabase.public_schema_table_count_reported 0
    Assert-Equal "original_db_read" $e.observations.supabase.original_project_read "connection_refused"
    Assert-Equal "diagnostic_release_state" $e.observations.diagnostic_offer.release_state "held"
    Assert-Equal "diagnostic_buy_button_allowed" $e.observations.diagnostic_offer.buy_button_allowed $false
    Assert-Equal "diagnostic_instock_allowed" $e.observations.diagnostic_offer.in_stock_structured_data_allowed $false
    if (@($e.required_gates).Count -lt 6) {
        $script:Results.Add("FAIL required_gates_count")
    } else {
        $script:Results.Add("PASS required_gates_count")
    }
    $hash = (Get-FileHash -LiteralPath $EvidencePath -Algorithm SHA256).Hash
    $failed = @($script:Results | Where-Object { $_ -like "FAIL *" }).Count
    $summary = @(
        "artifact_id=" + $e.artifact_id
        "checked_at_utc=" + (Get-Date).ToUniversalTime().ToString("o")
        "evidence_path=" + (Resolve-Path -LiteralPath $EvidencePath).Path
        "evidence_sha256=" + $hash
        $script:Results
        "failed_checks=" + $failed
        "EVIDENCE_SCHEMA=" + $(if ($failed -eq 0) { "PASS" } else { "FAIL" })
        "RELEASE_GATE=BLOCKED"
        "NOTE=Schema verification does not prove live production health."
    )
    $summary | Set-Content -LiteralPath $logPath -Encoding ASCII
    $summary | ForEach-Object { Write-Output $_ }
    Write-Output ("proof_log=" + $logPath)
    if ($failed -gt 0) { exit 1 }
    exit 0
} catch {
    $msg = @(
        "EVIDENCE_SCHEMA=FAIL"
        ("error=" + $_.Exception.Message)
        ("checked_at_utc=" + (Get-Date).ToUniversalTime().ToString("o"))
    )
    $msg | Set-Content -LiteralPath $logPath -Encoding ASCII
    $msg | ForEach-Object { Write-Output $_ }
    Write-Output ("proof_log=" + $logPath)
    exit 2
}
