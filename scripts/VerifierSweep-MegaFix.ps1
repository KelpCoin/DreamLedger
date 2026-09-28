Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Pick-DataRoot {
  if (Test-Path -LiteralPath 'D:\BrownEyeCortexData') { return 'D:\BrownEyeCortexData' }
  if (Test-Path -LiteralPath 'D:\') { return 'D:\BrownEyeCortexData' }
  return 'C:\BrownEyeCortexData'
}

function Pick-ArtifactRoot {
  if (Test-Path -LiteralPath 'D:\BrownEye\BROWNEYE_ARTIFACTS') { return 'D:\BrownEye\BROWNEYE_ARTIFACTS' }
  if (Test-Path -LiteralPath 'D:\') { return 'D:\BrownEye\BROWNEYE_ARTIFACTS' }
  return 'C:\BrownEyeCortex\_artifacts'
}

function Ensure-Dir([string]$Path) {
  if ([string]::IsNullOrWhiteSpace($Path)) { throw 'Ensure-Dir: empty path' }
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }
}

function Write-Ascii([string]$Path,[string]$Content) {
  $d = Split-Path -Parent $Path
  if ($d) { Ensure-Dir $d }
  [System.IO.File]::WriteAllText($Path,$Content,[System.Text.Encoding]::ASCII)
}

function Write-AsciiLines([string]$Path,[object[]]$Lines) {
  Write-Ascii -Path $Path -Content (($Lines | ForEach-Object { [string]$_ }) -join [Environment]::NewLine)
}

function NowStamp {
  return (Get-Date).ToString('yyyyMMdd_HHmmss')
}

$dataRoot = Pick-DataRoot
$artifactRoot = Pick-ArtifactRoot
$bin = Join-Path $dataRoot 'DoorFactory\bin'
Ensure-Dir $bin
Ensure-Dir $artifactRoot

$logRoot = 'C:\BrownEyeCortex\Logs\DoorFactory'
Ensure-Dir $logRoot

$stopFlag = Join-Path $logRoot 'STOP_VERIFIER_SWEEP.txt'
$logPath = Join-Path $logRoot 'verifier_sweep.log'

$commonPath = Join-Path $bin 'BrownEye.Common.ps1'
$verifyDoor = Join-Path $bin 'Verify-DoorServer.ps1'
$verifyRound = Join-Path $bin 'Verify-RoundSummitClosed.ps1'
$sweepPath = Join-Path $bin 'Run-VerifierSweep.ps1'
$installer = Join-Path $bin 'MegaFix_VerifierSweep_v1.ps1'

$common = @'
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
function Pick-DataRoot {
  if (Test-Path -LiteralPath 'D:\BrownEyeCortexData') { return 'D:\BrownEyeCortexData' }
  if (Test-Path -LiteralPath 'D:\') { return 'D:\BrownEyeCortexData' }
  return 'C:\BrownEyeCortexData'
}
function Pick-ArtifactRoot {
  if (Test-Path -LiteralPath 'D:\BrownEye\BROWNEYE_ARTIFACTS') { return 'D:\BrownEye\BROWNEYE_ARTIFACTS' }
  if (Test-Path -LiteralPath 'D:\') { return 'D:\BrownEye\BROWNEYE_ARTIFACTS' }
  return 'C:\BrownEyeCortex\_artifacts'
}
function Ensure-Dir([string]$Path) {
  if ([string]::IsNullOrWhiteSpace($Path)) { throw 'Ensure-Dir: empty path' }
  if (-not (Test-Path -LiteralPath $Path)) { New-Item -ItemType Directory -Path $Path -Force | Out-Null }
}
function Write-Ascii([string]$Path,[string]$Content) {
  $d = Split-Path -Parent $Path
  if ($d) { Ensure-Dir $d }
  [System.IO.File]::WriteAllText($Path,$Content,[System.Text.Encoding]::ASCII)
}
function Write-AsciiLines([string]$Path,[object[]]$Lines) {
  Write-Ascii -Path $Path -Content (($Lines | ForEach-Object { [string]$_ }) -join [Environment]::NewLine)
}
function NowStamp { return (Get-Date).ToString('yyyyMMdd_HHmmss') }
'@
Write-Ascii -Path $commonPath -Content $common

$sweep = @'
param(
  [int]$Port = 8787,
  [int]$Tail = 80
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $here 'BrownEye.Common.ps1')
$dataRoot = Pick-DataRoot
$artifactRoot = Pick-ArtifactRoot
$bin = Join-Path $dataRoot 'DoorFactory\bin'
$verifyDoor = Join-Path $bin 'Verify-DoorServer.ps1'
$verifyRound = Join-Path $bin 'Verify-RoundSummitClosed.ps1'
$logRoot = 'C:\BrownEyeCortex\Logs\DoorFactory'
Ensure-Dir $logRoot
$logPath = Join-Path $logRoot 'verifier_sweep.log'
$stopFlag = Join-Path $logRoot 'STOP_VERIFIER_SWEEP.txt'

function Append-Log([string]$line) {
  $ts = (Get-Date).ToString('o')
  [System.IO.File]::AppendAllText($logPath,($ts + ' | ' + $line + [Environment]::NewLine),[System.Text.Encoding]::ASCII)
}

if (Test-Path -LiteralPath $stopFlag) {
  Append-Log 'STOPFLAG present -> sweep skipped'
  exit 0
}

$doorExit = 98
$roundExit = 98

try {
  if (Test-Path -LiteralPath $verifyDoor) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $verifyDoor -Port $Port | Out-Null
    $doorExit = $LASTEXITCODE
  }
} catch {
  $doorExit = 99
  Append-Log ('verify_door exception=' + $_.Exception.Message)
}

try {
  if (Test-Path -LiteralPath $verifyRound) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $verifyRound -Tail $Tail | Out-Null
    $roundExit = $LASTEXITCODE
  }
} catch {
  $roundExit = 99
  Append-Log ('verify_round exception=' + $_.Exception.Message)
}

Append-Log ('door_exit=' + $doorExit + ' round_exit=' + $roundExit)

$proof = Join-Path $artifactRoot ('artifact_' + (NowStamp) + '_verifier_sweep_tick_PROOF.txt')
$lines = @(
  'ts: ' + (Get-Date).ToString('o'),
  'verify_door: ' + $verifyDoor,
  'verify_round: ' + $verifyRound,
  'door_exit: ' + $doorExit,
  'round_exit: ' + $roundExit,
  'log: ' + $logPath,
  'stopflag: ' + $stopFlag,
  'result: ' + $(if ($doorExit -eq 0 -and $roundExit -eq 0) { 'PASS' } else { 'FAIL_OR_MISSING' })
)
Write-AsciiLines -Path $proof -Lines $lines

if ($doorExit -eq 0 -and $roundExit -eq 0) { exit 0 }
exit 1
'@
Write-Ascii -Path $sweepPath -Content $sweep

$installScript = @'
param(
  [int]$Port = 8787,
  [int]$Tail = 80
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $here 'BrownEye.Common.ps1')
$dataRoot = Pick-DataRoot
$artifactRoot = Pick-ArtifactRoot
$bin = Join-Path $dataRoot 'DoorFactory\bin'
$sweepPath = Join-Path $bin 'Run-VerifierSweep.ps1'
$logRoot = 'C:\BrownEyeCortex\Logs\DoorFactory'
Ensure-Dir $logRoot
$logPath = Join-Path $logRoot 'verifier_sweep.log'
$stopFlag = Join-Path $logRoot 'STOP_VERIFIER_SWEEP.txt'
$taskName = 'BROWNEYE_VerifierSweep_1min'
$cmd = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "' + $sweepPath + '" -Port ' + $Port + ' -Tail ' + $Tail

& schtasks.exe /Query /TN $taskName *> $null 2>&1
if ($LASTEXITCODE -eq 0) { & schtasks.exe /Delete /TN $taskName /F | Out-Null }

& schtasks.exe /Create /TN $taskName /SC MINUTE /MO 1 /RU SYSTEM /RL HIGHEST /TR $cmd /F | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Failed to register BROWNEYE_VerifierSweep_1min' }

$ts = NowStamp
$proof = Join-Path $artifactRoot ('artifact_' + $ts + '_verifier_sweep_install_PROOF.txt')
$loc = Join-Path $artifactRoot ('artifact_' + $ts + '_verifier_sweep_install_LOCATOR.md')

Write-AsciiLines -Path $proof -Lines @(
  'ts: ' + (Get-Date).ToString('o'),
  'sweep_script: ' + $sweepPath,
  'log: ' + $logPath,
  'stopflag: ' + $stopFlag,
  'task: ' + $taskName,
  'verify_60s: powershell -NoProfile -ExecutionPolicy Bypass -File "' + $sweepPath + '" -Port ' + $Port + ' -Tail ' + $Tail
)

Write-AsciiLines -Path $loc -Lines @(
  'ts: ' + (Get-Date).ToString('o'),
  'proof: ' + $proof,
  'task: ' + $taskName,
  'sweep_script: ' + $sweepPath,
  'log: ' + $logPath,
  'stopflag: ' + $stopFlag
)

Write-Host ('OK -> TASK: ' + $taskName)
Write-Host ('SEALED_PROOF -> ' + $proof)
Write-Host ('LOCATOR -> ' + $loc)

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $sweepPath -Port $Port -Tail $Tail | Out-Null
exit $LASTEXITCODE
'@
Write-Ascii -Path $installer -Content $installScript

$ts = NowStamp
$bootLoc = Join-Path $artifactRoot ('artifact_' + $ts + '_verifier_sweep_megafix_LOCATOR.md')
Write-AsciiLines -Path $bootLoc -Lines @(
  'ts: ' + (Get-Date).ToString('o'),
  'installer: ' + $installer,
  'rerun: powershell -NoProfile -ExecutionPolicy Bypass -File "' + $installer + '" -Port 8787 -Tail 80',
  'tail_log: powershell -NoProfile -Command "Get-Content -LiteralPath C:\BrownEyeCortex\Logs\DoorFactory\verifier_sweep.log -Tail 30"'
)

Write-Host ('OK -> MEGAFIX installer: ' + $installer)
Write-Host ('LOCATOR -> ' + $bootLoc)
