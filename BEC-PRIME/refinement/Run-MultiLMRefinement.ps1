#Requires -Version 5.1
<##
.SYNOPSIS
    BEC PRIME - run local multi-LM refinement and deterministic candidate Gauntlet.

.DESCRIPTION
    Uses LM Studio only by default. No public post, checkout publication, or
    payment action is performed. A passing candidate is written as
    READY_FOR_APPROVAL and nothing more.

.EXAMPLE
    .\Run-MultiLMRefinement.ps1 -Signal "Commander players want a cheap deck audit before buying upgrades" -Silo mtg
#>

param(
    [Parameter(Mandatory=$true)][string]$Signal,
    [ValidateSet('mtg','commerce','media','digital')][string]$Silo = 'mtg',
    [string]$LMStudioUrl = 'http://localhost:1234/v1/chat/completions',
    [string]$Models = 'qwen2.5-coder-14b-instruct,phi-3-mini-4k-instruct,qwen2.5-coder-14b-instruct',
    [string]$Root = 'D:\BrownEyeCortex'
)

$ErrorActionPreference = 'Stop'
$Repo = Join-Path $Root 'BEC-PRIME'
if (-not (Test-Path $Repo)) { $Repo = Join-Path 'C:\BrownEyeCortex' 'BEC-PRIME' }
$Script = Join-Path $Repo 'refinement\MultiLMRefinementEngine.py'
if (-not (Test-Path $Script)) { throw "Refinement engine not found: $Script" }

$OutDir = Join-Path $Repo 'data\refinement'
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$Log = Join-Path $OutDir ('RUNNER-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')

"BEC PRIME MULTI-LM REFINEMENT" | Tee-Object -FilePath $Log
"UTC: $([DateTime]::UtcNow.ToString('o'))" | Tee-Object -FilePath $Log -Append
"SILO: $Silo" | Tee-Object -FilePath $Log -Append
"ENDPOINT: $LMStudioUrl" | Tee-Object -FilePath $Log -Append
"MODELS: $Models" | Tee-Object -FilePath $Log -Append
"SIGNAL: $Signal" | Tee-Object -FilePath $Log -Append

$Python = Get-Command python -ErrorAction SilentlyContinue
if (-not $Python) { throw 'python is not installed or not on PATH.' }
$Node = Get-Command node -ErrorAction SilentlyContinue
if (-not $Node) { throw 'node is not installed or not on PATH.' }

$Args = @(
    $Script,
    '--signal', $Signal,
    '--silo', $Silo,
    '--url', $LMStudioUrl,
    '--models', $Models,
    '--out-dir', $OutDir
)

& $Python.Source @Args 2>&1 | Tee-Object -FilePath $Log -Append
$ExitCode = $LASTEXITCODE

"EXIT_CODE: $ExitCode" | Tee-Object -FilePath $Log -Append
"LOG: $Log" | Tee-Object -FilePath $Log -Append

if ($ExitCode -eq 0) {
    Write-Host 'READY_FOR_APPROVAL: candidate passed deterministic Gauntlet.' -ForegroundColor Green
} elseif ($ExitCode -eq 1) {
    Write-Host 'QUARANTINE: candidate failed deterministic Gauntlet. No public action taken.' -ForegroundColor Yellow
} else {
    Write-Host 'ERROR: refinement run did not complete.' -ForegroundColor Red
}

exit $ExitCode
