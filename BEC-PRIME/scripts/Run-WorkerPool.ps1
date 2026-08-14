param(
    [int]$PollSeconds = 10,
    [switch]$Once
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $Root 'data\worker-runtime'
$LogPath = Join-Path $LogDir 'worker.log'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Write-WorkerLog([string]$Message) {
    $line = "{0} {1}" -f (Get-Date).ToUniversalTime().ToString('o'), $Message
    Add-Content -LiteralPath $LogPath -Value $line
    Write-Host $line
}

function Invoke-WorkerOnce {
    Push-Location $Root
    try {
        $output = & node runtime/worker-pool.js run-once 2>&1 | Out-String
        $exitCode = $LASTEXITCODE
        Add-Content -LiteralPath $LogPath -Value $output.TrimEnd()
        if ($exitCode -ne 0) {
            Write-WorkerLog "worker exit code $exitCode"
            return $false
        }
        Write-WorkerLog 'worker cycle complete'
        return $true
    }
    finally {
        Pop-Location
    }
}

Write-WorkerLog 'BEC Prime local worker starting'
Write-WorkerLog 'LM Studio endpoint: ' + ($(if ($env:BEC_LM_URL) { $env:BEC_LM_URL } else { 'http://127.0.0.1:1234/v1/chat/completions' }))

if ($Once) {
    [void](Invoke-WorkerOnce)
    exit 0
}

while ($true) {
    [void](Invoke-WorkerOnce)
    Start-Sleep -Seconds ([Math]::Max(1, $PollSeconds))
}
