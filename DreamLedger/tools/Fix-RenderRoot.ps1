# ================================
# DreamLedger Render Root Repair
# Idempotent MegaBootstrap
# ================================

$ErrorActionPreference = "Stop"

$repo = "C:\BrownEyeCortex\DreamLedger"
$logRoot = "D:\DreamLedger\logs"
$ts = Get-Date -Format "yyyyMMdd_HHmmss"

New-Item -ItemType Directory -Force -Path $logRoot | Out-Null

$logFile = Join-Path $logRoot "render_root_fix_$ts.log"
Start-Transcript -Path $logFile -Force | Out-Null

Write-Host "== DreamLedger Render Root Fix Starting =="

# Ensure repo exists
if (!(Test-Path $repo)) {
    throw "Repo not found at $repo"
}

Set-Location $repo

# Detect expected Render root mismatch
$expectedRoot = "carousel_runtime"
$expectedPath = Join-Path $repo $expectedRoot

if (!(Test-Path $expectedPath)) {
    Write-Host "Missing expected Render root directory: $expectedRoot"
    Write-Host "Creating safe stub to satisfy deployment pointer..."

    New-Item -ItemType Directory -Force -Path $expectedPath | Out-Null

    # Create minimal stub so Render stops failing immediately
    $stubIndex = @"
console.log('DreamLedger carousel_runtime stub online');
module.exports = {};
"@

    Set-Content -Path (Join-Path $expectedPath "index.js") -Value $stubIndex -Encoding UTF8
} else {
    Write-Host "carousel_runtime already exists. No structural change needed."
}

# Create diagnostic artifact
$artifact = @"
DreamLedger Render Fix Report
Timestamp: $ts

Issue:
Render root directory set to 'carousel_runtime' but folder was missing.

Action Taken:
- Ensured directory exists
- Added minimal stub entrypoint
- Made deployment path valid for Render runtime scanner

Next Step:
Either:
1. Fix Render Root Directory to '.'
OR
2. Keep stub and route properly inside app

Repo: $repo
"@

$artifactPath = Join-Path $logRoot "render_fix_report_$ts.txt"
Set-Content -Path $artifactPath -Value $artifact -Encoding UTF8

Write-Host "Artifact written to: $artifactPath"

Stop-Transcript | Out-Null

Write-Host "== FIX COMPLETE =="