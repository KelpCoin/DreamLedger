[CmdletBinding()]
param(
    [string]$LmsExe = "lms",
    [int]$Port = 1234
)

$ErrorActionPreference = "Stop"

function Invoke-Lms {
    param([string[]]$Arguments)
    & $LmsExe @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "lms $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
    }
}

Write-Host "Starting llmster headless daemon..."
Invoke-Lms -Arguments @("daemon", "up")

Write-Host "Starting LM Studio-compatible API server on localhost port $Port..."
Invoke-Lms -Arguments @("server", "start", "--port", "$Port", "--bind", "127.0.0.1")

$modelsUri = "http://127.0.0.1:$Port/v1/models"
$deadline = (Get-Date).AddSeconds(20)
$models = $null
while ((Get-Date) -lt $deadline) {
    try {
        $models = Invoke-RestMethod -Uri $modelsUri -Method Get -TimeoutSec 3
        break
    } catch {
        Start-Sleep -Seconds 2
    }
}
if ($null -eq $models) {
    throw "Local API did not become healthy at $modelsUri. Worker must remain unavailable."
}

Write-Host "LMSTER local API is reachable at $modelsUri"
Write-Host "Available models (reported by API):"
$models.data | ForEach-Object { Write-Host (" - " + $_.id) }
Write-Host "No cloud job was claimed and no evidence receipt was submitted by this launcher."
Write-Host "Keep the API bound to 127.0.0.1; do not expose port $Port publicly."
