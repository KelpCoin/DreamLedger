# =========================
# DREAMLEDGER SAFE DEPLOY RAIL
# No hallucinated HTML allowed
# Idempotent + rollback-safe
# =========================
$ErrorActionPreference = "Stop"
$RepoPath = "C:\BrownEyeCortex\dreamledger\site"
$FinalHtmlPath = "C:\BrownEyeCortex\dreamledger\FINAL_HTML.html"
$ArtifactDir = "D:\BrownEyeCortex\_artifacts\DreamLedger"
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
New-Item -ItemType Directory -Force -Path $ArtifactDir | Out-Null
Write-Host "== DREAMLEDGER SAFE DEPLOY START =="
cd $RepoPath

# Step 1: Hard validation gate
if (!(Test-Path $FinalHtmlPath)) {
    Write-Host "BLOCKED: FINAL_HTML.html not found"
    Write-Host "Expected path: $FinalHtmlPath"
    Write-Host "Deploy aborted (no guessing allowed)"
    exit 1
}
$FINAL_HTML = Get-Content $FinalHtmlPath -Raw
if ($FINAL_HTML.Length -lt 200) {
    Write-Host "BLOCKED: FINAL HTML appears too small / invalid"
    exit 1
}
# Step 2: Backup current state
if (Test-Path "$RepoPath\index.html") {
    Copy-Item "$RepoPath\index.html" "$ArtifactDir\index_backup_$Timestamp.html" -Force
}
# Step 3: Replace index.html
Set-Content -Path "$RepoPath\index.html" -Value $FINAL_HTML -Encoding UTF8
# Step 4: Git commit + push
git add index.html
git commit -m "Deploy DreamLedger final audit landing page"
git push
# Step 5: Proof artifact
$report = @"
DreamLedger Deploy Proof
Timestamp: $Timestamp
Repo: $RepoPath
Source: $FinalHtmlPath
Backup: $ArtifactDir\index_backup_$Timestamp.html
Action: index.html replaced + pushed to origin/main
"@
$report | Out-File "$ArtifactDir\deploy_$Timestamp.txt" -Encoding UTF8
Write-Host "== DEPLOY COMPLETE =="
Write-Host "Proof: $ArtifactDir\deploy_$Timestamp.txt"
