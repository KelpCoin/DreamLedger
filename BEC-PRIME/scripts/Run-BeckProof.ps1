#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$ProjectDir = 'C:\BrownEyeCortex\BEC-PRIME',
    [string]$ProofDir = 'D:\BrownEyeCortex\InverseShopping\proof',
    [string]$WantedText = 'I want a FUBU jacket, XL or 2XL, vintage 1990s/2000s, black or red, under NZ$120',
    [int]$ServerPort = 3000,
    [int]$ServerWaitSeconds = 45,
    [int]$ProofWaitSeconds = 90
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$runId = Get-Date -Format 'yyyyMMdd-HHmmss'
$logDir = Join-Path $ProjectDir 'proof'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir "beck-proof-$runId.log"
$serverOut = Join-Path $logDir "beck-server-$runId.out.log"
$serverErr = Join-Path $logDir "beck-server-$runId.err.log"
$proofBefore = @()
$serverProcess = $null

function Fail([string]$Message) {
    Write-Host "FAIL: $Message" -ForegroundColor Red
    throw $Message
}

function Step([string]$Message) {
    Write-Host "`n=== $Message ===" -ForegroundColor Cyan
}

function Invoke-Checked([string]$File, [string[]]$Args) {
    & $File @Args
    if ($LASTEXITCODE -ne 0) {
        throw "$File failed with exit code $LASTEXITCODE"
    }
}

try {
    Start-Transcript -Path $logFile -Force | Out-Null

    Step 'Validate environment'
    if (-not (Test-Path -LiteralPath $ProjectDir -PathType Container)) { Fail "Project not found: $ProjectDir" }
    if ([string]::IsNullOrWhiteSpace($WantedText)) { Fail 'Wanted text is empty' }
    if ($WantedText.Length -gt 1000) { Fail 'Wanted text exceeds 1000 characters' }
    New-Item -ItemType Directory -Force -Path $ProofDir | Out-Null

    Step 'Acquire eBay credentials for this process only'
    $appId = Read-Host 'EBAY_APP_ID'
    $certId = Read-Host 'EBAY_CERT_ID'
    if ([string]::IsNullOrWhiteSpace($appId) -or [string]::IsNullOrWhiteSpace($certId)) { Fail 'eBay credentials cannot be empty' }
    $env:EBAY_APP_ID = $appId
    $env:EBAY_CERT_ID = $certId

    Set-Location -LiteralPath $ProjectDir
    $proofBefore = @(Get-ChildItem -LiteralPath $ProofDir -Filter 'WANTED-HUNT-PROOF-*.txt' -File -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName })

    Step 'Patch featured offer'
    Invoke-Checked 'node' @('scripts/patch-featured-offer.js')

    Step 'Run deterministic gates'
    Invoke-Checked 'npm' @('run','verify:hunt')
    Invoke-Checked 'npm' @('run','verify:wanted')

    Step 'Start server'
    $serverProcess = Start-Process -FilePath 'npm' -ArgumentList 'start' -WorkingDirectory $ProjectDir -RedirectStandardOutput $serverOut -RedirectStandardError $serverErr -PassThru -WindowStyle Hidden

    $ready = $false
    $deadline = (Get-Date).AddSeconds($ServerWaitSeconds)
    while ((Get-Date) -lt $deadline) {
        if ($serverProcess.HasExited) { Fail "Server exited early. See $serverErr" }
        try {
            $health = Invoke-WebRequest -Uri "http://localhost:$ServerPort/api/health" -UseBasicParsing -TimeoutSec 2
            if ($health.StatusCode -ge 200 -and $health.StatusCode -lt 300) { $ready = $true; break }
        } catch {
            try {
                $root = Invoke-WebRequest -Uri "http://localhost:$ServerPort/" -UseBasicParsing -TimeoutSec 2
                if ($root.StatusCode -ge 200 -and $root.StatusCode -lt 500) { $ready = $true; break }
            } catch { }
        }
        Start-Sleep -Seconds 1
    }
    if (-not $ready) { Fail "Server did not become ready. See $serverOut and $serverErr" }

    Step 'Submit WANTED'
    $wanted = Invoke-RestMethod -Uri "http://localhost:$ServerPort/api/wanted" -Method Post -ContentType 'application/json' -Body (@{ text = $WantedText } | ConvertTo-Json) -TimeoutSec 15
    $wantedId = [string]$wanted.wantedId
    if ([string]::IsNullOrWhiteSpace($wantedId)) { Fail "WANTED response did not contain wantedId" }
    Write-Host "WANTED ID: $wantedId" -ForegroundColor Green

    Step 'Run eBay HUNT'
    $hunt = Invoke-RestMethod -Uri "http://localhost:$ServerPort/api/hunt" -Method Post -ContentType 'application/json' -Body (@{ wantedId = $wantedId } | ConvertTo-Json) -TimeoutSec 60
    $hunt | ConvertTo-Json -Depth 30 | Write-Host

    Step 'Locate fresh proof'
    $proofFile = $null
    $deadline = (Get-Date).AddSeconds($ProofWaitSeconds)
    while ((Get-Date) -lt $deadline) {
        $fresh = @(Get-ChildItem -LiteralPath $ProofDir -Filter 'WANTED-HUNT-PROOF-*.txt' -File -ErrorAction SilentlyContinue | Where-Object { $proofBefore -notcontains $_.FullName -and $_.LastWriteTime -ge (Get-Date).AddMinutes(-2) } | Sort-Object LastWriteTime -Descending)
        if ($fresh.Count -gt 0) { $proofFile = $fresh[0]; break }
        Start-Sleep -Seconds 2
    }
    if (-not $proofFile) { Fail "No fresh WANTED-HUNT-PROOF file appeared. See $serverOut and $serverErr" }

    Step 'Validate proof identity'
    $proofText = Get-Content -LiteralPath $proofFile.FullName -Raw
    if ($proofText -notmatch [regex]::Escape($wantedId)) { Fail "Proof does not contain WANTED ID $wantedId" }
    if ($proofText -notmatch '(?i)eBay') { Fail 'Proof does not identify eBay' }

    Step 'PROOF'
    Get-Content -LiteralPath $proofFile.FullName

    Step 'SUCCESS'
    Write-Host "Fresh proof: $($proofFile.FullName)" -ForegroundColor Green
    Write-Host "Run log: $logFile" -ForegroundColor Green
}
catch {
    Write-Host "`nEVIDENCE GATE FAILED" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    if (Test-Path -LiteralPath $serverErr) { Write-Host "Server error log: $serverErr" }
    exit 1
}
finally {
    if ($null -ne $serverProcess -and -not $serverProcess.HasExited) {
        Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
    }
    Remove-Item Env:EBAY_APP_ID -ErrorAction SilentlyContinue
    Remove-Item Env:EBAY_CERT_ID -ErrorAction SilentlyContinue
    try { Stop-Transcript | Out-Null } catch { }
}
