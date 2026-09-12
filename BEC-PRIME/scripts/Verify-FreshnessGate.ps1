$ErrorActionPreference = 'Stop'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '../..'))
$paths = @('BEC-PRIME/catalog/offers/offers.json','BEC-PRIME/catalog/offers/candidates.json','BEC-PRIME/PROOF-OFFER-COMPILATION.json')
$dirty = @(git diff --name-only -- $paths | Where-Object { $_ -and ($_ -in $paths) })
if ($dirty.Count -gt 0) {
  Write-Error ('FRESHNESS RED: committed generated artifacts differ before regeneration: ' + ($dirty -join ', '))
  exit 1
}
Write-Host 'FRESHNESS GREEN: committed generated artifacts are clean before regeneration.'
