# DreamLedger / BECK: read-only Windows crash snapshot
# Does not change settings, stop tasks, restart services, or delete files.
$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

function Write-Section([string]$Name) {
    Write-Output ''
    Write-Output ("=== " + $Name + " ===")
}
function Run-ReadOnlyCheck([string]$Name, [scriptblock]$Action) {
    Write-Section $Name
    try { & $Action | Format-List * | Out-String -Width 240 | Write-Output }
    catch { Write-Output ("CHECK_ERROR: " + $_.Exception.Message) }
}

Write-Output "BECK_READ_ONLY_SNAPSHOT=1"
Write-Output ("CAPTURED_LOCAL=" + (Get-Date).ToString("o"))
Write-Output ("COMPUTER=" + $env:COMPUTERNAME)
Write-Output ("POWERSHELL=" + $PSVersionTable.PSVersion.ToString())

Run-ReadOnlyCheck "RECENT SYSTEM BUGCHECK / POWER / WHEA / DISPLAY / STORAGE EVENTS" {
    $ids = 1,17,18,19,20,41,46,47,1001,6008,4101,161,153,157
    Get-WinEvent -FilterHashtable @{LogName='System'; Id=$ids; StartTime=(Get-Date).AddDays(-14)} -MaxEvents 100 -ErrorAction Stop |
      Select-Object TimeCreated, Id, ProviderName, LevelDisplayName, Message
}
Run-ReadOnlyCheck "WINDOWS ERROR REPORTING BUGCHECK EVENTS" {
    Get-WinEvent -FilterHashtable @{LogName='Application'; StartTime=(Get-Date).AddDays(-14)} -MaxEvents 300 -ErrorAction Stop |
      Where-Object { $_.ProviderName -match 'Windows Error Reporting|WER-SystemErrorReporting' -or $_.Message -match 'BlueScreen|BugCheck|LiveKernelEvent' } |
      Select-Object -First 30 TimeCreated, Id, ProviderName, LevelDisplayName, Message
}
Run-ReadOnlyCheck "MINIDUMP INVENTORY (METADATA ONLY)" {
    $paths = @("$env:SystemRoot\Minidump", "$env:SystemRoot\MEMORY.DMP")
    foreach ($path in $paths) {
      if (Test-Path -LiteralPath $path -PathType Container) {
        Get-ChildItem -LiteralPath $path -File -ErrorAction SilentlyContinue |
          Select-Object FullName, Length, CreationTime, LastWriteTime
      } elseif (Test-Path -LiteralPath $path -PathType Leaf) {
        Get-Item -LiteralPath $path | Select-Object FullName, Length, CreationTime, LastWriteTime
      } else { [pscustomobject]@{Path=$path; Status='NOT_PRESENT_OR_NOT_ACCESSIBLE'} }
    }
}
Run-ReadOnlyCheck "PHYSICAL DISK HEALTH" {
    if (Get-Command Get-PhysicalDisk -ErrorAction SilentlyContinue) {
      Get-PhysicalDisk | Select-Object DeviceId, FriendlyName, OperationalStatus, HealthStatus, MediaType, Size
    } else { "Get-PhysicalDisk unavailable on this host." }
}
Run-ReadOnlyCheck "DRIVES AND FREE SPACE" {
    Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" |
      Select-Object DeviceID, VolumeName, FileSystem, Size, FreeSpace
}
Run-ReadOnlyCheck "GPU / DISPLAY DRIVER" {
    Get-CimInstance Win32_VideoController |
      Select-Object Name, DriverVersion, DriverDate, Status, PNPDeviceID
}
Run-ReadOnlyCheck "DRIVER INVENTORY (DISPLAY / STORAGE / SYSTEM)" {
    Get-CimInstance Win32_PnPSignedDriver |
      Where-Object { $_.DeviceClass -match 'DISPLAY|SCSIADAPTER|HDC|SYSTEM' -or $_.DeviceName -match 'NVIDIA|AMD|Intel.*Graphics|NVMe|Storage|Chipset' } |
      Select-Object DeviceName, DriverVersion, DriverDate, Manufacturer, InfName |
      Sort-Object DriverDate -Descending |
      Select-Object -First 40
}
Run-ReadOnlyCheck "ELOHIM / WEEKNIGHT TASKS (STATE AND ACTION SUMMARY ONLY)" {
    Get-ScheduledTask -ErrorAction Stop |
      Where-Object { $_.TaskName -match 'Elohim|Weeknight' -or $_.TaskPath -match 'Elohim|Weeknight' } |
      ForEach-Object {
        $task = $_
        $actions = ($task.Actions | ForEach-Object {
          $exe = [string]$_.Execute
          $args = [string]$_.Arguments
          if ($args.Length -gt 180) { $args = $args.Substring(0,180) + '...' }
          "$exe $args"
        }) -join ' | '
        [pscustomobject]@{TaskName=$task.TaskName; TaskPath=$task.TaskPath; State=$task.State; Actions=$actions}
      }
}
Run-ReadOnlyCheck "LM STUDIO API AVAILABILITY (NO PROMPT OR MODEL EXECUTION)" {
    try {
      $r = Invoke-RestMethod -Uri 'http://127.0.0.1:1234/v1/models' -Method Get -TimeoutSec 3
      $models = @($r.data | ForEach-Object { $_.id })
      [pscustomobject]@{Endpoint='http://127.0.0.1:1234/v1/models'; Reachable=$true; ModelIds=($models -join ', ')}
    } catch {
      [pscustomobject]@{Endpoint='http://127.0.0.1:1234/v1/models'; Reachable=$false; Error=$_.Exception.Message}
    }
}
Run-ReadOnlyCheck "RELATED SYSTEM EVENTS (WHEA / GPU / STORAGE)" {
    Get-WinEvent -FilterHashtable @{LogName='System'; StartTime=(Get-Date).AddDays(-14)} -MaxEvents 400 -ErrorAction Stop |
      Where-Object { $_.Message -match 'WHEA|BugCheck|bug check|LiveKernelEvent|Display driver|nvlddmkm|amdkmdag|disk|storport|stornvme|volmgr' } |
      Select-Object -First 40 TimeCreated, Id, ProviderName, LevelDisplayName, Message
}

Write-Output ''
Write-Output "SNAPSHOT_COMPLETE=1"
Write-Output "READ_ONLY=1"
Write-Output "NOTE=Event text may include local paths or device identifiers; review/redact personal data before sharing."
