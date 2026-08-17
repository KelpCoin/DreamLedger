#Requires -Version 5.1
param(
    [Parameter(Mandatory=$true)][string]$ClaimFile,
    [Parameter(Mandatory=$true)][string]$EvidenceFile,
    [string]$PolicyFile
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $ClaimFile)) {
    Write-Host "CUBE_VERDICT=FAIL"
    Write-Error "Claim file missing"
    exit 1
}

if (-not (Test-Path $EvidenceFile)) {
    Write-Host "CUBE_VERDICT=QUARANTINE"
    Write-Error "Evidence file missing"
    exit 1
}

$claim = Get-Content $ClaimFile -Raw | ConvertFrom-Json
$evidence = Get-Content $EvidenceFile -Raw | ConvertFrom-Json

$missing = @()

# Required evidence for financial action
if (-not $claim.action) { $missing += "claim.action" }
if (-not $claim.agent_id) { $missing += "claim.agent_id" }
if (-not $claim.timestamp) { $missing += "claim.timestamp" }

if (-not $evidence.transaction_id) { $missing += "evidence.transaction_id" }
if (-not $evidence.amount) { $missing += "evidence.amount" }
if (-not $evidence.currency) { $missing += "evidence.currency" }
if (-not $evidence.payment_account) { $missing += "evidence.payment_account" }

if ($PolicyFile -and (Test-Path $PolicyFile)) {
    $policy = Get-Content $PolicyFile -Raw | ConvertFrom-Json
    if ($policy.required_fields) {
        foreach ($field in $policy.required_fields) {
            if (-not ($evidence.PSObject.Properties.Name -contains $field)) {
                $missing += "policy.$field"
            }
        }
    }
}

if ($missing.Count -gt 0) {
    Write-Host "CUBE_VERDICT=QUARANTINE"
    Write-Host ("MISSING_EVIDENCE=" + ($missing -join ","))
    exit 1
}

Write-Host "CUBE_VERDICT=PASS"
exit 0
