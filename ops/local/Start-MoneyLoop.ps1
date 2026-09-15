$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Python = Get-Command python -ErrorAction SilentlyContinue
if (-not $Python) { throw 'Python is required.' }
$env:PYTHONUTF8 = '1'
$env:LMSTUDIO_BASE_URL = if ($env:LMSTUDIO_BASE_URL) { $env:LMSTUDIO_BASE_URL } else { 'http://127.0.0.1:1234/v1' }
python (Join-Path $Root 'money_orchestrator.py')
