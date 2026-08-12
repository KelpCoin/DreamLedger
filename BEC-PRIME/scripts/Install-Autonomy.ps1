$ErrorActionPreference = 'Stop'
$RepoUrl = 'https://github.com/KelpCoin/DreamLedger.git'
$RepoRoot = 'C:\BrownEyeCortex\DreamLedger'
$DataRoot = 'D:\BrownEyeCortex\Autonomy'
$TaskName = 'BEC-DreamLedger-Autonomy'
$RunScript = Join-Path $RepoRoot 'BEC-PRIME\scripts\Run-AutonomyCycle.ps1'
$VerifyScript = Join-Path $RepoRoot 'BEC-PRIME\scripts\Verify-Autonomy.ps1'

New-Item -ItemType Directory -Force -Path 'C:\BrownEyeCortex',$DataRoot,(Join-Path $DataRoot 'logs'),(Join-Path $DataRoot 'proofs') | Out-Null

if (-not (Get-Command git.exe -ErrorAction SilentlyContinue)) { throw 'git.exe is required' }
if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) { throw 'node.exe is required' }

if (-not (Test-Path (Join-Path $RepoRoot '.git'))) {
    if (Test-Path $RepoRoot) { Remove-Item $RepoRoot -Recurse -Force }
    git clone $RepoUrl $RepoRoot
} else {
    Push-Location $RepoRoot
    try { git fetch origin; git checkout main; git pull --ff-only origin main } finally { Pop-Location }
}

$PrimeRoot = Join-Path $RepoRoot 'BEC-PRIME'
Push-Location $PrimeRoot
try { npm install --no-audit --no-fund } finally { Pop-Location }

$lmUrl = 'http://127.0.0.1:1234'
$lmStatus = 'UNAVAILABLE'
try {
    $models = Invoke-RestMethod -Uri ($lmUrl + '/v1/models') -Method Get -TimeoutSec 5
    if ($models.data -and $models.data.Count -gt 0) {
        $env:LM_STUDIO_MODEL = [string]$models.data[0].id
        $lmStatus = 'AVAILABLE'
    }
} catch { }
if (-not $env:LM_STUDIO_MODEL) { $env:LM_STUDIO_MODEL = 'local-model' }

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -ExecutionPolicy Bypass -File "{0}"' -f $RunScript)
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 15) -RepetitionDuration (New-TimeSpan -Days 3650)
$principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null

$proof = [ordered]@{
    schema = 'BEC-AUTONOMY-INSTALL-1.0'
    installed_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    repo_root = $RepoRoot
    data_root = $DataRoot
    task_name = $TaskName
    schedule = '15 minutes'
    lm_studio = $lmStatus
    lm_studio_url = $lmUrl
    public_actions = 'APPROVAL_REQUIRED'
    rabbit_mode = 'LOCKED_UNTIL_PROVEN_PAID_EVENTS'
}
$proof | ConvertTo-Json -Depth 5 | Set-Content -Encoding ASCII (Join-Path $DataRoot 'proofs\INSTALL-PROOF.json')

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $RunScript
$cycleExit = $LASTEXITCODE
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $VerifyScript
$verifyExit = $LASTEXITCODE

Write-Host ''
Write-Host 'BEC DreamLedger autonomy installed.'
Write-Host ('LM Studio: {0}' -f $lmStatus)
Write-Host ('Task: {0}' -f $TaskName)
Write-Host ('Proofs: {0}' -f (Join-Path $DataRoot 'proofs'))
Write-Host ('Logs: {0}' -f (Join-Path $DataRoot 'logs'))
Write-Host ('Cycle exit: {0}' -f $cycleExit)
Write-Host ('Verify exit: {0}' -f $verifyExit)
if ($verifyExit -ne 0) { exit $verifyExit }
