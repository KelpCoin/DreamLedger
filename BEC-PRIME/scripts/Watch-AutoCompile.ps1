[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$Root = 'D:\BrownEyeCortex\BEC-PRIME'
$Compile = Join-Path $Root 'scripts\Compile-All.ps1'
$LogDir = Join-Path $Root 'WATCHDOG-LOGS'
$Log = Join-Path $LogDir 'auto-compile.log'

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
function Log($m) { Add-Content -Path $Log -Value ((Get-Date).ToUniversalTime().ToString('o') + ' ' + $m) }

if (-not (Test-Path $Root)) { Log 'SKIP root missing'; exit 2 }
if (-not (Test-Path $Compile)) { Log 'FAIL compiler missing'; exit 3 }

Set-Location $Root
try {
    & $Compile
    if ($LASTEXITCODE -ne 0) { throw 'Compile-All failed.' }

    git add BEC-PRIME/catalog/compiled BEC-PRIME/compiled/website BEC-PRIME/PROOF-ECONOMIC-TREE-COMPILATION.json BEC-PRIME/PROOF-SILO-PORTFOLIO-COMPILATION.json BEC-PRIME/RUN-PROOFS
    git diff --cached --quiet
    if ($LASTEXITCODE -eq 0) {
        Log 'NO_CHANGES'
        exit 0
    }

    git config user.name 'BEC-PRIME Compiler'
    git config user.email 'bec-prime@users.noreply.github.com'
    git commit -m 'chore: auto-compile DreamLedger generated surfaces [skip ci]'
    if ($LASTEXITCODE -ne 0) { throw 'Generated-state commit failed.' }
    git push origin HEAD:main
    if ($LASTEXITCODE -ne 0) { throw 'Generated-state push failed.' }
    Log 'PUSHED generated DreamLedger state'
} catch {
    Log ('FAIL ' + $_.Exception.Message)
    exit 1
}
