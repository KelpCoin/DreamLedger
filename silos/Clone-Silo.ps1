param([string]$SourceSilo = "mtg", [string]$NewSilo)
$root = "D:\DreamLedger_Actual\silos"
$src = Join-Path $root $SourceSilo
$dst = Join-Path $root $NewSilo
if (-not (Test-Path $src)) { throw "Source silo not found" }
Copy-Item $src $dst -Recurse
Write-Host "Silo cloned: $NewSilo"
