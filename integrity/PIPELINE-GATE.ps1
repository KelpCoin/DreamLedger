#Requires -Version 5.1
$ROOT   = 'C:\BrownEyeCortex'
$LEDGER = "$ROOT\ledger\event.log"
$LOCK   = "$ROOT\ledger\ledger.lock"
$errors = @()

if (-not (Test-Path $LEDGER)) { $errors += 'LEDGER_MISSING' }
if (-not (Test-Path $LOCK))   { $errors += 'LEDGER_LOCK_MISSING' }

if (Test-Path $LEDGER) {
    $lines = Get-Content $LEDGER -Encoding UTF8
    $bad   = @($lines | Where-Object { $_ -notmatch '^\s*$' } | ForEach-Object {
        try { $_ | ConvertFrom-Json -ErrorAction Stop; $null }
        catch { $_ }
    } | Where-Object { $null -ne $_ })
    if ($bad.Count -gt 0) { $errors += "MALFORMED_EVENTS:$($bad.Count)" }
}

if ($errors.Count -gt 0) {
    Write-Host "PIPELINE-GATE: FAIL  $($errors -join ', ')" -ForegroundColor Red
    exit 1
}
Write-Host 'PIPELINE-GATE: OK'
exit 0