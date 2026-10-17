#Requires -Version 5.1
[CmdletBinding()]
param(
    [int]$Port = 1234,
    [switch]$SkipTaskRegistration
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$DataRoot = if (Test-Path 'D:\') { 'D:\BrownEyeCortex' } else { Join-Path $HOME 'BrownEyeCortex' }
$InstallRoot = Join-Path $DataRoot 'Runtime\LMStudioCouncil'
$ProofRoot = Join-Path $DataRoot 'Runtime\proofs'
$LogRoot = Join-Path $DataRoot 'logs'
$BackupRoot = Join-Path $DataRoot 'backups\LMStudioCouncil'
$BootstrapPath = Join-Path $InstallRoot 'Bootstrap-LMStudioCouncil.ps1'
$VerifierPath = Join-Path $InstallRoot 'Verify-LMStudioThreeRoleReadiness.ps1'
$InstallProofPath = Join-Path $ProofRoot 'BEC-THREE-ROLE-INSTALLER-LATEST.json'
$RuntimeProofPath = Join-Path $ProofRoot 'LM-COUNCIL-BOOTSTRAP-PROOF.json'
$ReadinessProofPath = Join-Path $ProofRoot 'LMSTUDIO-THREE-ROLE-READINESS.json'
$LogPath = Join-Path $LogRoot 'BEC-ThreeRole-LocalRuntime-Installer.log'
$SourceCommit = 'ce1a015d59ff7fa3b30fa11d73ea00dc9a5be46e'
$RawBase = "https://raw.githubusercontent.com/KelpCoin/DreamLedger/$SourceCommit/BEC-PRIME/scripts"
$null = New-Item -ItemType Directory -Force -Path $InstallRoot,$ProofRoot,$LogRoot,$BackupRoot

function Write-Log([string]$Message) {
    $line = "[$([DateTime]::UtcNow.ToString('o'))] $Message"
    Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
    Write-Host $Message
}
function Write-JsonAtomic([string]$Path,[object]$Value) {
    $tmp = "$Path.tmp"
    $Value | ConvertTo-Json -Depth 14 | Set-Content -LiteralPath $tmp -Encoding UTF8
    Move-Item -LiteralPath $tmp -Destination $Path -Force
}
function Install-PinnedSource([string]$FileName,[string]$Url,[string[]]$RequiredMarkers) {
    $destination = Join-Path $InstallRoot $FileName
    $temp = "$destination.download"
    if (Test-Path -LiteralPath $destination) {
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $backup = Join-Path $BackupRoot ($FileName + '.' + $stamp + '.bak')
        Copy-Item -LiteralPath $destination -Destination $backup -Force
        Write-Log "BACKUP=$backup"
    }
    Write-Log "FETCH_SOURCE=$Url"
    Invoke-WebRequest -Uri $Url -OutFile $temp -UseBasicParsing -TimeoutSec 60
    $text = Get-Content -LiteralPath $temp -Raw
    foreach ($marker in $RequiredMarkers) {
        if (-not $text.Contains($marker)) { Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue; throw "Pinned source did not contain expected marker '$marker': $FileName" }
    }
    $sha = (Get-FileHash -LiteralPath $temp -Algorithm SHA256).Hash.ToLowerInvariant()
    Move-Item -LiteralPath $temp -Destination $destination -Force
    Write-Log "INSTALLED_SOURCE=$destination SHA256=$sha"
    return [ordered]@{ file=$FileName; path=$destination; sha256=$sha; source_url=$Url }
}

$runStatus = 'INSTALLING'
$sourceFiles = @()
$taskName = 'DreamLedger-LMStudio-Three-Role-Council'
$taskRegistered = $false
$bootstrapExit = $null
$errorText = $null
try {
    Write-Log "INSTALL_START source_commit=$SourceCommit data_root=$DataRoot port=$Port"
    $sourceFiles += Install-PinnedSource -FileName 'Verify-LMStudioThreeRoleReadiness.ps1' -Url "$RawBase/Verify-LMStudioThreeRoleReadiness.ps1" -RequiredMarkers @('BEC-LMSTUDIO-THREE-ROLE-READINESS/v2','VISUAL_ROLE_OK','PASS_GPU_MEMORY_AND_INFERENCE_ACTIVITY_OBSERVED')
    $sourceFiles += Install-PinnedSource -FileName 'Bootstrap-LMStudioCouncil.ps1' -Url "$RawBase/Bootstrap-LMStudioCouncil.ps1" -RequiredMarkers @('BEC-LM-COUNCIL-BOOTSTRAP/v2','THREE_DISTINCT_ROLES_INFERENCE_VERIFIED','NO_PUBLIC_POST_WITHOUT_APPROVAL')

    if (-not $SkipTaskRegistration) {
        $taskArgs = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + $BootstrapPath + '" -Port ' + $Port + ' -Root "' + $InstallRoot + '" -ProofRoot "' + $ProofRoot + '"'
        $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $taskArgs
        $triggerLogon = New-ScheduledTaskTrigger -AtLogOn
        $triggerRepeat = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 15) -RepetitionDuration (New-TimeSpan -Days 3650)
        $principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
        $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 3) -MultipleInstances IgnoreNew
        Register-ScheduledTask -TaskName $taskName -Action $action -Trigger @($triggerLogon,$triggerRepeat) -Principal $principal -Settings $settings -Description 'Maintains the three-role LM Studio local runtime; fails closed without vision and GPU proof.' -Force | Out-Null
        $taskRegistered = $true
        Write-Log "TASK_REGISTERED=$taskName SCHEDULE=LOGON_AND_EVERY_15_MINUTES"
    }

    Write-Log 'LOCAL_MODEL_BOOTSTRAP_START'
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $BootstrapPath -Port $Port -Root $InstallRoot -ProofRoot $ProofRoot
    $bootstrapExit = $LASTEXITCODE
    if ($bootstrapExit -eq 0 -and (Test-Path -LiteralPath $ReadinessProofPath) -and (Test-Path -LiteralPath $RuntimeProofPath)) {
        $readiness = Get-Content -LiteralPath $ReadinessProofPath -Raw | ConvertFrom-Json
        $runtime = Get-Content -LiteralPath $RuntimeProofPath -Raw | ConvertFrom-Json
        if ($readiness.status -eq 'PASS' -and $readiness.readiness -eq 'THREE_DISTINCT_ROLES_INFERENCE_AND_LOADED_STATE_VERIFIED' -and $runtime.status -eq 'PASS' -and @($readiness.roles).Count -eq 3) {
            $runStatus = 'PASS_THREE_ROLES_LOADED_AND_TESTED'
        } else {
            $runStatus = 'INSTALLED_BUT_RUNTIME_BLOCKED'
            $errorText = 'Bootstrap returned exit 0 but the machine-readable readiness contract did not pass.'
        }
    } else {
        $runStatus = 'INSTALLED_BUT_RUNTIME_BLOCKED'
        $errorText = "Runtime bootstrap exit=$bootstrapExit. The task and proof paths remain available for diagnosis."
    }
} catch {
    $runStatus = if ($taskRegistered) { 'INSTALLED_BUT_RUNTIME_BLOCKED' } else { 'INSTALL_FAILED' }
    $errorText = $_.Exception.Message
    Write-Log "ERROR=$errorText"
}

$proof = [ordered]@{
    schema='BEC-THREE-ROLE-INSTALLER/v1'
    generated_at_utc=[DateTime]::UtcNow.ToString('o')
    status=$runStatus
    source_commit=$SourceCommit
    source_files=@($sourceFiles)
    install_root=$InstallRoot
    proof_root=$ProofRoot
    bootstrap_script=$BootstrapPath
    verifier_script=$VerifierPath
    local_runtime_proof=$RuntimeProofPath
    three_role_proof=$ReadinessProofPath
    log=$LogPath
    scheduled_task=$taskName
    scheduled_task_registered=$taskRegistered
    scheduled_task_schedule='At current-user logon and every 15 minutes; no administrator elevation requested.'
    bootstrap_exit_code=$bootstrapExit
    verified_revenue_nzd=0
    economic_truth='This artifact proves installation state only. Revenue stays NZD 0.00 until independent buyer, settled attributed payment, fulfillment, delivery and reconciliation are proven.'
    safety='Local localhost inference only. No Stripe actions, Supabase writes, public messages, paid spend, deployment or external posting.'
    error=$errorText
}
Write-JsonAtomic -Path $InstallProofPath -Value $proof
Write-Log "INSTALL_FINISH status=$runStatus proof=$InstallProofPath log=$LogPath"
Write-Host "INSTALL_STATUS=$runStatus"
Write-Host "INSTALL_PROOF=$InstallProofPath"
Write-Host "THREE_ROLE_PROOF=$ReadinessProofPath"
Write-Host "COUNCIL_PROOF=$RuntimeProofPath"
Write-Host "LOG=$LogPath"
if ($runStatus -ne 'PASS_THREE_ROLES_LOADED_AND_TESTED') { exit 2 }
exit 0
