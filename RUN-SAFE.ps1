param([string]$script)

$lock = "C:\BrownEyeCortex\ledger\ledger.lock"

if (!(Test-Path $lock)) { throw "Ledger lock missing" }

Write-Host "RUNNING SAFE PIPELINE: $script"

$proc = Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File $script" -Wait -PassThru

if ($proc.ExitCode -ne 0) {
    throw "PIPELINE FAILURE: $script"
}
