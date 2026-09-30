param(
  [Parameter(Mandatory=$true)][string]$Models,
  [string]$Gpu = "0.35",
  [int]$ContextLength = 4096,
  [string]$LmsPath = ""
)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$script = Join-Path $repo "refinement\Run-FigureEightRuntimeProof.py"

$args = @($script, "--models", $Models, "--gpu", $Gpu, "--context-length", $ContextLength)
if ($LmsPath) { $args += @("--lms", $LmsPath) }

python @args
