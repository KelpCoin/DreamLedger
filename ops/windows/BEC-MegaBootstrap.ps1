$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

$RepoUrl = 'https://github.com/KelpCoin/DreamLedger.git'
$Root = 'C:\BrownEyeCortex\DreamLedger'
$ProofRoot = 'D:\BrownEyeCortex\DreamLedger-Deploy\proof'
$DataRoot = 'D:\BrownEyeCortexData'
$LogRoot = Join-Path $DataRoot 'logs'

if (-not (Test-Path 'D:\')) {
    $ProofRoot = Join-Path ([Environment]::GetFolderPath('Desktop')) 'DreamLedger-Deploy\proof'
    $LogRoot = Join-Path ([Environment]::GetFolderPath('Desktop')) 'BrownEyeCortex-Logs'
}

New-Item -ItemType Directory -Force -Path $ProofRoot,$LogRoot | Out-Null
$LogPath = Join-Path $LogRoot ('BEC-MegaBootstrap-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
Start-Transcript -Path $LogPath -Force | Out-Null

try {
    New-Item -ItemType Directory -Force -Path (Split-Path $Root -Parent) | Out-Null

    if (-not (Test-Path (Join-Path $Root '.git'))) {
        if (Test-Path $Root) { Remove-Item -Recurse -Force $Root }
        git clone $RepoUrl $Root
    } else {
        git -C $Root fetch origin --prune
        git -C $Root checkout main
        git -C $Root reset --hard origin/main
    }

    $Sha = (git -C $Root rev-parse HEAD).Trim()
    $Branch = (git -C $Root rev-parse --abbrev-ref HEAD).Trim()
    $Clean = [string]::IsNullOrWhiteSpace((git -C $Root status --porcelain).Trim())
    $Registry = Test-Path (Join-Path $Root 'ops/empire/EMPIRE-REGISTRY.json')
    $EmpireHealth = Test-Path (Join-Path $Root '.github/workflows/empire-health.yml')
    $DreamLogicMirror = Test-Path (Join-Path $Root '.github/workflows/mirror-dreamlogic.yml')
    $ReleaseSpine = Test-Path (Join-Path $Root '.github/workflows/canonical-release-spine.yml')

    $Proof = [ordered]@{
        timestamp_utc = (Get-Date).ToUniversalTime().ToString('o')
        repo = $RepoUrl
        root = $Root
        branch = $Branch
        sha = $Sha
        clean = $Clean
        canonical_rule = 'DreamLedger is the only active shared source repository.'
        migration_rule = 'DreamLogic is mirrored under legacy/DreamLogic and then retired.'
        registry_present = $Registry
        empire_health_present = $EmpireHealth
        dreamlogic_mirror_present = $DreamLogicMirror
        release_spine_present = $ReleaseSpine
    }

    $ProofPath = Join-Path $ProofRoot 'LOCAL-CANONICAL-TRUTH.json'
    [pscustomobject]$Proof | ConvertTo-Json -Depth 20 | Set-Content -Path $ProofPath -Encoding UTF8

    Write-Host ''
    Write-Host 'BROWNEYE CORTEX / DREAMLEDGER BOOTSTRAP' -ForegroundColor Cyan
    Write-Host '=========================================' -ForegroundColor Cyan
    Write-Host "Root:   $Root"
    Write-Host "Branch: $Branch"
    Write-Host "SHA:    $Sha"
    Write-Host "Clean:  $Clean"
    Write-Host "Proof:  $ProofPath"
    Write-Host "Log:    $LogPath"
    Write-Host ''
    Write-Host '60-second verification:' -ForegroundColor Green
    Write-Host "git -C `"$Root`" status --short; git -C `"$Root`" rev-parse HEAD; Get-Content `"$ProofPath`""
} finally {
    Stop-Transcript | Out-Null
}
