#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
Write-Host 'BrownEye Cortex local bootstrap'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
if (-not (Test-Path '.\local_config.json')) {
  Copy-Item '.\local_config.example.json' '.\local_config.json'
  Write-Host 'Created local_config.json from example. Fill bridge token env and model endpoint.'
}
New-Item -ItemType Directory -Force -Path '.\work','.\proof' | Out-Null
python --version
if ($LASTEXITCODE -ne 0) { throw 'Python is required on PATH' }
Write-Host 'Bootstrap complete. Next: set DREAMLEDGER_AGENT_BRIDGE_TOKEN then run .\run_cortex.ps1'
