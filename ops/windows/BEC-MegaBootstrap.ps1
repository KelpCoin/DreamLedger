$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

$RepoUrl = 'https://github.com/KelpCoin/DreamLedger.git'
$Root = 'C:\BrownEyeCortex\DreamLedger'
$ProofRoot = 'D:\BrownEyeCortex\DreamLedger-Deploy\proof'

if (-not (Test-Path 'D:\')) {
    $ProofRoot = Join-Path ([Environment]::GetFolderPath('Desktop')) 'DreamLedger-Deploy\proof'
}

New-Item -ItemType Directory -Force -Path $ProofRoot | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path $Root -Parent) | Out-Null

if (-not (Test-Path (Join-Path $Root '.git'))) {
    if (Test-Path $Root) { Remove-Item -Recurse -Force $Root }
    git clone $RepoUrl $Root
} else {
    git -C $Root fetch origin --prune
    git -C $Root checkout main
    git -C $Root reset --hard origin/main
}

git -C $Root status --short
$Sha = (git -C $Root rev-parse HEAD).Trim()
$Branch = (git -C $Root rev-parse --abbrev-ref HEAD).Trim()

$Proof = [ordered]@{
    timestamp_utc = (Get-Date).ToUniversalTime().ToString('o')
    repo = $RepoUrl
    root = $Root
    branch = $Branch
    sha = $Sha
    canonical_rule = 'DreamLedger is the only active source repository.'
    migration_rule = 'DreamLogic is archived under legacy/DreamLogic.'
    local_git_ok = (Test-Path (Join-Path $Root '.git'))
}

$ProofPath = Join-Path $ProofRoot 'LOCAL-CANONICAL-TRUTH.json'
[pscustomobject]$Proof | ConvertTo-Json -Depth 20 | Set-Content -Path $ProofPath -Encoding UTF8

Write-Host ''
Write-Host 'DREAMLEDGER LOCAL BOOTSTRAP' -ForegroundColor Cyan
Write-Host '============================' -ForegroundColor Cyan
Write-Host "Root:   $Root"
Write-Host "Branch: $Branch"
Write-Host "SHA:    $Sha"
Write-Host "Proof:  $ProofPath"
Write-Host ''
Write-Host '60-second verification:' -ForegroundColor Green
Write-Host "git -C `"$Root`" status --short; git -C `"$Root`" rev-parse HEAD; Get-Content `"$ProofPath`""
