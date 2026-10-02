#requires -version 5.1
[CmdletBinding()]
param(
  [switch]$Install,
  [switch]$RunNow,
  [switch]$VerifyOnly,
  [string]$RepoRoot = ""
)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::ASCII
function Resolve-RepoRoot {
  param([string]$Requested)
  if ($Requested) {
    if (-not (Test-Path (Join-Path $Requested "supabase\migrations"))) { throw "Invalid RepoRoot" }
    return (Resolve-Path $Requested).Path
  }
  $p = (Resolve-Path $PSScriptRoot).Path
  while ($p -and (Split-Path $p -Parent) -ne $p) {
    if (Test-Path (Join-Path $p "supabase\migrations")) { return $p }
    $p = Split-Path $p -Parent
  }
  throw "DreamLedger repository root not found."
}
$Repo = Resolve-RepoRoot $RepoRoot
$LogRoot = if (Test-Path "D:\") { "D:\BrownEyeCortex\logs\figure-eight" } else { Join-Path $Repo "proof\figure-eight\logs" }
$ProofDir = Join-Path $Repo "proof\figure-eight"
New-Item -ItemType Directory -Force -Path $LogRoot, $ProofDir | Out-Null
$ProofPath = Join-Path $ProofDir "always-on-proof.json"
$TaskName = "DreamLedger-FigureEight-AlwaysOn"
$Runner = Join-Path $Repo "scripts\figure-eight\FigureEight-AlwaysOn.ps1"
function Log([string]$Message) {
  Add-Content -LiteralPath (Join-Path $LogRoot "figure-eight.log") -Value ("[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message)
}
function Invoke-Worker([string]$Name) {
  $scriptPath = Join-Path $Repo ("scripts\figure-eight\workers\FigureEight-{0}.ps1" -f $Name)
  if (-not (Test-Path $scriptPath)) { Log "SKIP missing worker $Name"; return }
  try {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $scriptPath *>> (Join-Path $LogRoot ($Name + ".log"))
    Log "$Name exit=$LASTEXITCODE"
  } catch { Log "$Name error=$($_.Exception.Message)" }
}
if ($RunNow) {
  foreach ($worker in @("Controller", "Actuator", "Reconciler", "Verifier", "Learner", "Replicator")) { Invoke-Worker $worker }
}
if ($Install) {
  & powercfg.exe /change standby-timeout-ac 0 | Out-Null
  & powercfg.exe /change hibernate-timeout-ac 0 | Out-Null
  & powercfg.exe /change monitor-timeout-ac 15 | Out-Null
  $q = [char]34
  $arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File " + $q + $Runner + $q + " -RunNow"
  $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $arguments
  $trigger = New-ScheduledTaskTrigger -Once -At ((Get-Date).AddMinutes(1))
  $trigger.RepetitionInterval = New-TimeSpan -Minutes 5
  $trigger.RepetitionDuration = New-TimeSpan -Days 3650
  $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
  Log "Installed $TaskName. AC sleep and hibernate disabled."
}
$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
$proof = [ordered]@{
  schema = "dreamledger.figure_eight.always_on.v1"
  generated_at_utc = (Get-Date).ToUniversalTime().ToString("o")
  repository_root = $Repo
  task_name = $TaskName
  task_installed = [bool]$task
  policy = @{ ac_sleep_minutes = 0; ac_hibernate_minutes = 0; monitor_timeout_minutes = 15; worker_interval_minutes = 5 }
  economic_truth = @{ verified_external_revenue_nzd = 0; settled_external_payments = 0; independent_external_buyers = 0; verified_economic_outcomes = 0 }
}
$proof | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $ProofPath -Encoding ASCII
Write-Host ("FIGURE EIGHT ALWAYS-ON: task_installed={0}" -f [bool]$task)
Write-Host ("Proof: " + $ProofPath)
if ($VerifyOnly -and -not $task) { exit 2 }
exit 0
