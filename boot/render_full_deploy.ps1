Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

# =========================
# CONFIG (FILL THESE ONLY)
# =========================

$repoPath = "C:\BrownEyeCortex\mtg-furnace-render"

$githubRepoUrl = Read-Host "GitHub Repo URL (https://github.com/user/repo.git)"
$renderDeployHook = Read-Host "Render Deploy Hook URL (optional, press Enter to skip)"
$healthCheckUrl = Read-Host "Live service URL (e.g. https://xxxx.onrender.com)"

$artifactPath = "D:\BrownEye\BROWNEYE_ARTIFACTS\artifact_render_deploy.md"

# =========================
# VALIDATION
# =========================

if (!(Test-Path $repoPath)) {
    throw "Repo path missing: $repoPath"
}

# =========================
# GIT INITIALISE / SYNC
# =========================

cd $repoPath

if (!(Test-Path ".git")) {
    git init
}

git add -A
git commit -m "render deploy sync $(Get-Date -Format 'yyyyMMdd_HHmmss')" 2>$null

# set remote safely (idempotent)
git remote remove origin 2>$null
git remote add origin $githubRepoUrl

git branch -M main
git push -u origin main --force

# =========================
# TRIGGER RENDER DEPLOY (optional)
# =========================

if ($renderDeployHook -and $renderDeployHook.Trim() -ne "") {
    try {
        Invoke-RestMethod -Method Post -Uri $renderDeployHook | Out-Null
        Write-Host "Render deploy hook triggered"
    } catch {
        Write-Host "Render deploy hook failed (non-fatal)"
    }
}

# =========================
# VERIFY LIVE SERVICE
# =========================

Start-Sleep -Seconds 10

$health = $null
try {
    if ($healthCheckUrl -and $healthCheckUrl.Trim() -ne "") {
        $health = Invoke-RestMethod -Uri $healthCheckUrl -Method Get
    }
} catch {
    $health = "NO_RESPONSE"
}

# =========================
# PROOF ARTIFACT
# =========================

$stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

$artifact = @"
# RENDER DEPLOYMENT PROOF

Time: $stamp

## Repo
$repoPath

## GitHub
$githubRepoUrl

## Render Hook Used
$renderDeployHook

## Health Check Result
$healthCheckUrl
$health

## Status
- Git pushed to main
- Render trigger attempted (if provided)
- Health check executed

## Verification Command

git -C "$repoPath" status
"@

New-Item -ItemType Directory -Force -Path (Split-Path $artifactPath) | Out-Null
Set-Content -Path $artifactPath -Value $artifact -Encoding UTF8

# =========================
# FINAL OUTPUT
# =========================

Write-Host "DONE -> RENDER DEPLOY PIPELINE COMPLETE"
Write-Host "PROOF -> $artifactPath"