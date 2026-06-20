# CORTEX-MASTER-DISPATCH.ps1
$ROOT = 'C:\BrownEyeCortex'
$MANIFEST = "$ROOT\config\dispatch_manifest.json"
$LOG = "$ROOT\logs\dispatch_log.jsonl"
if (-not (Test-Path $MANIFEST)) { Write-Host "Manifest missing."; exit 1 }
$manifest = Get-Content $MANIFEST | ConvertFrom-Json
foreach ($entry in $manifest) {
    Write-Host "[$($entry.phase)] $($entry.name)  $($entry.type)"
    switch ($entry.type) {
        'dreamledger-diag' {
            Import-Module "$ROOT\modules\DreamLedger.Kernel.psm1" -Force
            Import-Module "$ROOT\modules\DreamLedger.Diagnostics.psm1" -Force
            $report = Invoke-DreamLedgerDiagnostics
            Write-Host "  Healthy: $($report.system_healthy) ($($report.verdict))"
        }
        'script' {
            $p = Join-Path $ROOT $entry.path
            if (Test-Path $p) { & powershell -ExecutionPolicy Bypass -File $p 2>&1 | Out-Null; Write-Host "  Executed" }
            else { Write-Host "  Not found (skipped)" }
        }
        'daemon-ps1' {
            $p = Join-Path $ROOT $entry.path
            if (Test-Path $p) {
                $up = $false; if ($entry.port) { try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1', $entry.port); $up = $true; $c.Close() } catch {} }
                if (-not $up) { Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$p`"" -WindowStyle Hidden; Write-Host "  Started" } else { Write-Host "  Already running" }
            } else { Write-Host "  Not found" }
        }
    }
}
@{ ts = (Get-Date).ToString('o'); ok = $true } | ConvertTo-Json -Compress | Add-Content $LOG
Write-Host "Dispatch complete."
