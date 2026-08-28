param(
    [int]$PollSeconds = 15
)

$ErrorActionPreference = 'Stop'

$PrimeRoot = 'C:\BrownEyeCortex\dreamledger\BEC-PRIME'
$RuntimeRoot = 'C:\BrownEyeCortex\dreamledger\BEC-PRIME\runtime'
$SupervisorPath = 'C:\BrownEyeCortex\dreamledger\BEC-PRIME\runtime\CommanderSupervisor.js'

$DataRoot = 'D:\BrownEyeCortex\Commander'
$LogRoot = Join-Path $DataRoot 'logs'
$ProofRoot = Join-Path $DataRoot 'proofs'
$LogPath = Join-Path $LogRoot 'commander-supervisor.log'

New-Item -ItemType Directory -Force -Path $LogRoot,$ProofRoot | Out-Null

$env:BEC_LM_URL = 'http://127.0.0.1:1235/v1/chat/completions'
$env:BEC_LM_MODEL = 'phi-3-mini-4k-instruct'
$env:BEC_COMMANDER_DATA_ROOT = $DataRoot
$env:BEC_COMMANDER_POLL_SECONDS = [string]$PollSeconds

function Write-CommanderLog([string]$Message) {
    $line = '{0} {1}' -f (Get-Date).ToUniversalTime().ToString('o'), $Message
    Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
    Write-Host $line
}

$node = (Get-Command node.exe -ErrorAction Stop).Source

Write-CommanderLog 'BEC Local Commander starting'
Write-CommanderLog ('Prime root: ' + $PrimeRoot)
Write-CommanderLog ('Supervisor: ' + $SupervisorPath)
Write-CommanderLog ('LM Studio endpoint: ' + $env:BEC_LM_URL)
Write-CommanderLog ('LM Studio model: ' + $env:BEC_LM_MODEL)

if (-not (Test-Path $PrimeRoot)) {
    throw ('Prime root missing: ' + $PrimeRoot)
}

if (-not (Test-Path $SupervisorPath)) {
    throw ('Supervisor missing: ' + $SupervisorPath)
}

Push-Location $PrimeRoot

try {
    Write-CommanderLog 'Launching CommanderSupervisor.js'

    & $node $SupervisorPath 2>&1 | ForEach-Object {
        Add-Content -LiteralPath $LogPath -Value ([string]$_) -Encoding UTF8
        Write-Host $_
    }

    if ($LASTEXITCODE -ne 0) {
        throw ('CommanderSupervisor.js exited with code ' + $LASTEXITCODE)
    }
}
finally {
    Pop-Location
}
