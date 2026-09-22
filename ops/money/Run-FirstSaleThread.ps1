#Requires -Version 5.1
<#
.SYNOPSIS
  Windows wrapper for first-sale checkpointed money thread.

.EXAMPLE
  .\ops\money\Run-FirstSaleThread.ps1 status
  .\ops\money\Run-FirstSaleThread.ps1 boot
  .\ops\money\Run-FirstSaleThread.ps1 next
  .\ops\money\Run-FirstSaleThread.ps1 advance -Stage DEMAND_PULSE_OPERATOR -Note "posted share pack"
#>
param(
  [Parameter(Position = 0)]
  [ValidateSet("status", "boot", "next", "advance", "history")]
  [string]$Command = "status",
  [string]$Stage = "",
  [string]$Note = "",
  [string]$Root = (Get-Location).Path
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path $Root).Path
$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) { $py = Get-Command python3 -ErrorAction SilentlyContinue }
if (-not $py) { throw "Python not found on PATH" }

$script = Join-Path $Root "ops\money\run_first_sale_thread.py"
if (-not (Test-Path $script)) { throw "Missing $script — pull latest main" }

$argsList = @($script, $Command)
if ($Command -eq "advance") {
  if (-not $Stage) { throw "-Stage required for advance" }
  $argsList += @("--stage", $Stage)
  if ($Note) { $argsList += @("--note", $Note) }
}

& $py.Source @argsList
exit $LASTEXITCODE
