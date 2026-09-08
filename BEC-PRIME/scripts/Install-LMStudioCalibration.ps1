[CmdletBinding()]
param(
  [string]$RepoRoot = (Split-Path -Parent $PSScriptRoot),
  [int]$IntervalMinutes = 15
)
$ErrorActionPreference = 'Stop'
if ($IntervalMinutes -lt 5) { throw 'IntervalMinutes must be at least 5.' }
$node = (Get-Command node -ErrorAction Stop).Source
$probe = Join-Path $RepoRoot 'kelplantis\LMStudioCalibration.js'
if (-not (Test-Path -LiteralPath $probe)) { throw "Calibration probe not found: $probe" }
$taskName = 'BrownEyeCortex-LMStudio-Calibration'
$action = New-ScheduledTaskAction -Execute $node -Argument ('"' + $probe + '"')
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
$endpoint = $env:LMSTUDIO_BASE_URL
if (-not $endpoint) { $endpoint = 'http://localhost:1234/v1' }
$bank = $env:CHATGPT_MEMORY_BANK
if (-not $bank) { $bank = 'C:\Users\GGPC\Desktop\chatgpt memory bank' }
Write-Host "Installed $taskName. Interval: $IntervalMinutes minutes."
Write-Host "LM Studio endpoint: $endpoint"
Write-Host "Memory bank: $bank"
