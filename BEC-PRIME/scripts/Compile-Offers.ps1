$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
Write-Host '=== BEC-PRIME Offer Compiler ===' -ForegroundColor Cyan
node compiler/OfferCompiler.js
if ($LASTEXITCODE -ne 0) { throw 'Offer compiler failed.' }
& (Join-Path $PSScriptRoot 'Verify-Offers.ps1')
if ($LASTEXITCODE -ne 0) { throw 'Offer verification failed.' }
Write-Host 'Offer compilation and verification PASS.' -ForegroundColor Green
