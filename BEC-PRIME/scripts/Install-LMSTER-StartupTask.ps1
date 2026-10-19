[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$LauncherPath = (Join-Path $PSScriptRoot 'Start-LMSTER-Headless.ps1'),
    [string]$TaskName = 'DreamLedger-LMSTER-Headless'
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $LauncherPath)) {
    throw "Launcher not found: $LauncherPath"
}

$currentIdentity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$argumentLine = '-NoProfile -ExecutionPolicy Bypass -File "{0}"' -f $LauncherPath
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $argumentLine
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $currentIdentity
$principal = New-ScheduledTaskPrincipal -UserId $currentIdentity -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1) -MultipleInstances IgnoreNew

if ($PSCmdlet.ShouldProcess($TaskName, "Register current-user logon task for $LauncherPath")) {
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
    Write-Host "Registered $TaskName for $currentIdentity. It starts only the local daemon/server launcher."
    Write-Host 'It does not yet start a cloud queue consumer; the narrow authenticated gateway and worker process are not deployed.'
}
