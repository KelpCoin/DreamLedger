# Verify BEC PRIME startup orchestra and LM Studio state.
[CmdletBinding()]
param()
$ErrorActionPreference="Stop"
Set-StrictMode -Version Latest
$root = if (Test-Path "D:\BrownEyeCortex\Runtime") { "D:\BrownEyeCortex\Runtime" } else { "C:\BrownEyeCortex\Runtime" }
$proof = Join-Path $root "proofs\STARTUP-ORCHESTRA-LATEST.json"
if (-not (Test-Path -LiteralPath $proof)) { throw "Startup proof missing: $proof" }
$p = Get-Content -LiteralPath $proof -Raw | ConvertFrom-Json
if ($p.status -ne "PASS") { throw "Startup orchestra FAIL: " + $p.error }
if ($p.lm_studio -ne "RUNNING") { throw "LM Studio is not RUNNING." }
if (-not $p.model_loaded) { throw "No LM Studio model is loaded." }
$lms = Get-Command lms.exe -ErrorAction SilentlyContinue
if (-not $lms) { throw "lms CLI unavailable." }
$ps = & $lms.Source ps --json 2>&1
if ($LASTEXITCODE -ne 0) { throw "lms ps failed." }
$loaded = $ps | ConvertFrom-Json
$items = @($loaded)
if ($items.Count -eq 1 -and $items[0].models) { $items=@($items[0].models) }
$match = $items | Where-Object { ([string]$_.identifier) -eq [string]$p.model -or ([string]$_.modelKey) -eq [string]$p.model }
if (-not $match) { throw "Configured model is not loaded: " + $p.model }
Write-Host "PASS: LM Studio server and model are loaded."
Write-Host ("MODEL=" + $p.model)
Write-Host ("PROOF=" + $proof)