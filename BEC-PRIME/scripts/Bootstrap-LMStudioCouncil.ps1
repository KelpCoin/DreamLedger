#Requires -Version 5.1
# Windows council bootstrap. PASS requires the independent verifier to prove three distinct
# role models with real inference. Merely seeing /v1/models never qualifies as readiness.
[CmdletBinding()]
param(
    [int]$Port = 1234,
    [string]$Root = ""
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($Root)) {
    $DataDrive = if (Test-Path 'D:\') { 'D:' } else { 'C:' }
    $Root = Join-Path $DataDrive 'BrownEyeCortex\ARTIFACTS\LM-COUNCIL'
}
$LogDir = Join-Path $Root 'LOGS'
$MemoryDir = Join-Path $Root 'MEMORY'
$ConfigDir = Join-Path $Root 'CONFIG'
$ProofPath = Join-Path $Root 'LM-COUNCIL-BOOTSTRAP-PROOF.json'
$Verifier = Join-Path $PSScriptRoot 'Verify-LMStudioThreeRoleReadiness.ps1'
New-Item -ItemType Directory -Force -Path $Root,$LogDir,$MemoryDir,$ConfigDir | Out-Null
$Log = Join-Path $LogDir ('bootstrap-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
$Memory = Join-Path $MemoryDir 'memory.jsonl'
$Config = Join-Path $ConfigDir 'council.json'
Start-Transcript -Path $Log -Force | Out-Null

function Write-Json([string]$Path, [object]$Value) {
    $Value | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $Path -Encoding UTF8
}
try {
    Write-Host 'BECK LOCAL COUNCIL BOOTSTRAP'
    Write-Host ('UTC=' + [DateTime]::UtcNow.ToString('o'))
    if (-not (Test-Path -LiteralPath $Verifier)) { throw "Required real-inference verifier is missing: $Verifier" }

    $base = "http://127.0.0.1:$Port"
    try {
        $null = Invoke-RestMethod -Uri "$base/v1/models" -Method Get -TimeoutSec 8
    } catch {
        $lms = Get-Command lms.exe -ErrorAction SilentlyContinue
        if (-not $lms) {
            $candidates = @(
                (Join-Path $env:USERPROFILE '.lmstudio\bin\lms.exe'),
                (Join-Path $env:LOCALAPPDATA 'Programs\LM Studio\resources\app\.webpack\bin\lms.exe')
            )
            $lmsPath = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
        } else { $lmsPath = $lms.Source }
        if (-not $lmsPath) { throw "LM Studio API is not reachable and lms.exe was not found. Expected $base/v1/models." }
        & $lmsPath server start --port $Port
        if ($LASTEXITCODE -ne 0) { throw "Could not start LM Studio server on port $Port." }
        $ready = $false
        for ($i=0; $i -lt 30; $i++) {
            Start-Sleep -Seconds 1
            try { $null = Invoke-RestMethod -Uri "$base/v1/models" -Method Get -TimeoutSec 5; $ready=$true; break } catch {}
        }
        if (-not $ready) { throw "LM Studio API did not become ready at $base/v1/models." }
    }

    $verifierProof = Join-Path $Root 'LMSTUDIO-THREE-ROLE-READINESS.json'
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Verifier -Port $Port -ProofPath $verifierProof
    $verifierExit = $LASTEXITCODE
    if ($verifierExit -ne 0 -or -not (Test-Path -LiteralPath $verifierProof)) {
        throw "Three-role readiness verification failed. Read $verifierProof; no council PASS is permitted."
    }
    $readiness = Get-Content -LiteralPath $verifierProof -Raw | ConvertFrom-Json
    if ($readiness.status -ne 'PASS' -or $readiness.readiness -ne 'THREE_DISTINCT_ROLES_INFERENCE_AND_LOADED_STATE_VERIFIED') {
        throw "Verifier did not produce a verified three-role readiness proof."
    }
    $roleMap = @{}
    foreach ($roleProof in @($readiness.roles)) {
        if ($roleProof.inference -ne 'PASS' -or -not $roleProof.model_key) { throw "Incomplete inference proof for role $($roleProof.role)." }
        $roleMap[[string]$roleProof.role] = [string]$roleProof.model_key
    }
    foreach ($required in @('proposer','critic','synthesizer')) {
        if (-not $roleMap.ContainsKey($required)) { throw "Verified proof missing core role '$required'." }
    }
    $coreModels = @($roleMap.proposer,$roleMap.critic,$roleMap.synthesizer)
    if (@($coreModels | Select-Object -Unique).Count -ne 3) {
        throw 'Core council roles are not assigned to three distinct model keys.'
    }

    $council = [ordered]@{
        schema_version = 'BEC-LM-COUNCIL-1.2'
        generated_utc = [DateTime]::UtcNow.ToString('o')
        readiness = 'THREE_DISTINCT_ROLES_INFERENCE_VERIFIED'
        readiness_proof = $verifierProof
        transport = [ordered]@{
            base_url = $base
            openai_compatible = '/v1'
            models_api = '/v1/models'
            inference = "$base/v1/chat/completions"
        }
        execution = [ordered]@{
            strategy = 'SEQUENTIAL_ROLE_EXECUTION'
            contract = 'LOAD_ROLE -> RUN_ROLE -> PERSIST_RESULT -> VERIFY -> NEXT_ROLE'
            parallelism = 'OFF_BY_DEFAULT'
            fail_closed = $true
        }
        economics = [ordered]@{
            mode = 'LOCAL_FIRST'
            cloud_spend_default = 'OFF'
            external_calls = 'APPROVAL_GATED'
            objective = 'MAXIMIZE_EXPECTED_COMMERCIAL_VALUE_PER_UNIT_OF_COMPUTE'
        }
        persistence = [ordered]@{
            memory_jsonl = $Memory
            append_only = $true
            include = @('decision','evidence','artifact_path','model','role','timestamp_utc','confidence')
            exclude = @('credentials','payment_secrets','customer_pii')
        }
        roles = [ordered]@{
            proposer = [ordered]@{ model = $roleMap.proposer; job = 'Generate bounded proposals.'; required = $true }
            critic = [ordered]@{ model = $roleMap.critic; job = 'Challenge claims and inspect failure modes.'; required = $true }
            synthesizer = [ordered]@{ model = $roleMap.synthesizer; job = 'Synthesize one evidence-backed next action.'; required = $true }
        }
        loop = @('INGEST','PROPOSE','CRITIQUE','SYNTHESIZE','GAUNTLET','EXECUTE_IF_APPROVED','VERIFY','PERSIST')
        guardrails = @('NO_REVENUE_CLAIMS_WITHOUT_EXTERNAL_PAYMENT_EVIDENCE','NO_PUBLIC_POST_WITHOUT_APPROVAL','NO_CROSS_SILO_DATA','NO_SECRET_PERSISTENCE','FAIL_CLOSED_ON_MISSING_CORE_ROLE')
    }
    Write-Json -Path $Config -Value $council
    if (-not (Test-Path -LiteralPath $Memory)) { New-Item -ItemType File -Path $Memory -Force | Out-Null }

    $proof = [ordered]@{
        schema = 'BEC-LM-COUNCIL-BOOTSTRAP-1.2'
        status = 'PASS'
        readiness = 'THREE_DISTINCT_ROLES_INFERENCE_VERIFIED'
        verified_at_utc = [DateTime]::UtcNow.ToString('o')
        server = $base
        verifier_proof = $verifierProof
        roles = $readiness.roles
        config = $Config
        memory = $Memory
        note = 'PASS means three distinct role models each passed real inference and remained visible together during this run. It does not prove GPU-only execution, external actions, database health, payment, or revenue.'
    }
    Write-Json -Path $ProofPath -Value $proof
    Write-Host "PASS: verified council config written to $Config"
    Write-Host "Proof: $ProofPath"
    exit 0
} catch {
    $proof = [ordered]@{
        schema = 'BEC-LM-COUNCIL-BOOTSTRAP-1.2'
        status = 'FAIL'
        readiness = 'NOT_READY'
        verified_at_utc = [DateTime]::UtcNow.ToString('o')
        error = $_.Exception.Message
        note = 'No readiness PASS is issued unless three distinct models pass real inference.'
    }
    Write-Json -Path $ProofPath -Value $proof
    Write-Error $_
    exit 2
} finally {
    Stop-Transcript | Out-Null
}