#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$RepoRoot = "C:\BrownEyeCortex\DreamLedger",
    [string]$ProofRoot = "D:\BrownEyeCortex\BEC-PRIME\RUN-PROOFS\FIRST-DOLLAR"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-JsonFile {
    param([string]$Path, [object]$Object)
    $dir = Split-Path -Parent $Path
    if ($dir) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $json = $Object | ConvertTo-Json -Depth 20
    [IO.File]::WriteAllText($Path, $json + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
}

function Fail-Closed([string]$Message) {
    $script:Failures += $Message
    Write-Host ("FAIL-CLOSED: " + $Message)
}

$Failures = @()
$Started = (Get-Date).ToUniversalTime()
New-Item -ItemType Directory -Force -Path $ProofRoot | Out-Null

$python = Get-Command python.exe -ErrorAction SilentlyContinue
$requests = $false
$pythonVersion = $null

if ($python) {
    try {
        $pythonVersion = (& $python.Source --version 2>&1 | Out-String).Trim()
        $probe = & $python.Source -c "import requests; print('REQUESTS_OK')" 2>&1
        if (($probe | Out-String).Trim() -match "REQUESTS_OK") { $requests = $true }
    } catch {
        Fail-Closed "Python exists but the requests dependency probe failed."
    }
} else {
    Fail-Closed "python.exe was not found on PATH."
}

$ebayApp = [string]$env:EBAY_APP_ID
$ebayCert = [string]$env:EBAY_CERT_ID

if ([string]::IsNullOrWhiteSpace($ebayApp)) {
    Fail-Closed "EBAY_APP_ID is missing. No live eBay call will be attempted."
}
if ([string]::IsNullOrWhiteSpace($ebayCert)) {
    Fail-Closed "EBAY_CERT_ID is missing. No live eBay call will be attempted."
}

$git = Get-Command git.exe -ErrorAction SilentlyContinue
$gitStatus = $null
if ($git -and (Test-Path -LiteralPath $RepoRoot -PathType Container)) {
    try {
        $gitStatus = (& $git.Source -C $RepoRoot status --short 2>&1 | Out-String).Trim()
    } catch {
        Fail-Closed "Git repository inspection failed."
    }
} else {
    if (-not $git) { Fail-Closed "git.exe was not found on PATH." }
    if (-not (Test-Path -LiteralPath $RepoRoot -PathType Container)) {
        Fail-Closed ("Repository root not found: " + $RepoRoot)
    }
}

$proof = [ordered]@{
    schema_version = "1.0"
    gate = "G00_LOCAL_FIRST_DOLLAR_READINESS"
    status = if ($Failures.Count -eq 0) { "PASS" } else { "BLOCKED" }
    started_at_utc = $Started.ToString("o")
    completed_at_utc = (Get-Date).ToUniversalTime().ToString("o")
    host = $env:COMPUTERNAME
    repo_root = $RepoRoot
    proof_root = $ProofRoot
    python = @{
        available = [bool]$python
        version = $pythonVersion
        requests_available = $requests
    }
    credentials = @{
        ebay_app_id_present = (-not [string]::IsNullOrWhiteSpace($ebayApp))
        ebay_cert_id_present = (-not [string]::IsNullOrWhiteSpace($ebayCert))
        secrets_written_to_proof = $false
    }
    git = @{
        available = [bool]$git
        working_tree_status = $gitStatus
    }
    public_actions = "APPROVAL_GATED"
    live_marketplace_call_attempted = $false
    failures = $Failures
    next_gate = if ($Failures.Count -eq 0) { "EBAY-001" } else { "FIX_LOCAL_READINESS" }
}

$proofPath = Join-Path $ProofRoot ("LOCAL-READINESS-{0}.json" -f (Get-Date).ToUniversalTime().ToString("yyyyMMdd-HHmmss"))
Write-JsonFile -Path $proofPath -Object $proof
$hash = (Get-FileHash -LiteralPath $proofPath -Algorithm SHA256).Hash
[IO.File]::WriteAllText(($proofPath + ".sha256"), $hash + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))

Write-Host ""
Write-Host "=== BEC-PRIME FIRST-DOLLAR READINESS ==="
Write-Host ("STATUS: " + $proof.status)
Write-Host ("PROOF: " + $proofPath)
Write-Host ("SHA256: " + $hash)
Write-Host ("NEXT: " + $proof.next_gate)

if ($Failures.Count -gt 0) {
    Write-Host ""
    Write-Host "Nothing has been faked. Resolve the failures and rerun this same command."
    exit 1
}

Write-Host ""
Write-Host "PASS: local machine is ready for the live EBAY-001 gate."
exit 0
