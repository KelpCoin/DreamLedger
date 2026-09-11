#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

Write-Host "BEC Cortex local bootstrap"
Write-Host "Root: $Root"

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
  throw "python not found on PATH. Install Python 3.10+ and retry."
}

$py = (Get-Command python).Source
Write-Host "Python: $py"
& $py --version

New-Item -ItemType Directory -Force -Path (Join-Path $Root 'proofs') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $Root 'artifacts') | Out-Null

if (-not (Test-Path (Join-Path $Root 'local_config.json'))) {
  Copy-Item (Join-Path $Root 'local_config.example.json') (Join-Path $Root 'local_config.json')
  Write-Host "Created local_config.json from example. Edit secrets via environment only."
}

Write-Host "BOOTSTRAP=PASS"
Write-Host "Next: .\run_cortex.ps1 -Mode health"
