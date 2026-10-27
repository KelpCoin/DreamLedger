#requires -Version 7.0
[CmdletBinding()]
param(
  [switch]$FullLocalTest,
  [string]$CheckoutRoot = 'D:\BrownEye\_proof_sources\DreamLedger-MTG-Handoff',
  [string]$ProofRoot = 'D:\BrownEye\BROWNEYE_ARTIFACTS\BECK'
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$Branch = 'beck/mtg-paid-link-handoff-20261028'
$Repo = 'KelpCoin/DreamLedger'
$Pr = 853
$Result = [ordered]@{
  schema = 'beck/mtg-paid-link-commercial-gate/v1'
  generated_utc = [DateTime]::UtcNow.ToString('o')
  repository = $Repo
  branch = $Branch
  pull_request = $Pr
  state = 'NOT_RUN'
  real_sale_verified = $false
  financial_mutations = 0
  public_posts = 0
  production_deployments = 0
  data = [ordered]@{}
  error = $null
}
if (-not (Test-Path -LiteralPath 'D:\')) {
  $ProofRoot = Join-Path $env:LOCALAPPDATA 'BrownEye\BROWNEYE_ARTIFACTS\BECK'
  $CheckoutRoot = Join-Path $env:LOCALAPPDATA 'BrownEye\_proof_sources\DreamLedger-MTG-Handoff'
}
New-Item -ItemType Directory -Path $ProofRoot -Force | Out-Null
$ProofPath = Join-Path $ProofRoot 'BECK-MTG-FIRST-SALE-LATEST.json'
function Save-Proof {
  $payload = $Result | ConvertTo-Json -Depth 10
  [IO.File]::WriteAllText($ProofPath, $payload + [Environment]::NewLine, [Text.Encoding]::ASCII)
  Write-Host "PROOF=$ProofPath"
  Write-Host ("PROOF_SHA256=" + (Get-FileHash -LiteralPath $ProofPath -Algorithm SHA256).Hash)
  Write-Host ("VERDICT=" + $Result.state)
}
try {
  # No credentials or write scopes: public repository read-back only.
  $prUrl = "https://api.github.com/repos/$Repo/pulls/$Pr"
  $prInfo = Invoke-RestMethod -Method Get -Uri $prUrl -TimeoutSec 15 -Headers @{
    Accept = 'application/vnd.github+json'
    'User-Agent' = 'BECK-Commercial-Verifier'
  }
  if ($prInfo.head.ref -ne $Branch -or $prInfo.base.ref -ne 'main') {
    throw 'WRONG_PULL_REQUEST_BRANCH'
  }
  $Result.data.head_sha = [string]$prInfo.head.sha
  $Result.data.draft = [bool]$prInfo.draft
  $Result.data.merged = [bool]$prInfo.merged
  $Result.data.production_state = 'NOT_DEPLOYED_BY_THIS_VERIFIER'
  if ($FullLocalTest) {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'GIT_UNAVAILABLE' }
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'NODE_UNAVAILABLE' }
    if (-not (Test-Path -LiteralPath $CheckoutRoot)) {
      New-Item -ItemType Directory -Path (Split-Path -Parent $CheckoutRoot) -Force | Out-Null
      & git clone --filter=blob:none "https://github.com/$Repo.git" $CheckoutRoot | Out-Null
      if ($LASTEXITCODE -ne 0) { throw 'GIT_CLONE_FAILED' }
    }
    $origin = (& git -C $CheckoutRoot remote get-url origin 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or $origin -notmatch '^https://github\.com/KelpCoin/DreamLedger(\.git)?$') {
      throw 'REPO_ORIGIN_UNEXPECTED'
    }
    $dirty = (& git -C $CheckoutRoot status --porcelain 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or $dirty) { throw 'PROOF_CHECKOUT_HAS_LOCAL_CHANGES' }
    & git -C $CheckoutRoot fetch --no-tags origin $Branch | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'GIT_FETCH_FAILED' }
    & git -C $CheckoutRoot checkout --detach $Result.data.head_sha | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'GIT_CHECKOUT_FAILED' }
    $targets = @(
      @{ Name='syntax-lib'; Args=@('--check','BEC-PRIME/lib/mtgDiagnosticFulfillment.js') },
      @{ Name='syntax-route'; Args=@('--check','BEC-PRIME/routes/mtgDiagnostic.js') },
      @{ Name='syntax-commercial'; Args=@('--check','BEC-PRIME/routes/commercialCell.js') },
      @{ Name='legacy-test'; Args=@('BEC-PRIME/scripts/test-mtg-diagnostic.js') },
      @{ Name='paidlink-test'; Args=@('BEC-PRIME/scripts/test-mtg-paid-link-handoff.js') }
    )
    $tests = @()
    Push-Location $CheckoutRoot
    try {
      foreach ($t in $targets) {
        $argv = @($t.Args)
        $output = & node @argv 2>&1 | Out-String
        $code = $LASTEXITCODE
        $tests += [ordered]@{ name = $t.Name; exit_code = $code; output_sha256 = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($output))).ToLowerInvariant() }
        if ($code -ne 0) { throw "TEST_FAILED_$($t[0])" }
      }
    } finally { Pop-Location }
    $Result.data.local_tests = $tests
  }
  $Result.state = if ($FullLocalTest) { 'PASS_LOCAL_SOURCE_ONLY' } else { 'PASS_GITHUB_SOURCE_ONLY' }
} catch {
  $Result.state = 'BLOCKED'
  $Result.error = $_.Exception.Message
} finally {
  Save-Proof
}
if ($Result.state -eq 'BLOCKED') { exit 1 } else { exit 0 }
