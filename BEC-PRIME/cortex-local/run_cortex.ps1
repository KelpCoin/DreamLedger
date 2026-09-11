#Requires -Version 5.1
param(
  [ValidateSet('health','claim','execute','manifest','proof')]
  [string]$Mode = 'health'
)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

if (-not (Test-Path (Join-Path $Root 'local_config.json'))) {
  throw "local_config.json missing. Run .\bootstrap.ps1 first."
}

$py = (Get-Command python -ErrorAction Stop).Source
switch ($Mode) {
  'health'   { & $py (Join-Path $Root 'local_health_check.py') }
  'claim'    { & $py (Join-Path $Root 'cortex_worker.py') --mode claim }
  'execute'  { & $py (Join-Path $Root 'cortex_worker.py') --mode execute }
  'manifest' { & $py (Join-Path $Root 'cortex_worker.py') --mode manifest }
  'proof'    { & $py (Join-Path $Root 'proof_writer.py') }
}
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
