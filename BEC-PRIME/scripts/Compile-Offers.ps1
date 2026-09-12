$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
Write-Host '=== BEC-PRIME Offer Compiler ===' -ForegroundColor Cyan
node compiler/OfferCompiler.js
if ($LASTEXITCODE -ne 0) { throw 'Offer compiler failed.' }
& (Join-Path $PSScriptRoot 'Verify-ApprovedOfferContract.ps1')
if ($LASTEXITCODE -ne 0) { throw 'Approved offer contract verification failed.' }
Write-Host 'Offer compilation and approval contract verification PASS.' -ForegroundColor Green
