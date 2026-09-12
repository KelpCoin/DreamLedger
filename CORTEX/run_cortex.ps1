#Requires -Version 5.1
[CmdletBinding()]
param([switch]$BridgeSmoke)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

python '.\local_health_check.py'
if ($LASTEXITCODE -ne 0) { throw 'Health check failed' }

if ($BridgeSmoke) {
    if (-not $env:DREAMLEDGER_AGENT_BRIDGE_TOKEN) { throw 'Set DREAMLEDGER_AGENT_BRIDGE_TOKEN before bridge smoke' }
    python '.\cortex_worker.py' --manifest '.\cortex_execution_manifest.json' --config '.\local_config.json'
    if ($LASTEXITCODE -ne 0) { throw 'Bridge smoke failed' }
    Write-Host 'Bridge smoke completed. Result written to cortex_execution_result.json'
    exit 0
}

if (-not $env:SUPABASE_URL -or -not $env:SUPABASE_SECRET_KEY) {
    throw 'Set SUPABASE_URL and SUPABASE_SECRET_KEY before local mailbox execution'
}

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File '.\local_mailbox_worker.ps1' -Once
if ($LASTEXITCODE -ne 0) { throw 'Local mailbox worker failed' }
Write-Host 'Local Cortex mailbox cycle completed.'
