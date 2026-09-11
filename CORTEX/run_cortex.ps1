#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
if (-not $env:DREAMLEDGER_AGENT_BRIDGE_TOKEN) {
  throw 'Set env DREAMLEDGER_AGENT_BRIDGE_TOKEN before running'
}
python '.\local_health_check.py'
if ($LASTEXITCODE -ne 0) { throw 'Health check failed' }
python '.\cortex_worker.py' --manifest '.\cortex_execution_manifest.json' --config '.\local_config.json'
if ($LASTEXITCODE -ne 0) { throw 'Cortex worker failed' }
Write-Host 'Result written to cortex_execution_result.json'
