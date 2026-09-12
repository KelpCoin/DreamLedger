param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [switch]$Regenerate
)

$ErrorActionPreference = 'Stop'
Set-Location $RepoRoot

$paths = @(
    'BEC-PRIME/catalog/offers/offers.json',
    'BEC-PRIME/catalog/offers/candidates.json',
    'BEC-PRIME/PROOF-OFFER-COMPILATION.json'
)

function Get-DirtyPaths {
    $raw = git diff --name-only -- @paths 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'git diff failed while checking freshness' }
    @($raw | Where-Object { $_ -and ($_ -in $paths) })
}

$before = @(Get-DirtyPaths)
if ($before.Count -gt 0) {
    Write-Error ('FRESHNESS RED: committed generated artifacts differ before regeneration: ' + ($before -join ', '))
    exit 1
}

Write-Host 'FRESHNESS GREEN: committed generated artifacts are clean before regeneration.'

if ($Regenerate) {
    Push-Location (Join-Path $RepoRoot 'BEC-PRIME')
    try {
        npm run compile:offers
        if ($LASTEXITCODE -ne 0) { throw 'compile:offers failed during regeneration' }
    }
    finally {
        Pop-Location
    }

    $after = @(Get-DirtyPaths)
    if ($after.Count -gt 0) {
        Write-Error ('REGENERATION DRIFT: regenerated artifacts differ from committed state: ' + ($after -join ', '))
        exit 2
    }

    Write-Host 'REGENERATION GREEN: regeneration produced no committed-artifact drift.'
}
