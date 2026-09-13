#Requires -Version 5.1
[CmdletBinding()]
param([switch]$Once)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
if(-not $env:SUPABASE_URL){throw 'SUPABASE_URL required'}
if(-not $env:SUPABASE_SERVICE_ROLE_KEY){throw 'SUPABASE_SERVICE_ROLE_KEY required'}
if(-not $env:BEC_WORKER_ID){$env:BEC_WORKER_ID="commander-$env:COMPUTERNAME-$PID"}
if(-not $env:BEC_WORKER_ROOT){$env:BEC_WORKER_ROOT=Join-Path $env:USERPROFILE 'DreamLedgerMarketplace'}
if(-not $env:LM_STUDIO_URL){$env:LM_STUDIO_URL='http://127.0.0.1:1234/v1/chat/completions'}
if(-not $env:LM_STUDIO_MODEL){$env:LM_STUDIO_MODEL='qwen2.5-14b-instruct'}
if($Once){$env:BEC_ONCE='1'}else{$env:BEC_ONCE='0'}
$script=Join-Path $PSScriptRoot 'commander_marketplace_worker.py'
& python $script
if($LASTEXITCODE -ne 0){throw "Commander marketplace worker exited with code $LASTEXITCODE"}
