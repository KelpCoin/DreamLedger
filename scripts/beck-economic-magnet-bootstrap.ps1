#Requires -Version 5.1
[CmdletBinding()]
param(
  [string]$RepoRoot = "",
  [string]$ProofRoot = "",
  [switch]$RunCycleOnly,
  [switch]$InstallScheduledWorker,
  [switch]$ConfirmExternalAcquisition
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Branch = 'fix/beck-canonical-offer-and-supabase-failure'
$RepoUrl = 'https://github.com/KelpCoin/DreamLedger.git'
if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $base = if (Test-Path 'D:\') { 'D:\BrownEyeCortex\Runtime' } else { Join-Path $HOME 'BrownEyeCortex\Runtime' }
  $RepoRoot = Join-Path $base 'DreamLedger-heartbeat'
}
if ([string]::IsNullOrWhiteSpace($ProofRoot)) {
  $ProofRoot = if (Test-Path 'D:\') { 'D:\BrownEyeCortex\Runtime\proofs' } else { Join-Path $HOME 'BrownEyeCortex\Runtime\proofs' }
}
$null = New-Item -ItemType Directory -Force -Path $ProofRoot
$logRoot = Join-Path $ProofRoot 'economic-magnet'
$null = New-Item -ItemType Directory -Force -Path $logRoot
$runId = [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss')
$logPath = Join-Path $logRoot ("cycle-" + $runId + ".log")
$proofPath = Join-Path $ProofRoot 'ECONOMIC-MAGNET-LATEST.json'
$started = [DateTime]::UtcNow
$results = [System.Collections.Generic.List[object]]::new()
$script:proofRoot = $ProofRoot

function Invoke-CycleCommand([string]$Name,[string]$Executable,[string[]]$Arguments,[int]$TimeoutSeconds=900) {
  $begin = [DateTime]::UtcNow
  Write-Output ("PHASE=" + $Name)
  $output = @()
  $exitCode = 0
  try {
    Push-Location $RepoRoot
    try {
      $output = @(& $Executable @Arguments 2>&1 | ForEach-Object { [string]$_ })
      $exitCode = $LASTEXITCODE
    } finally { Pop-Location }
  } catch {
    $exitCode = 9001
    $output += $_.Exception.Message
  }
  $tail = @($output | Select-Object -Last 30)
  $tail | ForEach-Object { Add-Content -LiteralPath $logPath -Value ([string]$_) -Encoding UTF8 }
  $status = if ($exitCode -eq 0) { 'PASS' } else { 'BLOCKED' }
  $results.Add([ordered]@{
    name=$Name; status=$status; exit_code=$exitCode
    started_at_utc=$begin.ToString('o')
    duration_seconds=[Math]::Round(([DateTime]::UtcNow-$begin).TotalSeconds,2)
    output_tail=$tail
  })
  Write-Output ($Name + "_STATUS=" + $status)
  return ($exitCode -eq 0)
}

try {
  if (-not (Test-Path (Join-Path $RepoRoot '.git'))) {
    throw "Repository is missing at $RepoRoot. Run scripts\beck-one-shot-bootstrap.ps1 first so it can safely clone the configured branch."
  }
  $node = Get-Command node.exe -ErrorAction SilentlyContinue
  $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $node -or -not $npm) { throw 'Node.js 20+ and npm are required. Install Node.js LTS and reopen PowerShell.' }
  $nodeVersion = (& node.exe --version 2>&1 | Out-String).Trim()
  if ($nodeVersion -notmatch '^v(\d+)\.' -or [int]$Matches[1] -lt 20) { throw "Node.js 20+ required; found $nodeVersion" }

  # The economic magnet fans out across the existing offer catalog, opportunity compiler,
  # universal factory, B2B/A2A contracts, and toll-road tests. It does not invent buyers.
  $commands = @(
    @{name='SCOUT_EXISTING_MONETIZABLE_SUBSTRATE';exe='npm.cmd';args=@('run','scout:monetization')},
    @{name='COMPILE_ECONOMIC_OPPORTUNITIES';exe='npm.cmd';args=@('run','compile:opportunities')},
    @{name='RUN_FACTORY_AND_APPROVAL_PACKETS';exe='npm.cmd';args=@('run','factory:run')},
    @{name='RUN_UNIVERSAL_FACTORY';exe='npm.cmd';args=@('run','factory:universal')},
    @{name='VERIFY_FACTORY_ASSEMBLY';exe='npm.cmd';args=@('run','verify:factory-factory-assembly')},
    @{name='VERIFY_B2B_MARKETPLACE';exe='npm.cmd';args=@('run','verify:b2b-marketplace')},
    @{name='VERIFY_A2A_MARKETPLACE';exe='npm.cmd';args=@('run','verify:a2a-marketplace')},
    @{name='TEST_AGENT_TOLL_ROADS';exe='npm.cmd';args=@('run','test:toll-roads')}
  )
  foreach ($cmd in $commands) {
    [void](Invoke-CycleCommand $cmd.name $cmd.exe $cmd.args)
  }

  # This reconciler is read-only, but only run with an explicitly supplied live key.
  # It does not create a payment, activate checkout, or prove fulfillment.
  if (-not [string]::IsNullOrWhiteSpace($env:STRIPE_SECRET_KEY) -and $env:STRIPE_LIVE_ENABLED -eq 'true') {
    [void](Invoke-CycleCommand 'RECONCILE_LIVE_STRIPE_FIRST_DOLLAR' 'npm.cmd' @('run','reconcile:first-dollar'))
  } else {
    $results.Add([ordered]@{
      name='RECONCILE_LIVE_STRIPE_FIRST_DOLLAR'; status='SKIPPED'
      reason='STRIPE_SECRET_KEY and STRIPE_LIVE_ENABLED=true are both required; no secrets are requested or printed.'
    })
    Write-Output 'RECONCILE_LIVE_STRIPE_FIRST_DOLLAR_STATUS=SKIPPED_NO_LIVE_CREDENTIALS'
  }

  # No Supabase writes while the known database storage incident is unresolved.
  $results.Add([ordered]@{
    name='INGEST_EXTERNAL_DEMAND_SIGNALS'; status='HELD'
    reason='The known Supabase WAL/disk incident must be cleared and health independently verified before writing demand signals.'
  })
  # External acquisition dispatch is deliberately not implicit. It can only be attempted
  # when the operator supplies the switch, a token, and an explicit approved allowlisted offer.
  if ($ConfirmExternalAcquisition) {
    $allowed = @('CMD-DIAG-29','DREAMLEDGER-BILLBOARD-50','QUOTE-COMPARE-49')
    if ([string]::IsNullOrWhiteSpace($env:DISPATCH_TOKEN)) { throw 'External acquisition confirmation supplied but DISPATCH_TOKEN is absent; no dispatch occurred.' }
    if ($env:APPROVAL -cne 'APPROVED') { throw 'External acquisition requires APPROVAL=APPROVED explicitly in the environment.' }
    if ([string]::IsNullOrWhiteSpace($env:OFFER) -or $env:OFFER -cnotin $allowed) { throw 'Set OFFER explicitly to an allowlisted SKU. No default offer is selected for external dispatch.' }
    [void](Invoke-CycleCommand 'DISPATCH_EXPLICITLY_APPROVED_ACQUISITION' 'npm.cmd' @('run','dispatch:approved-acquisition'))
  } else {
    $results.Add([ordered]@{
      name='EXTERNAL_ACQUISITION_DISPATCH'; status='HELD_FOR_EXPLICIT_APPROVAL'
      reason='No public transmission or acquisition dispatch is initiated automatically.'
    })
  }

  $blocked = @($results | Where-Object { $_.status -in @('BLOCKED','HELD') }).Count
  $passed = @($results | Where-Object status -eq 'PASS').Count
  $proof = [ordered]@{
    schema='DREAMLEDGER-ECONOMIC-MAGNET/v1'
    generated_at_utc=[DateTime]::UtcNow.ToString('o')
    run_id=$runId
    status=$(if($blocked -eq 0){'CYCLE_COMPLETED_WITH_GATES'}else{'DEGRADED_EXISTING_SUBSTRATE_TRAVERSED'})
    repo_root=$RepoRoot
    branch=$Branch
    run_started_at_utc=$started.ToString('o')
    duration_seconds=[Math]::Round(([DateTime]::UtcNow-$started).TotalSeconds,2)
    passed_steps=$passed
    blocked_or_held_steps=$blocked
    steps=@($results)
    revenue_truth=[ordered]@{
      verified_revenue_nzd=0
      independent_buyers=0
      settled_external_payments=0
      fulfilled_paid_orders=0
      verified_outcomes=0
      rule='Only provider-backed independent payment, settlement, fulfillment, delivery evidence, and reconciliation can change revenue truth.'
    }
    strategy='Traverse existing economic substrate; fan out candidate compilation and contract verification; prioritize one offer and one CTA; keep unproven or database-dependent mechanisms held.'
    log_path=$logPath
    no_claims=@('This cycle does not guarantee sales or wealth.','Compilation and opportunity counts are not buyer demand.','Stripe API access or checkout sessions are not settled revenue.','No database writes were attempted.')
  }
  $proof | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $proofPath -Encoding UTF8
  Write-Output ("ECONOMIC_MAGNET_STATUS=" + $proof.status)
  Write-Output ("ECONOMIC_MAGNET_PROOF=" + $proofPath)
  Write-Output ("ECONOMIC_MAGNET_LOG=" + $logPath)
} catch {
  $proof = [ordered]@{
    schema='DREAMLEDGER-ECONOMIC-MAGNET/v1'
    generated_at_utc=[DateTime]::UtcNow.ToString('o')
    run_id=$runId
    status='BLOCKED'
    error=$_.Exception.Message
    steps=@($results)
    revenue_truth=[ordered]@{verified_revenue_nzd=0;independent_buyers=0;settled_external_payments=0;fulfilled_paid_orders=0;verified_outcomes=0}
    log_path=$logPath
  }
  $proof | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $proofPath -Encoding UTF8
  Write-Output ("ECONOMIC_MAGNET_STATUS=BLOCKED")
  Write-Output ("ECONOMIC_MAGNET_PROOF=" + $proofPath)
  Write-Output ("ERROR=" + $_.Exception.Message)
  exit 1
}

if (-not $RunCycleOnly -and $InstallScheduledWorker) {
  $taskName = 'DreamLedger-Economic-Magnet-Worker'
  $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + $PSCommandPath + '" -RepoRoot "' + $RepoRoot + '" -ProofRoot "' + $ProofRoot + '" -RunCycleOnly')
  $triggerLogon = New-ScheduledTaskTrigger -AtLogOn
  $triggerRepeat = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) -RepetitionInterval (New-TimeSpan -Minutes 30) -RepetitionDuration (New-TimeSpan -Days 3650)
  $principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 25) -MultipleInstances IgnoreNew
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger @($triggerLogon,$triggerRepeat) -Principal $principal -Settings $settings -Description 'DreamLedger economic candidate and commercial contract traversal; no automatic public dispatch or DB writes.' -Force | Out-Null
  Write-Output ("SCHEDULED_WORKER=" + $taskName)
  Write-Output 'SCHEDULE=AT_LOGON_AND_EVERY_30_MINUTES_WHILE_USER_SESSION_AVAILABLE'
}
if (-not $RunCycleOnly -and -not $InstallScheduledWorker) {
  Write-Output 'TIP=Re-run with -InstallScheduledWorker to schedule a recurring 30-minute cycle.'
}
exit 0
