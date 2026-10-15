[CmdletBinding(SupportsShouldProcess=$true)]
param(
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-z0-9][a-z0-9-]{1,39}$')][string]$SiloName,
    [Parameter(Mandatory=$true)][ValidateNotNullOrEmpty()][string]$ProductName,
    [string]$ShortName = '',
    [ValidatePattern('^#[0-9a-fA-F]{6}$')][string]$Accent = ''
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$factory = Join-Path $PSScriptRoot 'CubeCloneFactory.js'
if (-not (Test-Path -LiteralPath $factory)) {
    throw "Canonical CUBE clone factory is missing: $factory"
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js is required. No clone has been generated.'
}
if ($SiloName -eq 'mtg') {
    throw 'The MTG master cannot be cloned over itself.'
}

$target = Join-Path (Join-Path $repoRoot 'BEC-PRIME/data/cube-clones/candidates') $SiloName
if (Test-Path -LiteralPath $target) {
    throw "Candidate already exists; refusing to overwrite: $target"
}

if ($PSCmdlet.ShouldProcess($target, 'Generate isolated CUBE candidate from the canonical MTG manifest')) {
    $argsList = @($factory, '--slug', $SiloName, '--name', $ProductName)
    if ($ShortName) { $argsList += @('--short', $ShortName) }
    if ($Accent) { $argsList += @('--accent', $Accent) }
    & node @argsList
    if ($LASTEXITCODE -ne 0) {
        throw "CUBE clone factory failed with exit code $LASTEXITCODE"
    }
    Write-Output "[HOLD] Candidate generated only. This entrypoint cannot create a remote repository, push code, deploy, publish, or enable checkout."
    Write-Output "[PROOF] $target/candidate-proof.json"
}
