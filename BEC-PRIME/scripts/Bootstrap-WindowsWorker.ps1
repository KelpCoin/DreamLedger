[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$RunnerToken,
    [string]$Repository = 'https://github.com/KelpCoin/DreamLedger',
    [string]$RunnerName = $env:COMPUTERNAME,
    [string]$Labels = 'self-hosted,Windows,Windows11,LMStudio,GPU'
)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$ProofRoot = if (Test-Path 'D:\') { 'D:\BrownEyeCortex\BEC-PRIME\PROOF\worker-bootstrap' } else { 'C:\BrownEyeCortex\PROOF\worker-bootstrap' }
New-Item -ItemType Directory -Force -Path $ProofRoot | Out-Null
$Log = Join-Path $ProofRoot 'bootstrap.log'
function Log($m) { $line = "$(Get-Date -Format o) $m"; Add-Content -Path $Log -Value $line; Write-Host $line }
function Cmd($exe, $args) { Log "RUN $exe $args"; & $exe @args 2>&1 | Tee-Object -FilePath $Log -Append; if ($LASTEXITCODE -ne 0) { throw "$exe failed with exit code $LASTEXITCODE" } }
try {
    Log 'BEGIN Windows worker bootstrap'
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js is required' }
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Git is required' }
    $lmUrl = if ($env:BEC_LM_URL) { $env:BEC_LM_URL } else { 'http://127.0.0.1:1234/v1/models' }
    try { Invoke-RestMethod -Uri $lmUrl -Method Get -TimeoutSec 5 | Out-Null; Log 'LM Studio API reachable' } catch { Log "LM Studio API not reachable: $($_.Exception.Message)" }
    $release = Invoke-RestMethod -Headers @{ 'User-Agent' = 'BEC-Prime-Worker-Bootstrap' } -Uri 'https://api.github.com/repos/actions/runner/releases/latest'
    $asset = $release.assets | Where-Object { $_.name -like 'actions-runner-win-x64-*.zip' } | Select-Object -First 1
    if (-not $asset) { throw 'Could not find Windows x64 GitHub Actions runner asset' }
    $RunnerDir = Join-Path $Root '.github-runner'
    New-Item -ItemType Directory -Force -Path $RunnerDir | Out-Null
    $Zip = Join-Path $RunnerDir $asset.name
    Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $Zip -UseBasicParsing
    Expand-Archive -Path $Zip -DestinationPath $RunnerDir -Force
    Remove-Item $Zip -Force
    $config = Join-Path $RunnerDir 'config.cmd'
    Cmd $config @('--unattended','--replace','--url',$Repository,'--token',$RunnerToken,'--name',$RunnerName,'--labels',$Labels,'--work','_work')
    Cmd (Join-Path $RunnerDir 'svc.cmd') @('install')
    Cmd (Join-Path $RunnerDir 'svc.cmd') @('start')
    $proof = [ordered]@{ schema_version='BEC-WINDOWS-WORKER-BOOTSTRAP-1.0'; status='PASS'; created_at=(Get-Date).ToUniversalTime().ToString('o'); repository=$Repository; runner_name=$RunnerName; labels=$Labels; runner_dir=$RunnerDir; lmstudio_url=$lmUrl; proof_log=$Log; next_action='Open GitHub Actions and dispatch BEC Worker Dispatch with runner=self-hosted and worker_preference=auto.' }
    $Proof = Join-Path $ProofRoot 'WINDOWS-WORKER-BOOTSTRAP.json'
    $proof | ConvertTo-Json -Depth 8 | Set-Content -Path $Proof -Encoding ASCII
    Log "PASS proof=$Proof"
    Write-Host "PROOF=$Proof"
    Write-Host "VERIFY=Get-Service | Where-Object { `$_.Name -like 'actions.runner*DreamLedger*' } | Select-Object Status,Name"
} catch {
    $proof = [ordered]@{ schema_version='BEC-WINDOWS-WORKER-BOOTSTRAP-1.0'; status='FAIL'; created_at=(Get-Date).ToUniversalTime().ToString('o'); error=$_.Exception.Message; log=$Log }
    $Proof = Join-Path $ProofRoot 'WINDOWS-WORKER-BOOTSTRAP.json'
    $proof | ConvertTo-Json -Depth 8 | Set-Content -Path $Proof -Encoding ASCII
    Log "FAIL $($_.Exception.Message)"
    exit 1
}
