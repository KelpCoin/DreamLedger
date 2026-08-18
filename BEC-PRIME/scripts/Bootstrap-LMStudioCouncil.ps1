#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = 'D:\BrownEyeCortex\ARTIFACTS\LM-COUNCIL'
$LogDir = Join-Path $Root 'LOGS'
$MemoryDir = Join-Path $Root 'MEMORY'
$ConfigDir = Join-Path $Root 'CONFIG'
$Log = Join-Path $LogDir ('bootstrap-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
$Config = Join-Path $ConfigDir 'council.json'
$Memory = Join-Path $MemoryDir 'memory.jsonl'
$ProofPath = Join-Path $Root 'LM-COUNCIL-BOOTSTRAP-PROOF.json'

New-Item -ItemType Directory -Force -Path $Root,$LogDir,$MemoryDir,$ConfigDir | Out-Null
Start-Transcript -Path $Log -Force | Out-Null

function Write-Event([string]$Message) { Write-Host $Message; Add-Content -Path $Log -Value $Message }
function Get-LmModels {
    try {
        $r = Invoke-RestMethod -Uri 'http://127.0.0.1:1234/v1/models' -Method Get -TimeoutSec 8
        return @($r.data)
    } catch {
        return @()
    }
}
function Pick([string[]]$Patterns) {
    foreach ($p in $Patterns) {
        $hit = $names | Where-Object { $_ -match $p } | Select-Object -First 1
        if ($hit) { return $hit }
    }
    return $null
}

Write-Event 'LM STUDIO COUNCIL BOOTSTRAP'
Write-Event ('UTC: ' + [DateTime]::UtcNow.ToString('o'))

$models = Get-LmModels
if ($models.Count -eq 0) {
    Write-Event 'FAIL: LM Studio server not reachable or no models visible at http://127.0.0.1:1234.'
    Write-Event 'Start the LM Studio local server, then rerun this script. No cloud call is made by this bootstrap.'
    Stop-Transcript | Out-Null
    exit 2
}

$names = @($models | ForEach-Object { [string]$_.id })
Write-Event ('Models visible: ' + ($names -join ', '))

# Role selection is adaptive. Core roles must exist before the council may execute.
$roles = [ordered]@{
    proposer = Pick @('qwen3.*14b','qwen2\.5.*14b.*instruct','qwen.*coder.*','qwen')
    critic = Pick @('deepseek.*r1.*14b','deepseek.*r1','deepseek')
    synthesizer = Pick @('gpt-oss-20b','gpt-oss','qwen3.*14b','qwen2\.5.*14b','qwen')
    visual_critic = Pick @('gemma-3.*12b','gemma-3','gemma')
    coder = Pick @('qwen3.*coder.*30b','qwen3.*coder','qwen.*coder','qwen3','qwen2\.5.*coder')
}

$coreMissing = @('proposer','critic','synthesizer','coder') | Where-Object { -not $roles[$_] }
if ($coreMissing.Count -gt 0) {
    $proof = [ordered]@{
        status = 'FAIL'
        reason = 'CORE_ROLE_MODEL_MISSING'
        generated_utc = [DateTime]::UtcNow.ToString('o')
        lm_studio_server = 'http://127.0.0.1:1234'
        visible_model_count = $models.Count
        missing_core_roles = $coreMissing
        models = $names
        config = $Config
    }
    $proof | ConvertTo-Json -Depth 8 | Set-Content -Path $ProofPath -Encoding UTF8
    Write-Event ('FAIL: missing core roles: ' + ($coreMissing -join ', '))
    Write-Event ('Proof: ' + $ProofPath)
    Stop-Transcript | Out-Null
    exit 3
}

$unique = @($roles.Values | Where-Object { $_ } | Select-Object -Unique)
$available = $unique.Count

$council = [ordered]@{
    schema_version = 'BEC-LM-COUNCIL-1.1'
    generated_utc = [DateTime]::UtcNow.ToString('o')
    transport = [ordered]@{
        base_url = 'http://127.0.0.1:1234'
        openai_compatible = '/v1'
        stateful_api = '/api/v1/chat'
        models_api = '/v1/models'
        sequential_loading = $true
    }
    execution = [ordered]@{
        strategy = 'SEQUENTIAL_ROLE_EXECUTION'
        contract = 'LOAD_ROLE -> RUN_ROLE -> PERSIST_RESULT -> UNLOAD_ROLE -> NEXT_ROLE'
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
        proposer = [ordered]@{ model = $roles.proposer; job = 'Generate commercial and engineering proposals.'; required = $true }
        critic = [ordered]@{ model = $roles.critic; job = 'Attack assumptions, detect failure modes, and score evidence.'; required = $true }
        synthesizer = [ordered]@{ model = $roles.synthesizer; job = 'Resolve disagreement into one executable plan.'; required = $true }
        visual_critic = [ordered]@{ model = $roles.visual_critic; job = 'Inspect screenshots/assets when a multimodal model is available.'; required = $false }
        coder = [ordered]@{ model = $roles.coder; job = 'Implement bounded code changes and tests.'; required = $true }
    }
    loop = @('INGEST','PROPOSE','CRITIQUE','SYNTHESIZE','GAUNTLET','EXECUTE_IF_APPROVED','VERIFY','PERSIST')
    guardrails = @('NO_REVENUE_CLAIMS_WITHOUT_EXTERNAL_PAYMENT_EVIDENCE','NO_PUBLIC_POST_WITHOUT_APPROVAL','NO_CROSS_SILO_DATA','NO_SECRET_PERSISTENCE','FAIL_CLOSED_ON_MISSING_CORE_ROLE')
}

$council | ConvertTo-Json -Depth 8 | Set-Content -Path $Config -Encoding UTF8
if (-not (Test-Path $Memory)) { New-Item -ItemType File -Path $Memory -Force | Out-Null }

$proof = [ordered]@{
    status = 'PASS'
    generated_utc = [DateTime]::UtcNow.ToString('o')
    lm_studio_server = 'http://127.0.0.1:1234'
    visible_model_count = $models.Count
    assigned_role_count = $available
    optional_visual_critic_assigned = [bool]$roles.visual_critic
    config = $Config
    memory = $Memory
    models = $names
    role_models = $roles
}
$proof | ConvertTo-Json -Depth 8 | Set-Content -Path $ProofPath -Encoding UTF8

Write-Event ('Assigned roles: ' + $available)
Write-Event ('Config: ' + $Config)
Write-Event ('Memory: ' + $Memory)
Write-Event ('Proof: ' + $ProofPath)
Write-Event 'PASS: core local council registry generated. Execution remains approval-gated.'
Stop-Transcript | Out-Null
exit 0
