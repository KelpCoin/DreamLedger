$ErrorActionPreference = 'Stop'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '../..'))

$paths = @(
  'BEC-PRIME/catalog/offers/offers.json',
  'BEC-PRIME/catalog/offers/candidates.json',
  'BEC-PRIME/PROOF-OFFER-COMPILATION.json'
)

$tempRoot = Join-Path $env:TEMP ('dreamledger-freshness-' + [guid]::NewGuid().ToString('N'))
$exitCode = 0
$gateOutput = @()

try {
  New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null

  foreach ($path in $paths) {
    $source = Join-Path (Get-Location) $path
    $backup = Join-Path $tempRoot ($path -replace '[\\/]', '__')
    if (Test-Path -LiteralPath $source) {
      Copy-Item -LiteralPath $source -Destination $backup -Force
    }
  }

  Write-Host 'FRESHNESS CHECK: regenerating offer artifacts from current source.'
  & npm run compile:offers
  if ($LASTEXITCODE -ne 0) {
    throw ('compile:offers failed with exit code ' + $LASTEXITCODE)
  }

  $gateOutput = @(git diff --exit-code -- $paths 2>&1)
  $exitCode = $LASTEXITCODE

  if ($exitCode -ne 0) {
    Write-Host 'FRESHNESS RED: regenerated artifacts differ from the committed index.'
    $gateOutput | ForEach-Object { Write-Host $_ }
  }
  else {
    Write-Host 'FRESHNESS GREEN: regenerated artifacts match the committed index.'
  }
}
catch {
  $exitCode = 1
  Write-Error ('FRESHNESS VERIFIER ERROR: ' + $_.Exception.Message)
}
finally {
  foreach ($path in $paths) {
    $source = Join-Path (Get-Location) $path
    $backup = Join-Path $tempRoot ($path -replace '[\\/]', '__')
    if (Test-Path -LiteralPath $backup) {
      Copy-Item -LiteralPath $backup -Destination $source -Force
    }
  }

  if (Test-Path -LiteralPath $tempRoot) {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}

exit $exitCode
