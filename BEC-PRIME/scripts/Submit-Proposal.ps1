param(
  [Parameter(Mandatory=$true)][string]$ProposalPath
)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptRoot
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { throw 'Node.js is required.' }
$controlLoop = Join-Path $repoRoot 'control-plane\ControlLoop.js'
if (-not (Test-Path -LiteralPath $controlLoop)) { throw "Control loop not found: $controlLoop" }
$resolvedProposal = (Resolve-Path -LiteralPath $ProposalPath).Path
& $node.Source $controlLoop $resolvedProposal
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
