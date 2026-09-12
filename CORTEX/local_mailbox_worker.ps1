# BrownEye Cortex local work-ledger worker. Windows PowerShell 5.1 compatible.
# Safe boundary: only allowlisted local handlers may execute. No arbitrary shell from task payload.
[CmdletBinding()]
param(
    [int]$PollSeconds = 15,
    [int]$LeaseSeconds = 30,
    [int]$HeartbeatSeconds = 15,
    [int]$MaxJobsPerCycle = 3,
    [switch]$Once
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$SupabaseUrl = if ($env:DREAMLEDGER_SUPABASE_URL) { $env:DREAMLEDGER_SUPABASE_URL } else { $env:SUPABASE_URL }
$SupabaseKey = if ($env:DREAMLEDGER_SUPABASE_KEY) { $env:DREAMLEDGER_SUPABASE_KEY } else { $env:SUPABASE_SECRET_KEY }
$WorkerId = if ($env:DREAMLEDGER_WORKER_ID) { $env:DREAMLEDGER_WORKER_ID } elseif ($env:CORTEX_WORKER_ID) { $env:CORTEX_WORKER_ID } else { 'cortex-windows-local' }
if (-not $SupabaseUrl -or -not $SupabaseKey) { throw 'DREAMLEDGER_SUPABASE_URL and DREAMLEDGER_SUPABASE_KEY are required' }

function Invoke-Supabase {
    param([string]$Method,[string]$Path,[object]$Body=$null)
    $headers = @{ apikey=$SupabaseKey; Authorization="Bearer $SupabaseKey"; Accept='application/json'; 'Content-Type'='application/json'; Prefer='return=representation' }
    $uri = ($SupabaseUrl.TrimEnd('/') + '/rest/v1/' + $Path)
    $json = if ($null -ne $Body) { $Body | ConvertTo-Json -Depth 30 -Compress } else { $null }
    if ($null -ne $json) { return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -Body $json -TimeoutSec 30 }
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -TimeoutSec 30
}

function Invoke-SupabaseRpc {
    param([string]$Name,[hashtable]$Args)
    return Invoke-Supabase -Method Post -Path ("rpc/" + $Name) -Body $Args
}

function Hash-Text([string]$Text) {
    $bytes = [Text.Encoding]::UTF8.GetBytes($Text)
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-','').ToLowerInvariant() }
    finally { $sha.Dispose() }
}

function Start-LocalProcess {
    param([string]$FilePath,[string[]]$Arguments)
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $FilePath
    $psi.Arguments = ($Arguments | ForEach-Object { '"' + ($_ -replace '"','\"') + '"' }) -join ' '
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true
    $p = New-Object System.Diagnostics.Process
    $p.StartInfo = $psi
    [void]$p.Start()
    return $p
}

function Run-ProcessWithHeartbeat {
    param([string]$FilePath,[string[]]$Arguments,[object]$Task)
    $p = Start-LocalProcess -FilePath $FilePath -Arguments $Arguments
    $lastHeartbeat = Get-Date
    while (-not $p.HasExited) {
        Start-Sleep -Seconds 2
        if (((Get-Date) - $lastHeartbeat).TotalSeconds -ge $HeartbeatSeconds) {
            $renew = Invoke-SupabaseRpc -Name 'renew_orchestrator_task_lease' -Args @{ p_task_id=$Task.task_id; p_lease_token=$Task.lease_token; p_worker=$WorkerId; p_lease_seconds=$LeaseSeconds }
            if (-not $renew) { try { $p.Kill() } catch {} ; throw 'lease renewal failed; local process terminated' }
            $lastHeartbeat = Get-Date
        }
    }
    $stdout = $p.StandardOutput.ReadToEnd()
    $stderr = $p.StandardError.ReadToEnd()
    if ($p.ExitCode -ne 0) { throw (($stderr.Trim() + "`n" + $stdout.Trim()).Trim()) }
    return $stdout
}

function Run-AllowlistedHandler($Task) {
    switch ([string]$Task.objective) {
        'ecosystem.verify' {
            $out = Run-ProcessWithHeartbeat -FilePath 'python' -Arguments @((Join-Path $PSScriptRoot 'ecosystem_verify.py')) -Task $Task
            return @{ handler='ecosystem.verify'; output=$out }
        }
        'redteam.meta' {
            $out = Run-ProcessWithHeartbeat -FilePath 'python' -Arguments @('-m','CORTEX.redteam.cli','meta') -Task $Task
            return @{ handler='redteam.meta'; output=$out }
        }
        'cortex.manifest_probe' {
            $manifest = Join-Path $PSScriptRoot 'cortex_execution_manifest.json'
            $config = Join-Path $PSScriptRoot 'local_config.json'
            if (-not (Test-Path $config)) { throw 'CORTEX/local_config.json missing' }
            $out = Run-ProcessWithHeartbeat -FilePath 'python' -Arguments @((Join-Path $PSScriptRoot 'cortex_worker.py'),'--manifest',$manifest,'--config',$config) -Task $Task
            return @{ handler='cortex.manifest_probe'; output=$out }
        }
        default { throw "Unsupported local objective: $($Task.objective)" }
    }
}

function Run-Cycle {
    for ($i=0; $i -lt $MaxJobsPerCycle; $i++) {
        $claimed = @(Invoke-SupabaseRpc -Name 'claim_orchestrator_task' -Args @{ p_tier='local'; p_worker=$WorkerId; p_lease_seconds=$LeaseSeconds })
        if (-not $claimed -or $claimed.Count -eq 0) { break }
        $task = $claimed[0]
        try {
            $result = Run-AllowlistedHandler $task
            $resultText = $result | ConvertTo-Json -Depth 30 -Compress
            $finished = Invoke-SupabaseRpc -Name 'finish_orchestrator_task' -Args @{ p_task_id=$task.task_id; p_lease_token=$task.lease_token; p_worker=$WorkerId; p_status='done'; p_result=@{ worker_id=$WorkerId; result=$result; result_sha256=(Hash-Text $resultText) }; p_error=$null }
            if (-not $finished) { throw 'terminal result write rejected by lease guard' }
        } catch {
            try {
                Invoke-SupabaseRpc -Name 'finish_orchestrator_task' -Args @{ p_task_id=$task.task_id; p_lease_token=$task.lease_token; p_worker=$WorkerId; p_status='failed'; p_result=@{ worker_id=$WorkerId }; p_error=$_.Exception.Message } | Out-Null
            } catch {}
        }
    }
}

do {
    Run-Cycle
    if ($Once) { break }
    Start-Sleep -Seconds $PollSeconds
} while ($true)
