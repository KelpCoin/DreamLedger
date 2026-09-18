#Requires -Version 5.1
# Minimal economic supervisor entry point.
# Owns: start checks, optional seed enqueue, hand-off to existing LocalWorker loop.
# Does NOT invent architecture. Reuses CORTEX/powershell/LocalWorker.ps1 + Supabase queue + LM Studio.
[CmdletBinding()]
param(
    [string]$LmStudioUrl = 'http://127.0.0.1:1234/v1',
    [string]$SupabaseUrl = $(if ($env:SUPABASE_URL) { $env:SUPABASE_URL } else { $env:DREAMLEDGER_SUPABASE_URL }),
    [string]$SupabaseKey = $(if ($env:SUPABASE_SECRET_KEY) { $env:SUPABASE_SECRET_KEY } else { $env:DREAMLEDGER_SUPABASE_KEY }),
    [string]$WorkerId = $(if ($env:CORTEX_WORKER_ID) { $env:CORTEX_WORKER_ID } else { "$env:COMPUTERNAME-supervisor" }),
    [switch]$SeedOnly,
    [switch]$Once,
    [switch]$SkipSeed
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$SeedPath = Join-Path $Here 'seed_economic_jobs.json'
$SpecialistsPath = Join-Path $Here 'supervisor_specialists.json'
$WorkerPath = Join-Path $Here 'powershell\LocalWorker.ps1'
$ProofDir = Join-Path $Here 'proof'
New-Item -ItemType Directory -Force -Path $ProofDir | Out-Null
$Proof = Join-Path $ProofDir ('supervisor-start-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.json')

function Log([string]$m) { Write-Host $m }

# 1) LM Studio connectivity proof
$lmOk = $false
$lmModels = @()
try {
    $resp = Invoke-RestMethod -Uri ($LmStudioUrl.TrimEnd('/') + '/models') -Method Get -TimeoutSec 8
    $lmModels = @($resp.data | ForEach-Object { [string]$_.id })
    $lmOk = ($lmModels.Count -gt 0)
} catch {
    Log "LM Studio not reachable at $LmStudioUrl : $($_.Exception.Message)"
}

if (-not $lmOk) {
    $fail = [ordered]@{
        status = 'BLOCKED'
        reason = 'LM_STUDIO_NOT_RUNNING'
        action = 'Start LM Studio local server (OpenAI-compatible on 127.0.0.1:1234), load at least one model, rerun.'
        generated_utc = [DateTime]::UtcNow.ToString('o')
    }
    $fail | ConvertTo-Json -Depth 6 | Set-Content -Path $Proof -Encoding UTF8
    Log "PROOF=$Proof"
    exit 2
}
Log ("LM Studio OK models=" + ($lmModels -join ', '))

# 2) Specialist map present
if (-not (Test-Path $SpecialistsPath)) { throw "Missing $SpecialistsPath" }
$specialists = Get-Content $SpecialistsPath -Raw | ConvertFrom-Json
Log 'Specialist seats loaded (GROK/CLAUDE/GEMINI/DEEPSEEK mapped to existing local roles)'

# 3) Optional seed of tiny economic jobs into orchestrator_tasks
$seeded = @()
if (-not $SkipSeed) {
    if ([string]::IsNullOrWhiteSpace($SupabaseUrl) -or [string]::IsNullOrWhiteSpace($SupabaseKey)) {
        Log 'WARN: SUPABASE_URL/KEY not set; skipping enqueue. Worker can still run if tasks already queued.'
    } else {
        $seed = Get-Content $SeedPath -Raw | ConvertFrom-Json
        $headers = @{
            apikey = $SupabaseKey
            Authorization = "Bearer $SupabaseKey"
            'Content-Type' = 'application/json'
            Accept = 'application/json'
            Prefer = 'return=representation'
        }
        foreach ($j in $seed.jobs) {
            $body = [ordered]@{
                role = [string]$j.role
                tier = 'local'
                objective = [string]$j.objective
                input = $j.input
                status = 'queued'
                timeout_seconds = 300
                max_turns = 5
                max_tool_calls = 10
                retry_policy_json = @{ max_attempts = 3; backoff_seconds = 30 }
            }
            try {
                $json = $body | ConvertTo-Json -Depth 20 -Compress
                $row = Invoke-RestMethod -Method Post -Uri ($SupabaseUrl.TrimEnd('/') + '/rest/v1/orchestrator_tasks') -Headers $headers -Body $json -TimeoutSec 30
                $tid = $row[0].task_id
                $seeded += @{ seed_id = $j.seed_id; lane = $j.lane; task_id = $tid }
                Log "Seeded $($j.seed_id) -> task_id=$tid"
            } catch {
                Log "Seed failed for $($j.seed_id): $($_.Exception.Message)"
            }
        }
    }
}

# 4) Proof of start state
$proofObj = [ordered]@{
    status = 'STARTED'
    generated_utc = [DateTime]::UtcNow.ToString('o')
    worker_id = $WorkerId
    lm_studio_url = $LmStudioUrl
    lm_models = $lmModels
    specialists = @('GROK','CLAUDE','GEMINI','DEEPSEEK')
    seeded_jobs = $seeded
    local_worker = $WorkerPath
    priority_rule = $specialists.priority_rule
    note = 'Supervisor does not claim continuous execution beyond this process. LocalWorker owns claim/lease/finish loop.'
}
$proofObj | ConvertTo-Json -Depth 8 | Set-Content -Path $Proof -Encoding UTF8
Log "PROOF=$Proof"

if ($SeedOnly) {
    Log 'SeedOnly complete; not starting worker loop.'
    exit 0
}

if (-not (Test-Path $WorkerPath)) { throw "Missing LocalWorker at $WorkerPath" }

# 5) Hand off to existing durable LocalWorker (claim/lease/renew/finish)
$workerArgs = @{
    LmStudioUrl = $LmStudioUrl
    WorkerId = $WorkerId
}
if ($Once) { $workerArgs['Once'] = $true }
Log 'Handing off to CORTEX/powershell/LocalWorker.ps1 (persistent claim/lease loop)'
& $WorkerPath @workerArgs
