#Requires -Version 5.1
[CmdletBinding()]
param(
  [string]$RepoRoot = "",
  [string]$ProofRoot = "",
  [switch]$CycleOnly,
  [switch]$NoScheduledWorker
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$Branch = 'feat/cube-swarm-economic-traversal'
$RepoUrl = 'https://github.com/KelpCoin/DreamLedger.git'

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $base = if (Test-Path 'D:\') { 'D:\BrownEyeCortex\Runtime' } else { Join-Path $HOME 'BrownEyeCortex\Runtime' }
  $RepoRoot = Join-Path $base 'DreamLedger-cube-swarm'
}
if ([string]::IsNullOrWhiteSpace($ProofRoot)) {
  $ProofRoot = if (Test-Path 'D:\') { 'D:\BrownEyeCortex\Runtime\proofs\cube-swarm' } else { Join-Path $HOME 'BrownEyeCortex\Runtime\proofs\cube-swarm' }
}
$null = New-Item -ItemType Directory -Force -Path $ProofRoot
$proofPath = Join-Path $ProofRoot 'CUBE-SWARM-BOOTSTRAP-LATEST.json'
$logPath = Join-Path $ProofRoot ('cycle-' + [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss') + '.log')
$results = [System.Collections.Generic.List[object]]::new()

function Invoke-Logged([string]$Name,[string]$Exe,[string[]]$Args) {
  Write-Output ('PHASE=' + $Name)
  $lines = @()
  $code = 0
  Push-Location $RepoRoot
  try {
    $lines = @(& $Exe @Args 2>&1 | ForEach-Object { [string]$_ })
    $code = $LASTEXITCODE
  } catch {
    $code = 9001
    $lines += $_.Exception.Message
  } finally { Pop-Location }
  foreach ($line in $lines) { Add-Content -LiteralPath $logPath -Value $line -Encoding UTF8 }
  $status = if ($code -eq 0) { 'PASS' } else { 'BLOCKED' }
  $results.Add([ordered]@{
    name=$Name
    status=$status
    exit_code=$code
    output_tail=@($lines | Select-Object -Last 20)
  })
  Write-Output ($Name + '_STATUS=' + $status)
  return ($code -eq 0)
}

try {
  if (-not (Test-Path (Join-Path $RepoRoot '.git'))) {
    if ($CycleOnly) { throw "Cycle-only run requires an existing repository at $RepoRoot." }
    if (Test-Path $RepoRoot) {
      $items = @(Get-ChildItem -LiteralPath $RepoRoot -Force -ErrorAction SilentlyContinue)
      if ($items.Count -gt 0) { throw "Refusing to overwrite non-empty directory: $RepoRoot" }
      Remove-Item -LiteralPath $RepoRoot -Force
    }
    $git = Get-Command git.exe -ErrorAction SilentlyContinue
    if (-not $git) {
      $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
      if (-not $winget) { throw 'Git is missing and winget is unavailable. Install Git for Windows once, then rerun.' }
      & winget.exe install --id Git.Git -e --silent --accept-package-agreements --accept-source-agreements
      if ($LASTEXITCODE -ne 0) { throw "Git installation failed: $LASTEXITCODE" }
      $env:PATH = [Environment]::GetEnvironmentVariable('PATH','Machine') + ';' + [Environment]::GetEnvironmentVariable('PATH','User')
    }
    $null = New-Item -ItemType Directory -Force -Path (Split-Path -Parent $RepoRoot)
    & git.exe clone --depth 1 --branch $Branch $RepoUrl $RepoRoot
    if ($LASTEXITCODE -ne 0) { throw "Git clone failed: $LASTEXITCODE" }
  }

  $node = Get-Command node.exe -ErrorAction SilentlyContinue
  $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $node -or -not $npm) {
    if ($CycleOnly) { throw 'Node.js/npm missing during scheduled cycle. Install Node.js LTS and rerun the bootstrap.' }
    $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
    if (-not $winget) { throw 'Node.js 20+ is missing and winget is unavailable. Install Node.js LTS, then rerun.' }
    & winget.exe install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) { throw "Node.js installation failed: $LASTEXITCODE" }
    $env:PATH = [Environment]::GetEnvironmentVariable('PATH','Machine') + ';' + [Environment]::GetEnvironmentVariable('PATH','User')
    $node = Get-Command node.exe -ErrorAction SilentlyContinue
    $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if (-not $node -or -not $npm) { throw 'Node.js was installed but is not visible in PATH. Reopen PowerShell and rerun.' }
  }
  $nodeVersion = (& node.exe --version | Out-String).Trim()
  if ($nodeVersion -notmatch '^v(\d+)\.' -or [int]$Matches[1] -lt 20) { throw "Node.js 20+ required; found $nodeVersion" }

  if (-not $CycleOnly) {
    [void](Invoke-Logged 'INSTALL_NPM_DEPENDENCIES' 'npm.cmd' @('install','--no-audit','--no-fund'))
  }

  $commands = @(
    @{name='SCOUT_EXISTING_MONETIZABLE_ASSETS';exe='npm.cmd';args=@('run','scout:monetization')},
    @{name='COMPILE_ECONOMIC_OPPORTUNITIES';exe='npm.cmd';args=@('run','compile:opportunities')},
    @{name='RUN_FACTORY_AND_APPROVAL_PACKETS';exe='npm.cmd';args=@('run','factory:run')},
    @{name='RUN_UNIVERSAL_FACTORY';exe='npm.cmd';args=@('run','factory:universal')},
    @{name='VERIFY_FACTORY_ASSEMBLY';exe='npm.cmd';args=@('run','verify:factory-factory-assembly')},
    @{name='VERIFY_B2B_MARKETPLACE';exe='npm.cmd';args=@('run','verify:b2b-marketplace')},
    @{name='VERIFY_A2A_MARKETPLACE';exe='npm.cmd';args=@('run','verify:a2a-marketplace')},
    @{name='VERIFY_CUBE_SWARM_DEFINITION';exe='npm.cmd';args=@('run','verify:cube-swarm-definition')},
    @{name='TEST_AGENT_TOLL_ROADS';exe='npm.cmd';args=@('run','test:toll-roads')}
  )
  foreach ($cmd in $commands) { [void](Invoke-Logged $cmd.name $cmd.exe $cmd.args) }
  [void](Invoke-Logged 'COMPILE_DEDUPLICATED_CUBE_SWARM_BATCH' 'node.exe' @('ops/cube-swarm/opportunity-batch-controller.mjs','--max-candidates','100000','--out',(Join-Path $ProofRoot 'OPPORTUNITY-BATCH-LATEST.json')))

  $results.Add([ordered]@{
    name='INGEST_EXTERNAL_DEMAND_SIGNALS'
    status='HELD'
    reason='Supabase demand ingestion is deliberately held until the known WAL/disk incident is cleared and database health is independently verified.'
  })
  $results.Add([ordered]@{
    name='EXTERNAL_ACQUISITION'
    status='HELD_FOR_APPROVAL'
    reason='No outreach, public posting, checkout activation, or external dispatch is initiated by this bootstrap.'
  })
  if (-not [string]::IsNullOrWhiteSpace($env:STRIPE_SECRET_KEY) -and $env:STRIPE_LIVE_ENABLED -eq 'true') {
    [void](Invoke-Logged 'READ_ONLY_STRIPE_RECONCILIATION' 'npm.cmd' @('run','reconcile:first-dollar'))
  } else {
    $results.Add([ordered]@{name='READ_ONLY_STRIPE_RECONCILIATION';status='SKIPPED';reason='Requires explicitly configured STRIPE_SECRET_KEY and STRIPE_LIVE_ENABLED=true.'})
  }

  if (-not $CycleOnly -and -not $NoScheduledWorker) {
    $taskName = 'DreamLedger-Cube-Swarm-Opportunity-Worker'
    $scriptInRepo = Join-Path $RepoRoot 'scripts\beck-cube-swarm-bootstrap.ps1'
    if (-not (Test-Path $scriptInRepo)) { throw "Bootstrap script not found in repository: $scriptInRepo" }
    $ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $argument = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + $scriptInRepo + '" -RepoRoot "' + $RepoRoot + '" -ProofRoot "' + $ProofRoot + '" -CycleOnly'
    $action = New-ScheduledTaskAction -Execute $ps -Argument $argument
    $triggers = @(
      (New-ScheduledTaskTrigger -AtLogOn),
      (New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) -RepetitionInterval (New-TimeSpan -Minutes 30) -RepetitionDuration (New-TimeSpan -Days 3650))
    )
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 25) -MultipleInstances IgnoreNew
    $principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $triggers -Settings $settings -Principal $principal -Description 'Runs bounded CUBE opportunity inventory and the existing economic substrate. No public dispatch, no spend, no Supabase writes.' -Force | Out-Null
    Write-Output ('SCHEDULED_WORKER=' + $taskName)
    Write-Output 'SCHEDULE=AT_LOGON_AND_EVERY_30_MINUTES_WHILE_WINDOWS_IS_AVAILABLE'
  }

  $blocked = @($results | Where-Object status -eq 'BLOCKED').Count
  $held = @($results | Where-Object status -like 'HELD*').Count
  $passed = @($results | Where-Object status -eq 'PASS').Count
  $proof = [ordered]@{
    schema='DREAMLEDGER-CUBE-SWARM-BOOTSTRAP/v1'
    generated_at_utc=[DateTime]::UtcNow.ToString('o')
    status=$(if($blocked -eq 0){'CYCLE_COMPLETED_WITH_GATES'}else{'DEGRADED_EXISTING_SUBSTRATE_TRAVERSED'})
    repo_root=$RepoRoot
    branch=$Branch
    scheduled_worker=$(if(-not $CycleOnly -and -not $NoScheduledWorker){'DreamLedger-Cube-Swarm-Opportunity-Worker'}else{$null})
    candidate_batch_path=(Join-Path $ProofRoot 'OPPORTUNITY-BATCH-LATEST.json')
    passed_steps=$passed
    blocked_steps=$blocked
    held_steps=$held
    verified_revenue_nzd=0
    independent_buyers=0
    settled_external_payments=0
    fulfilled_paid_orders=0
    steps=@($results)
    guardrails=@('Candidate inventory is not verified demand.','No automatic outreach, public publishing, purchases, or spend.','No Supabase writes while database health is unverified.','Revenue remains zero until provider settlement and fulfillment evidence reconcile.')
    log_path=$logPath
  }
  $proof | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $proofPath -Encoding UTF8
  Write-Output ('CUBE_SWARM_STATUS=' + $proof.status)
  Write-Output ('CUBE_SWARM_PROOF=' + $proofPath)
  Write-Output ('CUBE_SWARM_LOG=' + $logPath)
  if ($blocked -gt 0) { exit 2 }
} catch {
  $proof = [ordered]@{
    schema='DREAMLEDGER-CUBE-SWARM-BOOTSTRAP/v1'
    generated_at_utc=[DateTime]::UtcNow.ToString('o')
    status='BLOCKED'
    error=$_.Exception.Message
    verified_revenue_nzd=0
    steps=@($results)
    log_path=$logPath
  }
  $proof | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $proofPath -Encoding UTF8
  Write-Output 'CUBE_SWARM_STATUS=BLOCKED'
  Write-Output ('CUBE_SWARM_PROOF=' + $proofPath)
  Write-Output ('ERROR=' + $_.Exception.Message)
  exit 1
}
