#requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][ValidateSet('local_file','http_json')][string]$Source,
    [Parameter(Mandatory=$true)][string]$InputPath,
    [string]$OutputPath = 'D:\BrownEyeCortex\InverseShopping\proof\UNIVERSAL-EXTRACTION-PROOF.txt',
    [int]$MaxRetries = 2,
    [int]$MinDelayMs = 1000
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$configPath = Join-Path $PSScriptRoot 'config\sources.json'
$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$adapter = $config.sources | Where-Object { $_.id -eq $Source -and $_.enabled -eq $true }
if (-not $adapter) { throw "Source is not enabled: $Source" }
if ($adapter.policy -eq 'blocked') { throw "Source is blocked by policy: $Source" }

$proofDir = Split-Path -Parent $OutputPath
New-Item -ItemType Directory -Force -Path $proofDir | Out-Null
$started = Get-Date
$result = $null
$attempt = 0

if ($Source -eq 'local_file') {
    $dataRoot = (Join-Path $root 'data') | Resolve-Path
    $candidate = (Resolve-Path -LiteralPath $InputPath).Path
    if (-not ($candidate -eq $dataRoot.Path -or $candidate.StartsWith($dataRoot.Path + '\', [System.StringComparison]::OrdinalIgnoreCase))) {
        throw 'local_file input must remain inside BEC-PRIME\data'
    }
    $result = Get-Content -LiteralPath $candidate -Raw | ConvertFrom-Json
}
else {
    if (-not ($InputPath -match '^https://')) { throw 'http_json requires an HTTPS URL' }
    do {
        $attempt++
        try {
            if ($attempt -gt 1) { Start-Sleep -Milliseconds ($MinDelayMs * [math]::Pow(2, $attempt - 2)) }
            $result = Invoke-RestMethod -Uri $InputPath -Method Get -Headers @{ 'Accept'='application/json'; 'User-Agent'='DreamLedger-UniversalExtractor/1.0' } -TimeoutSec 15
            break
        }
        catch {
            if ($attempt -ge $MaxRetries) { throw }
        }
    } while ($true)
}

$ended = Get-Date
$proof = [ordered]@{
    schema = 'universal-extraction-proof-v1'
    status = 'PASS'
    source = $Source
    input = $InputPath
    started_at = $started.ToUniversalTime().ToString('o')
    completed_at = $ended.ToUniversalTime().ToString('o')
    duration_ms = [int](($ended - $started).TotalMilliseconds)
    attempts = [math]::Max($attempt, 1)
    result_type = if ($result -is [System.Array]) { 'array' } else { 'object' }
}

$proof | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
$proof | ConvertTo-Json -Depth 8
Write-Host "PROOF=$OutputPath"
