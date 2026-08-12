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

    git add BEC-PRIME/catalog/compiled/economic-tree.json BEC-PRIME/compiled/website/economics/index.html BEC-PRIME/PROOF-ECONOMIC-TREE-COMPILATION.json BEC-PRIME/RUN-PROOFS
    git diff --cached --quiet
    if ($LASTEXITCODE -eq 0) {
        Log 'NO_CHANGES'
        exit 0
    }

    git config user.name 'BEC-PRIME Compiler'
    git config user.email 'bec-prime@users.noreply.github.com'
    git commit -m 'chore: auto-compile DreamLedger economic tree [skip ci]'
    if ($LASTEXITCODE -ne 0) { throw 'Economic-tree commit failed.' }

    for ($attempt = 1; $attempt -le 3; $attempt++) {
        git fetch origin main
        if ($LASTEXITCODE -ne 0) { Start-Sleep -Seconds 2; continue }
        git rebase origin/main
        if ($LASTEXITCODE -eq 0) {
            git push origin HEAD:main
            if ($LASTEXITCODE -eq 0) {
                Log 'PUSHED economic-tree state'
                exit 0
            }
        } else {
            git rebase --abort 2>$null
            break
        }
        Start-Sleep -Seconds 2
    }
    throw 'Economic-tree push failed after 3 attempts.'
} catch {
    Log ('FAIL ' + $_.Exception.Message)
    exit 1
}
