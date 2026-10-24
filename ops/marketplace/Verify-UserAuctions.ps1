[CmdletBinding()]
param([string]$Repository = 'D:\BrownEyeCortex\DreamLedger', [string]$ProofDirectory = 'D:\BrownEyeCortex\EXECUTION\UserAuctions\proof')
$ErrorActionPreference = 'Stop'
$Verifier = Join-Path $Repository 'scripts\verify-user-auctions.cjs'
if (-not (Test-Path -LiteralPath $Verifier)) { throw "Missing verifier: $Verifier" }
$OldProof = $env:AUCTION_PROOF_DIR
try {
  $env:AUCTION_PROOF_DIR = $ProofDirectory
  & node $Verifier
  if ($LASTEXITCODE -ne 0) { throw 'Auction verification failed. Inspect test.log.' }
  Write-Output "Proof and log: $ProofDirectory"
} finally { $env:AUCTION_PROOF_DIR = $OldProof }
