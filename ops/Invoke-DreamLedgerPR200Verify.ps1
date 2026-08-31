param(
  [string]$RepoPath = 'D:\BrownEyeCortex\BECKPrime',
  [string]$ExpectedHeadSha = 'd79dcae8680e75e72e13e153f45bbf8512f51ef22',
  [string]$BaseUrl = 'https://dreamledger.org',
  [switch]$RunNpm
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

$ProofRoot = 'D:\BrownEyeCortex\PROOF\PR200'
New-Item -ItemType Directory -Force -Path $ProofRoot | Out-Null
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$ProofFile = Join-Path $ProofRoot ('PR200-VERIFICATION-' + $Stamp + '.json')
$LatestFile = Join-Path $ProofRoot 'PR200-VERIFICATION-LATEST.json'

function Add-Check {
  param([hashtable]$Checks,[string]$Name,[bool]$Pass,[string]$Detail)
  $Checks[$Name] = [ordered]@{ status = $(if($Pass){'PASS'}else{'FAIL'}); detail = $Detail }
}

$checks = [ordered]@{}
Add-Check $checks 'powershell' ($PSVersionTable.PSVersion.Major -eq 5) ('PowerShell=' + $PSVersionTable.PSVersion.ToString())

if(-not (Test-Path $RepoPath)){
  Add-Check $checks 'repo_path' $false ('Missing repo path: ' + $RepoPath)
} else {
  Add-Check $checks 'repo_path' $true $RepoPath
}

$actualSha = ''
$branch = ''
if(Test-Path (Join-Path $RepoPath '.git')){
  Push-Location $RepoPath
  try {
    $actualSha = (& git.exe rev-parse HEAD 2>&1).ToString().Trim()
    $branch = (& git.exe branch --show-current 2>&1).ToString().Trim()
  } finally { Pop-Location }
  Add-Check $checks 'head_sha' ($actualSha -eq $ExpectedHeadSha) ('actual=' + $actualSha + '; expected=' + $ExpectedHeadSha)
  Add-Check $checks 'branch' ($branch -eq 'mvp-homepage-2026-08-31') ('actual=' + $branch)
} else {
  Add-Check $checks 'git_checkout' $false 'No .git directory'
}

$boundaryScript = Join-Path $RepoPath 'scripts\Verify-DreamLedgerBoundary.ps1'
if(Test-Path $boundaryScript){
  $out = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $boundaryScript -BaseUrl $BaseUrl -ExpectedSha $ExpectedHeadSha 2>&1
  $code = $LASTEXITCODE
  Add-Check $checks 'boundary' ($code -eq 0) (($out | ForEach-Object {[string]$_}) -join [Environment]::NewLine)
} else {
  Add-Check $checks 'boundary' $false 'Boundary verifier not found'
}

if($RunNpm -and (Test-Path (Join-Path $RepoPath 'package.json'))){
  Push-Location $RepoPath
  try {
    foreach($name in @('verify:ip','verify:molt-beach','verify:silos','smoke:public','verify:production-version')){
      $out = & npm.cmd run $name 2>&1
      $code = $LASTEXITCODE
      Add-Check $checks ('npm_' + $name.Replace(':','_')) ($code -eq 0) (($out | ForEach-Object {[string]$_}) -join [Environment]::NewLine)
    }
  } finally { Pop-Location }
}

$failed = @($checks.GetEnumerator() | Where-Object {$_.Value.status -eq 'FAIL'})
$overall = $(if($failed.Count -eq 0){'PASS'}else{'FAIL'})
$proof = [ordered]@{
  schema='BEC-PR200-VERIFICATION/v1'
  timestamp_utc=(Get-Date).ToUniversalTime().ToString('o')
  repository='KelpCoin/DreamLedger'
  pr=200
  expected_head_sha=$ExpectedHeadSha
  actual_head_sha=$actualSha
  branch=$branch
  base_url=$BaseUrl
  overall=$overall
  economic_state='PRE_REVENUE'
  ra_000001='UNCLAIMED'
  checks=$checks
}
$json=$proof | ConvertTo-Json -Depth 12
[System.IO.File]::WriteAllText($ProofFile,$json,(New-Object System.Text.ASCIIEncoding))
[System.IO.File]::WriteAllText($LatestFile,$json,(New-Object System.Text.ASCIIEncoding))
$hash=(Get-FileHash $LatestFile -Algorithm SHA256).Hash
Write-Host ('PR200_PROOF: ' + $overall)
Write-Host ('PROOF_FILE: ' + $LatestFile)
Write-Host ('PROOF_SHA256: ' + $hash)
if($overall -ne 'PASS'){exit 1}
