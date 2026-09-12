# BrownEye Cortex local mailbox worker. Windows PowerShell 5.1 compatible.
# Safe boundary: only allowlisted local handlers may execute. No arbitrary shell from task payload.
[CmdletBinding()]
param(
    [int]$PollSeconds = 15,
    [int]$LeaseSeconds = 300,
    [int]$MaxJobsPerCycle = 3,
    [switch]$Once
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$SupabaseUrl = $env:SUPABASE_URL
$SupabaseKey = $env:SUPABASE_SECRET_KEY
$WorkerId = if ($env:CORTEX_WORKER_ID) { $env:CORTEX_WORKER_ID } else { 'cortex-windows-local' }
if (-not $SupabaseUrl -or -not $SupabaseKey) { throw 'SUPABASE_URL and SUPABASE_SECRET_KEY are required' }

function Invoke-Supabase {
    param([string]$Method,[string]$Path,[object]$Body=$null)
    $headers = @{ apikey=$SupabaseKey; Authorization="Bearer $SupabaseKey"; Accept='application/json'; 'Content-Type'='application/json'; Prefer='return=representation' }
    $uri = ($SupabaseUrl.TrimEnd('/') + '/rest/v1/' + $Path)
    $json = if ($null -ne $Body) { $Body | ConvertTo-Json -Depth 20 -Compress } else { $null }
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -Body $json -TimeoutSec 30
}

function Hash-Text([string]$Text) {
    $bytes = [Text.Encoding]::UTF8.GetBytes($Text)
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-','').ToLowerInvariant() }
    finally { $sha.Dispose() }
}

function Complete-Task($Task,$Status,$Result,$ErrorText=$null) {
    $body = @{ status=$Status; completed_at=(Get-Date).ToUniversalTime().ToString('o'); result=$Result; error=$ErrorText }
    $id = [uri]::EscapeDataString([string]$Task.id)
    Invoke-Supabase -Method Patch -Path ("agent_coordination_log?id=eq.$id&claimed_by=eq." + [uri]::EscapeDataString($WorkerId)) -Body $body | Out-Null
}

function Claim-Task($Task) {
    $id = [uri]::EscapeDataString([string]$Task.id)
    $body = @{ status='claimed'; claimed_by=$WorkerId; claimed_at=(Get-Date).ToUniversalTime().ToString('o') }
    $rows = Invoke-Supabase -Method Patch -Path ("agent_coordination_log?id=eq.$id&status=eq.pending") -Body $body
    if ($rows -and @($rows).Count -gt 0) { return @($rows)[0] }
    return $null
}

function Run-AllowlistedHandler($Task) {
    $objective = [string]$Task.objective
    $input = if ($Task.input) { $Task.input } else { @{} }
    switch ($objective) {
        'ecosystem.verify' {
            $out = & python (Join-Path $PSScriptRoot 'ecosystem_verify.py') 2>&1
            if ($LASTEXITCODE -ne 0) { throw ($out -join "`n") }
            return @{ handler='ecosystem.verify'; output=($out -join "`n") }
        }
        'redteam.meta' {
            $out = & python -m CORTEX.redteam.cli meta 2>&1
            if ($LASTEXITCODE -ne 0) { throw ($out -join "`n") }
            return @{ handler='redteam.meta'; output=($out -join "`n") }
        }
        'cortex.manifest_probe' {
            $manifest = Join-Path $PSScriptRoot 'cortex_execution_manifest.json'
            $config = Join-Path $PSScriptRoot 'local_config.json'
            if (-not (Test-Path $config)) { throw 'CORTEX/local_config.json missing' }
            $out = & python (Join-Path $PSScriptRoot 'cortex_worker.py') --manifest $manifest --config $config 2>&1
            if ($LASTEXITCODE -ne 0) { throw ($out -join "`n") }
            return @{ handler='cortex.manifest_probe'; output=($out -join "`n") }
        }
        default { throw "Unsupported local objective: $objective" }
    }
}

function Run-Cycle {
    $tasks = @(Invoke-Supabase -Method Get -Path ("agent_coordination_log?status=eq.pending&tier=eq.local&order=created_at.asc&limit=$MaxJobsPerCycle"))
    foreach ($candidate in $tasks) {
        $task = Claim-Task $candidate
        if ($null -eq $task) { continue }
        $id = [uri]::EscapeDataString([string]$task.id)
        Invoke-Supabase -Method Patch -Path ("agent_coordination_log?id=eq.$id&claimed_by=eq." + [uri]::EscapeDataString($WorkerId)) -Body @{ status='running' } | Out-Null
        try {
            $result = Run-AllowlistedHandler $task
            $resultText = $result | ConvertTo-Json -Depth 20 -Compress
            Complete-Task $task 'completed' @{ worker_id=$WorkerId; result=$result; result_sha256=(Hash-Text $resultText) }
        } catch {
            Complete-Task $task 'failed' @{ worker_id=$WorkerId } $_.Exception.Message
        }
    }
}

do {
    Run-Cycle
    if ($Once) { break }
    Start-Sleep -Seconds $PollSeconds
} while ($true)
