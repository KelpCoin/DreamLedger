#requires -Version 5.1
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$taskName = 'BEC-PRIME-Startup-Orchestra'
$script = Join-Path $PSScriptRoot 'Start-BECPrimeOrchestra.ps1'
$proofRoot = 'D:\BrownEyeCortex\Runtime\proofs'
if (-not (Test-Path 'D:\')) { $proofRoot = 'C:\BrownEyeCortex\Runtime\proofs' }
New-Item -ItemType Directory -Force -Path $proofRoot | Out-Null

try {
    if (-not (Test-Path -LiteralPath $script)) { throw "Startup script missing: $script" }
    $existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($existing) { Unregister-ScheduledTask -TaskName $taskName -Confirm:$false }

    $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $script + '"')
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 2)
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null

    $task = Get-ScheduledTask -TaskName $taskName
    $args = [string]$task.Actions.Arguments
    $hidden = $args -match '(?i)-WindowStyle\s+Hidden'
    if (-not $hidden) { throw 'Startup task was not registered with hidden PowerShell window.' }

    $proof = [ordered]@{
        schema = 'BEC-PRIME-STARTUP-REPAIR/v1'
        status = 'PASS'
        task = $taskName
        hidden_window = $true
        non_interactive = ($args -match '(?i)-NonInteractive')
        repaired_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    }
    $proof | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $proofRoot 'STARTUP-REPAIR-LATEST.json') -Encoding UTF8
    Write-Host 'BEC STARTUP REPAIR PASS'
} catch {
    $proof = [ordered]@{ schema='BEC-PRIME-STARTUP-REPAIR/v1'; status='FAIL'; error=$_.Exception.Message; repaired_at_utc=(Get-Date).ToUniversalTime().ToString('o') }
    $proof | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $proofRoot 'STARTUP-REPAIR-LATEST.json') -Encoding UTF8
    throw
}
