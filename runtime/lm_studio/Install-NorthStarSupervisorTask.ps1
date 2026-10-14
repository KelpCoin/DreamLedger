param(
    [switch]$Install,
    [switch]$ReplaceExisting,
    [string]$TaskName = "DreamLedger-NorthStar-Supervisor",
    [int]$IntervalSeconds = 300,
    [int]$CycleTimeoutSeconds = 900
)
$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Supervisor = Join-Path $PSScriptRoot "north_star_supervisor.py"
$Python = Get-Command python.exe -ErrorAction SilentlyContinue
if (-not $Python) { $Python = Get-Command python -ErrorAction SilentlyContinue }
if (-not $Python) { throw "Python was not found on PATH. No packages or models are installed by this script." }
if (-not (Test-Path -LiteralPath $Supervisor -PathType Leaf)) { throw "Supervisor source missing: $Supervisor" }
if ($IntervalSeconds -lt 30) { throw "IntervalSeconds must be >= 30." }
if ($CycleTimeoutSeconds -lt 60) { throw "CycleTimeoutSeconds must be >= 60." }

Write-Host "North Star supervisor task configuration"
Write-Host "  Repository: $RepoRoot"
Write-Host "  Python: $($Python.Source)"
Write-Host "  Supervisor: $Supervisor"
Write-Host "  Interval: $IntervalSeconds seconds"
Write-Host "  Cycle timeout: $CycleTimeoutSeconds seconds"
Write-Host "  Default log folder: D:\BrownEyeCortex\LAKE\FIGURE8\logs\NORTH-STAR-SUPERVISOR"
Write-Host "  External actions, payments, publication, outreach, credential changes, and revenue-truth writes are not enabled."

& $Python.Source $Supervisor --self-test
if ($LASTEXITCODE -ne 0) { throw "Offline self-test failed. No task was changed." }

$Existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($Existing -and -not $ReplaceExisting) { throw "Task '$TaskName' already exists. Nothing changed. Use -ReplaceExisting only after reviewing the existing task." }
if (-not $Install) {
    Write-Host ""
    Write-Host "DRY RUN ONLY. No scheduled task was registered, replaced, or started."
    Write-Host "To register a logon task and request an immediate start, run once with -Install."
    exit 0
}
if ($Existing -and $ReplaceExisting) {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}
$Arguments = '"{0}" --interval-seconds {1} --cycle-timeout-seconds {2}' -f $Supervisor, $IntervalSeconds, $CycleTimeoutSeconds
$Action = New-ScheduledTaskAction -Execute $Python.Source -Argument $Arguments -WorkingDirectory $RepoRoot
$Trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Description "DreamLedger local North Star supervisor. Internal bounded cycles only; no external commercial actions." | Out-Null
Start-ScheduledTask -TaskName $TaskName
Write-Host "TASK_REGISTERED_AND_START_REQUESTED=$TaskName"
Write-Host "Read supervisor-events.jsonl and cycle stdout/stderr logs for the actual state. Registration is not a cycle PASS."
