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
$Launcher = Join-Path $PSScriptRoot "Start-NorthStarLocal.ps1"
$Audit = Join-Path $PSScriptRoot "north_star_priority_audit.py"
$PythonCommand = Get-Command python.exe -ErrorAction SilentlyContinue
$PythonPath = if ($PythonCommand) { $PythonCommand.Source } else { $null }
if (-not $PythonPath -and (Test-Path "C:\Python314\python.exe")) { $PythonPath = "C:\Python314\python.exe" }
if (-not $PythonPath) { $PythonCommand = Get-Command python -ErrorAction SilentlyContinue; if ($PythonCommand) { $PythonPath = $PythonCommand.Source } }
if (-not $PythonPath) { throw "Python was not found. Nothing was registered." }
if (-not (Test-Path -LiteralPath $Supervisor -PathType Leaf)) { throw "Supervisor source missing: $Supervisor" }
if (-not (Test-Path -LiteralPath $Launcher -PathType Leaf)) { throw "Local launcher source missing: $Launcher" }
if (-not (Test-Path -LiteralPath $Audit -PathType Leaf)) { throw "Priority audit source missing: $Audit" }
$Lms = Get-Command lms.exe -ErrorAction SilentlyContinue
if (-not $Lms) { $Lms = Get-Command lms -ErrorAction SilentlyContinue }
if (-not $Lms) {
    $LmsCandidates = @(
        (Join-Path $env:USERPROFILE ".lmstudio\bin\lms.exe"),
        (Join-Path $env:LOCALAPPDATA "Programs\LM Studio\resources\app\.webpack\lms.exe"),
        (Join-Path $env:LOCALAPPDATA "Programs\LM Studio\resources\app\.webpack\bin\lms.exe")
    )
    $LmsPath = $LmsCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if (-not $LmsPath) { throw "LM Studio CLI not found. Nothing was registered." }
}
if ($IntervalSeconds -lt 30) { throw "IntervalSeconds must be >= 30." }
if ($CycleTimeoutSeconds -lt 60) { throw "CycleTimeoutSeconds must be >= 60." }

Write-Host "North Star supervisor task configuration"
Write-Host "  Repository: $RepoRoot"
Write-Host "  Python: $($PythonPath)"
Write-Host "  Supervisor: $Supervisor"
Write-Host "  Interval: $IntervalSeconds seconds"
Write-Host "  Cycle timeout: $CycleTimeoutSeconds seconds"
Write-Host "  Default log folder: D:\BrownEyeCortex\LAKE\FIGURE8\logs\NORTH-STAR-SUPERVISOR"
Write-Host "  External actions, payments, publication, outreach, credential changes, and revenue-truth writes are not enabled."

& $PythonPath $Supervisor --self-test
if ($LASTEXITCODE -ne 0) { throw "Supervisor offline self-test failed. No task was changed." }
& $PythonPath $Audit --self-test
if ($LASTEXITCODE -ne 0) { throw "Priority audit offline self-test failed. No task was changed." }

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
$Arguments = '-NoProfile -ExecutionPolicy Bypass -File "{0}" -IntervalSeconds {1} -CycleTimeoutSeconds {2}' -f $Launcher, $IntervalSeconds, $CycleTimeoutSeconds
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $Arguments -WorkingDirectory $RepoRoot
$Trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Description "DreamLedger local North Star launcher. Starts loopback LM Studio, loads three installed models, and runs local-only bounded cycles." | Out-Null
Start-ScheduledTask -TaskName $TaskName
Write-Host "TASK_REGISTERED_AND_START_REQUESTED=$TaskName"
Write-Host "Read supervisor-events.jsonl and cycle stdout/stderr logs for the actual state. Registration is not a cycle PASS."
