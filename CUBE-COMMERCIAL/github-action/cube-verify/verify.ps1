#Requires -Version 5.1
param(
    [Parameter(Mandatory=$true)][string]$ClaimFile,
    [Parameter(Mandatory=$true)][string]$EvidenceFile,
    [string]$PolicyFile
)

$ErrorActionPreference = "Stop"

function Set-Verdict {
    param([string]$Verdict)
    Write-Host "CUBE_VERDICT=$Verdict"
    if ($env:GITHUB_OUTPUT) {
        "verdict=$Verdict" | Out-File -FilePath $env:GITHUB_OUTPUT -Encoding ascii -Append
    }
}

$verdict = "FAIL"
$missing = @()

if (-not (Test-Path -LiteralPath $ClaimFile)) {
    Set-Verdict -Verdict "FAIL"
    Write-Error "Claim file missing"
    exit 1
}

if (-not (Test-Path -LiteralPath $EvidenceFile)) {
    Set-Verdict -Verdict "QUARANTINE"
    Write-Error "Evidence file missing"
    exit 1
}

$claim = Get-Content -LiteralPath $ClaimFile -Raw | ConvertFrom-Json
$evidence = Get-Content -LiteralPath $EvidenceFile -Raw | ConvertFrom-Json

if (-not $claim.action) { $missing += "claim.action" }
if (-not $claim.agent_id) { $missing += "claim.agent_id" }
if (-not $claim.timestamp) { $missing += "claim.timestamp" }

if (-not $evidence.transaction_id) { $missing += "evidence.transaction_id" }
if (-not $evidence.amount) { $missing += "evidence.amount" }
if (-not $evidence.currency) { $missing += "evidence.currency" }
if (-not $evidence.payment_account) { $missing += "evidence.payment_account" }

if ($PolicyFile -and (Test-Path -LiteralPath $PolicyFile)) {
    $policy = Get-Content -LiteralPath $PolicyFile -Raw | ConvertFrom-Json
    if ($policy.required_fields) {
        foreach ($field in $policy.required_fields) {
            if (-not ($evidence.PSObject.Properties.Name -contains $field)) {
                $missing += "policy.$field"
            }
        }
    }
}

if ($missing.Count -gt 0) {
    Set-Verdict -Verdict "QUARANTINE"
    Write-Host "MISSING_EVIDENCE=$($missing -join ',')"
    exit 1
}

Set-Verdict -Verdict "PASS"
exit 0
