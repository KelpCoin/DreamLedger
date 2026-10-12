#Requires -Version 5.1
[CmdletBinding()]
param(
    [int]$Port = 1234,
    [string]$Root = "",
    [string]$ProofRoot = ""
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$DataRoot = if (Test-Path 'D:\') { 'D:\BrownEyeCortex' } else { Join-Path $HOME 'BrownEyeCortex' }
if ([string]::IsNullOrWhiteSpace($Root)) { $Root = Join-Path $DataRoot 'Runtime\LMStudioCouncil' }
if ([string]::IsNullOrWhiteSpace($ProofRoot)) { $ProofRoot = Join-Path $DataRoot 'proofs\Runtime' }
$Root = [System.IO.Path]::GetFullPath($Root)
$ProofRoot = [System.IO.Path]::GetFullPath($ProofRoot)
$LogDir = Join-Path $DataRoot 'logs'
$Log = Join-Path $LogDir 'LMStudio-Council-Bootstrap.log'
$ConfigDir = Join-Path $Root 'CONFIG'
$MemoryDir = Join-Path $Root 'MEMORY'
$Verifier = Join-Path $PSScriptRoot 'Verify-LMStudioThreeRoleReadiness.ps1'
$VerifierProof = Join-Path $ProofRoot 'LMSTUDIO-THREE-ROLE-READINESS.json'
$CouncilProof = Join-Path $ProofRoot 'LM-COUNCIL-BOOTSTRAP-PROOF.json'
$Config = Join-Path $ConfigDir 'council.json'
$Memory = Join-Path $MemoryDir 'memory.jsonl'
$null = New-Item -ItemType Directory -Force -Path $Root,$ProofRoot,$LogDir,$ConfigDir,$MemoryDir
function Write-Log([string]$Message) {
    $line = "[$([DateTime]::UtcNow.ToString('o'))] $Message"
    Add-Content -LiteralPath $Log -Value $line -Encoding UTF8
    Write-Host $Message
}
function Write-JsonAtomic([string]$Path,[object]$Value) {
    $tmp = "$Path.tmp"
    $Value | ConvertTo-Json -Depth 16 | Set-Content -LiteralPath $tmp -Encoding UTF8
    Move-Item -LiteralPath $tmp -Destination $Path -Force
}
try {
    Write-Log "BEC_LOCAL_COUNCIL_START port=$Port root=$Root proof_root=$ProofRoot"
    if (-not (Test-Path -LiteralPath $Verifier)) { throw "Required verifier missing: $Verifier" }
    $out = & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $Verifier -Port $Port -ProofPath $VerifierProof -CacheMinutes 360 2>&1
    $verifierExit = $LASTEXITCODE
    if ($verifierExit -ne 0 -or -not (Test-Path -LiteralPath $VerifierProof)) {
        $summary = (($out | ForEach-Object { [string]$_ }) -join [Environment]::NewLine)
        throw "Three-role verifier did not pass; exit=$verifierExit; proof=$VerifierProof; output=$summary"
    }
    $readiness = Get-Content -LiteralPath $VerifierProof -Raw | ConvertFrom-Json
    if ($readiness.status -ne 'PASS' -or $readiness.readiness -ne 'THREE_DISTINCT_ROLES_INFERENCE_AND_LOADED_STATE_VERIFIED') {
        throw "Verifier status/readiness mismatch. No Council PASS permitted."
    }
    $roleMap = @{}
    foreach ($roleProof in @($readiness.roles)) {
        if ($roleProof.inference -ne 'PASS' -or [string]::IsNullOrWhiteSpace([string]$roleProof.model_key) -or [string]::IsNullOrWhiteSpace([string]$roleProof.api_identifier)) {
            throw "Incomplete real-inference proof for role=$($roleProof.role)."
        }
        $roleMap[[string]$roleProof.role] = $roleProof
    }
    foreach ($required in @('lightweight','heavyweight','visual')) {
        if (-not $roleMap.ContainsKey($required)) { throw "Verified proof missing required role '$required'." }
    }
    $modelKeys = @($roleMap.lightweight.model_key,$roleMap.heavyweight.model_key,$roleMap.visual.model_key)
    if (@($modelKeys | Select-Object -Unique).Count -ne 3) { throw 'The three required roles must use three distinct model keys.' }
    if ($roleMap.visual.vision_color_check -ne 'BLUE_DETECTED') { throw 'Vision role has no successful image-payload/color proof.' }
    if ($readiness.gpu.status -ne 'PASS_GPU_MEMORY_AND_INFERENCE_ACTIVITY_OBSERVED' -and -not $readiness.verification_reused) {
        throw 'GPU activity proof missing; model runtime is not ready.'
    }
    $council = [ordered]@{
        schema_version='BEC-LM-COUNCIL-2.0'
        generated_utc=[DateTime]::UtcNow.ToString('o')
        readiness='THREE_DISTINCT_ROLES_INFERENCE_VERIFIED'
        readiness_proof=$VerifierProof
        runtime=[ordered]@{
            base_url="http://127.0.0.1:$Port"
            models_endpoint='/v1/models'
            inference_endpoint='/v1/chat/completions'
            model_residency='REQUIRE_ALL_THREE_PRESENT_IN_FINAL_LMS_PS_AND_API_MODELS'
            context_length_default=2048
            gpu_offload='DYNAMIC_PARTIAL_OFFLOAD_WITH_RETRY'
            automatic_unload='NOT_CONFIGURED'
            concurrency='SERIAL_BY_DEFAULT'
        }
        roles=[ordered]@{
            lightweight=[ordered]@{ model=[string]$roleMap.lightweight.model_key; api_identifier=[string]$roleMap.lightweight.api_identifier; job='Fast scouting, triage, classification, and bounded draft proposals.'; required=$true }
            heavyweight=[ordered]@{ model=[string]$roleMap.heavyweight.model_key; api_identifier=[string]$roleMap.heavyweight.api_identifier; job='Deep critique, code reasoning, failure analysis, and adversarial checks.'; required=$true }
            visual=[ordered]@{ model=[string]$roleMap.visual.model_key; api_identifier=[string]$roleMap.visual.api_identifier; job='Image input inspection; may report visible evidence only with uncertainty.'; required=$true; input_modality='IMAGE_AND_TEXT' }
        }
        compatibility_aliases=[ordered]@{
            scout=[string]$roleMap.lightweight.api_identifier
            proposer=[string]$roleMap.lightweight.api_identifier
            critic=[string]$roleMap.heavyweight.api_identifier
            synthesizer=[string]$roleMap.heavyweight.api_identifier
            vision=[string]$roleMap.visual.api_identifier
        }
        loop=@('INGEST_EVIDENCE','SCOUT','CRITIC','VISUAL_IF_IMAGE_INPUT','SYNTHESIZE','GAUNTLET','EXECUTE_ONLY_IF_AUTHORIZED','VERIFY_EXTERNAL_EFFECT','PERSIST_PROOF')
        north_star='MAXIMIZE_VERIFIED_EXTERNAL_ECONOMIC_OUTCOMES_PER_HUMAN_ATTENTION_MINUTE; first independent buyer -> authorized purchase -> settled attributable payment -> fulfilled deliverable -> delivery evidence -> reconciliation.'
        truth_boundary='Model scores, model availability, GPU use, checkout sessions, workflow success and internal records are not revenue. Current verified external revenue remains NZD 0.00 until independent settlement and fulfillment evidence reconcile.'
        guardrails=@('NO_PUBLIC_POST_WITHOUT_APPROVAL','NO_LIVE_FINANCIAL_ACTION_WITHOUT_AUTHORIZATION','NO_CROSS_SILO_DATA','NO_SECRET_PERSISTENCE','FAIL_CLOSED_ON_MISSING_ROLE_OR_STALE_PROOF','LOCAL_MODELS_ARE_ACCELERATORS_NOT_TRUTH_AUTHORITY')
        economics=[ordered]@{ cloud_spend_default='OFF'; public_actions='APPROVAL_GATED'; db_writes='NOT_PERFORMED_BY_MODEL_BOOTSTRAP'; stripe_actions='NOT_PERFORMED_BY_MODEL_BOOTSTRAP' }
        memory_file=$Memory
        append_only_memory=$true
    }
    Write-JsonAtomic -Path $Config -Value $council
    if (-not (Test-Path -LiteralPath $Memory)) { New-Item -ItemType File -Path $Memory -Force | Out-Null }
    $proof = [ordered]@{
        schema='BEC-LM-COUNCIL-BOOTSTRAP/v2'
        status='PASS'
        readiness='THREE_DISTINCT_ROLES_INFERENCE_VERIFIED'
        verified_at_utc=[DateTime]::UtcNow.ToString('o')
        port=$Port
        role_count=3
        distinct_model_keys=$modelKeys
        roles=@($readiness.roles)
        gpu=$readiness.gpu
        readiness_proof=$VerifierProof
        council_config=$Config
        log=$Log
        north_star='First independent buyer and one completed, attributable, reconciled delivery. No economic claims from infrastructure telemetry.'
        note='PASS proves local model residency/inference/vision/GPU checks only. It does not prove cloud uptime, Supabase recovery, commerce fulfillment, or revenue.'
    }
    Write-JsonAtomic -Path $CouncilProof -Value $proof
    Write-Log "BEC_LOCAL_COUNCIL_PASS roles=3 proof=$CouncilProof"
    Write-Host "COUNCIL_CONFIG=$Config"
    Write-Host "READINESS_PROOF=$VerifierProof"
    Write-Host "COUNCIL_PROOF=$CouncilProof"
    Write-Host "LOG=$Log"
    exit 0
} catch {
    $proof = [ordered]@{
        schema='BEC-LM-COUNCIL-BOOTSTRAP/v2'
        status='FAIL'
        readiness='NOT_READY'
        verified_at_utc=[DateTime]::UtcNow.ToString('o')
        error=$_.Exception.Message
        readiness_proof=$VerifierProof
        council_config=$Config
        log=$Log
        note='Failure stays explicit. A model list, parser-only test, or local HTTP 200 never substitutes for three live role probes.'
    }
    Write-JsonAtomic -Path $CouncilProof -Value $proof
    Write-Log ("BEC_LOCAL_COUNCIL_FAIL error=" + $_.Exception.Message)
    Write-Error $_
    exit 2
}