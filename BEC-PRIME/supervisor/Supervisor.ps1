[CmdletBinding()]
param(
    [string]$DataRoot = 'D:\BrownEyeCortex\Supervisor',
    [string]$RepoRoot = 'C:\DreamLedger_Actual'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$job = $null
$source = $null
$workPath = $null

function Ensure-Dir([string]$Path) { New-Item -ItemType Directory -Force -Path $Path | Out-Null }
function Write-AsciiJson([string]$Path, $Object) {
    Ensure-Dir (Split-Path -Parent $Path)
    $Object | ConvertTo-Json -Depth 20 | Set-Content -Encoding ASCII -Path $Path
}
function Append-Jsonl([string]$Path, $Object) {
    Ensure-Dir (Split-Path -Parent $Path)
    $line = ($Object | ConvertTo-Json -Depth 20 -Compress) + "`n"
    $enc = New-Object System.Text.ASCIIEncoding
    $fs = [System.IO.File]::Open($Path, [System.IO.FileMode]::Append, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
    try { $bytes = $enc.GetBytes($line); $fs.Write($bytes, 0, $bytes.Length); $fs.Flush() } finally { $fs.Close() }
}
function Write-Card([string]$Text) { $Text | Set-Content -Encoding ASCII -Path $card }

$inbox = Join-Path $DataRoot 'inbox'
$working = Join-Path $DataRoot 'working'
$done = Join-Path $DataRoot 'done'
$failed = Join-Path $DataRoot 'failed'
$proofs = Join-Path $DataRoot 'proofs'
$ledger = Join-Path $DataRoot 'ledger\supervisor_events.jsonl'
$lock = Join-Path $DataRoot 'worker.lock'
$current = Join-Path $DataRoot 'CURRENT_JOB.json'
$card = Join-Path $DataRoot 'CURRENT_NEXT.txt'

Ensure-Dir $inbox; Ensure-Dir $working; Ensure-Dir $done; Ensure-Dir $failed; Ensure-Dir $proofs; Ensure-Dir (Split-Path -Parent $ledger)

if (Test-Path $lock) {
    $age = (Get-Date) - (Get-Item $lock).LastWriteTime
    if ($age.TotalMinutes -lt 10) { exit 0 }
    Remove-Item $lock -Force
}
New-Item -ItemType File -Path $lock -Force | Out-Null

try {
    $files = @(Get-ChildItem -Path $inbox -Filter '*.json' -File | Sort-Object Name)
    if ($files.Count -eq 0) {
        Write-Card "SUPERVISOR IDLE`r`nNo queued job."
        if (Test-Path $current) { Remove-Item $current -Force }
        exit 0
    }

    $source = $files[0]
    $job = Get-Content -Raw -Encoding UTF8 $source | ConvertFrom-Json
    if (-not $job.job_id) { throw 'Job missing job_id.' }
    if ($job.approval_required -eq $true) {
        $blockedProof = Join-Path $proofs ($job.job_id + '.blocked.json')
        $p = [ordered]@{ proof_version='1.0.0'; job_id=$job.job_id; generated_at=(Get-Date).ToUniversalTime().ToString('o'); status='BLOCKED'; action=$job.request; proof_path=$blockedProof; verifier=$job.verifier; message='Approval required. Supervisor did not execute the job.' }
        Write-AsciiJson $blockedProof $p
        Move-Item $source (Join-Path $failed $source.Name) -Force
        Write-AsciiJson $current $job
        Write-Card "SUPERVISOR BLOCKED`r`n$($job.job_id)`r`nApproval required."
        Append-Jsonl $ledger ([ordered]@{ at=(Get-Date).ToUniversalTime().ToString('o'); event='BLOCKED'; job_id=$job.job_id })
        exit 0
    }

    $workPath = Join-Path $working $source.Name
    Move-Item $source $workPath -Force
    $job.execution_status = 'RUNNING'
    Write-AsciiJson $current $job
    Write-Card "SUPERVISOR RUNNING`r`n$($job.job_id)`r`n$($job.request)"
    Append-Jsonl $ledger ([ordered]@{ at=(Get-Date).ToUniversalTime().ToString('o'); event='START'; job_id=$job.job_id })

    if (-not $job.command) { throw 'Job has no command.' }
    if ($job.command -notmatch '^npm run verify:[a-z0-9-]+$') { throw 'Supervisor permits only npm verifier commands.' }
    if (-not (Test-Path (Join-Path $RepoRoot 'package.json'))) { throw ('Repository not found: ' + $RepoRoot) }

    Push-Location $RepoRoot
    try { cmd.exe /c $job.command; $exitCode = $LASTEXITCODE } finally { Pop-Location }
    if ($exitCode -ne 0) { throw ('Verifier failed with exit code ' + $exitCode) }

    $job.execution_status = 'DONE'
    $proofPath = Join-Path $proofs ($job.job_id + '.json')
    $proof = [ordered]@{ proof_version='1.0.0'; job_id=$job.job_id; generated_at=(Get-Date).ToUniversalTime().ToString('o'); status='PASS'; action=$job.request; proof_path=$proofPath; verifier=$job.verifier; exit_code=0; message='Local verifier completed successfully.' }
    Write-AsciiJson $proofPath $proof
    Write-AsciiJson (Join-Path $done $source.Name) $job
    Remove-Item $workPath -Force
    Write-AsciiJson $current $job
    Write-Card "SUPERVISOR DONE`r`n$($job.job_id)`r`nProof: $proofPath"
    Append-Jsonl $ledger ([ordered]@{ at=(Get-Date).ToUniversalTime().ToString('o'); event='DONE'; job_id=$job.job_id; proof=$proofPath })
}
catch {
    $msg = $_.Exception.Message
    if ($workPath -and (Test-Path $workPath)) { try { Move-Item $workPath (Join-Path $failed $source.Name) -Force } catch {} }
    $jobId = if ($job -and $job.job_id) { $job.job_id } else { 'UNKNOWN' }
    $proofPath = Join-Path $proofs ($jobId + '.failed.json')
    $proof = [ordered]@{ proof_version='1.0.0'; job_id=$jobId; generated_at=(Get-Date).ToUniversalTime().ToString('o'); status='FAIL'; action='SUPERVISOR_TICK'; proof_path=$proofPath; message=$msg }
    Write-AsciiJson $proofPath $proof
    Write-Card "SUPERVISOR FAILED`r`n$jobId`r`n$msg`r`nProof: $proofPath"
    Append-Jsonl $ledger ([ordered]@{ at=(Get-Date).ToUniversalTime().ToString('o'); event='FAIL'; job_id=$jobId; message=$msg; proof=$proofPath })
    exit 1
}
finally {
    try { Remove-Item $lock -Force } catch {}
}
