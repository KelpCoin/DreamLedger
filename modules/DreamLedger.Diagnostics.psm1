# DreamLedger.Diagnostics.psm1
Set-StrictMode -Off; $ErrorActionPreference = 'Continue'
function Get-DiagBasePath { return if ($env:DREAMLEDGER_BASE) { $env:DREAMLEDGER_BASE } else { 'C:\BrownEyeCortex' } }
function Invoke-DreamLedgerDiagnostics {
    $base = Get-DiagBasePath
    $siteOk = $false; try { $r = Invoke-WebRequest -Uri "https://dreamledger.org" -TimeoutSec 5 -UseBasicParsing; $siteOk = ($r.StatusCode -eq 200) } catch {}
    $ledgerOk = Test-Path (Join-Path $base 'ledger\events.jsonl')
    $healthy = $siteOk -and $ledgerOk
    $verdict = if ($healthy) { 'HEALTHY' } else { 'DEGRADED' }
    return [PSCustomObject]@{ system_healthy = $healthy; verdict = $verdict; confidence = 0.9 }
}
Export-ModuleMember -Function Invoke-DreamLedgerDiagnostics
