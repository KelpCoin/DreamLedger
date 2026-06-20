# ============================================================
# CORTEX EVENT LOCKDOWN v1.0
# Enforces EventKernel as the ONLY write authority
# ============================================================
Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"
$ROOT = "C:\BrownEyeCortex"
$MODULE = "$ROOT\Modules\EventKernel.psm1"
$BACKUP = "$ROOT\_backup_event_lockdown_$(Get-Date -Format yyyyMMdd_HHmmss)"
$LOG = "$ROOT\ledger\lockdown_audit.log"
New-Item -ItemType Directory -Force -Path $BACKUP | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path $LOG) | Out-Null
Import-Module $MODULE -Force

$targets = Get-ChildItem $ROOT -Recurse -Include *.ps1,*.psm1 |
    Where-Object { $_.FullName -notmatch "\\Modules\\EventKernel.psm1" -and $_.FullName -notmatch "\\_backup_" }

function Backup-File($file) {
    $dest = Join-Path $BACKUP ($file.FullName.Replace(":\","_").Replace("\","__"))
    Copy-Item $file.FullName $dest -Force
}

$changed = 0
foreach ($f in $targets) {
    $content = Get-Content $f.FullName -Raw
    $original = $content
    if ($content -match "Add-Content.*event\.log") {
        $content = $content -replace "Add-Content[^`n]*event\.log[^`n]*`n?", ""
        $changed++
    }
    if ($content -match "ConvertTo-Json.*event" -and $content -match "@\{.*event_id") {
        $content = $content -replace '\$ev\s*=\s*\[ordered\]@\{.*?\}\s*\|\s*ConvertTo-Json.*', "New-CortexEvent -EventType 'system' -SkuId 'legacy' -Channel 'manual'"
        $changed++
    }
    if ($content -match "New-CortexEvent" -and $content -notmatch "EventKernel\.psm1") {
        $content = "Import-Module `"$MODULE`" -Force`n" + $content
    }
    if ($content -ne $original) {
        Backup-File $f
        Set-Content -Path $f.FullName -Value $content -Encoding UTF8
    }
}
$audit = Test-EventIntegrity
@{ timestamp = Get-Date -Format o; rewritten = $changed; ledger = $audit.status } | ConvertTo-Json | Set-Content "$ROOT\ledger\lockdown_report.json"
Write-Host "LOCKDOWN COMPLETE  $changed files rewritten, ledger $($audit.status)"
