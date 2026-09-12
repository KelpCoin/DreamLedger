#Requires -Version 5.1
[CmdletBinding()]
param([switch]$BridgeSmoke)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
python '.\local_health_check.py';if($LASTEXITCODE-ne 0){throw 'Health check failed'}
if($BridgeSmoke){if(-not $env:DREAMLEDGER_AGENT_BRIDGE_TOKEN){throw 'Set DREAMLEDGER_AGENT_BRIDGE_TOKEN before bridge smoke'};python '.\cortex_worker.py' --manifest '.\cortex_execution_manifest.json' --config '.\local_config.json';if($LASTEXITCODE-ne 0){throw 'Bridge smoke failed'};Write-Host 'Bridge smoke completed.';exit 0}
$sbUrl=if($env:DREAMLEDGER_SUPABASE_URL){$env:DREAMLEDGER_SUPABASE_URL}else{$env:SUPABASE_URL};$sbKey=if($env:DREAMLEDGER_SUPABASE_KEY){$env:DREAMLEDGER_SUPABASE_KEY}else{$env:SUPABASE_SECRET_KEY};if(-not$sbUrl-or-not$sbKey){throw 'Set DREAMLEDGER_SUPABASE_URL and DREAMLEDGER_SUPABASE_KEY before local execution'};$env:SUPABASE_URL=$sbUrl;$env:SUPABASE_SECRET_KEY=$sbKey;if(-not$env:CORTEX_WORKER_ID){$env:CORTEX_WORKER_ID='cortex-windows-local'}
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File '.\powershell\LocalWorker.ps1' -Once
if($LASTEXITCODE-ne 0){throw 'Local worker failed'}
Write-Host 'Local Cortex work-ledger cycle completed.'
