#Requires -Version 5.1

param(
    [string]$Server = 'http://127.0.0.1:1234',
    [int]$ContextLength = 4096,
    [switch]$NoInference
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = 'D:\BrownEyeCortex\ARTIFACTS\LM-COUNCIL'
$LogDir = Join-Path $Root 'LOGS'
New-Item -ItemType Directory -Force -Path $Root,$LogDir | Out-Null
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$Proof = Join-Path $Root ('LM-COUNCIL-RUNTIME-PROOF-' + $Stamp + '.json')
$LastProof = Join-Path $Root 'LM-COUNCIL-RUNTIME-LAST-PROOF.json'
$Log = Join-Path $LogDir ('runtime-' + $Stamp + '.log')

function Write-Log([string]$Message) {
    $Message | Tee-Object -FilePath $Log -Append
}

function Get-Models {
    $r = Invoke-RestMethod -Uri ($Server + '/v1/models') -Method Get -TimeoutSec 10
    return @($r.data | Where-Object { $_.id })
}

function Pick([string[]]$Patterns, [string[]]$Used) {
    foreach ($pattern in $Patterns) {
        $hit = @($Models | Where-Object { $_.id -match $pattern -and $Used -notcontains $_.id } | Select-Object -First 1)
        if ($hit.Count -gt 0) { return [string]$hit[0].id }
    }
    return $null
}

function Load-Model([string]$Model) {
    $body = [ordered]@{
        model = $Model
        context_length = $ContextLength
        echo_load_config = $true
    }
    return Invoke-RestMethod -Uri ($Server + '/api/v1/models/load') -Method Post -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 8) -TimeoutSec 600
}

function Unload-Model([string]$InstanceId) {
    $body = @{ instance_id = $InstanceId } | ConvertTo-Json
    return Invoke-RestMethod -Uri ($Server + '/api/v1/models/unload') -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 30
}

Write-Log 'LM STUDIO COUNCIL RUNTIME VERIFIER'
Write-Log ('UTC=' + [DateTime]::UtcNow.ToString('o'))
Write-Log ('SERVER=' + $Server)

$status = 'PASS'
$errorMessage = $null
$assignments = [ordered]@{}
$tests = @()
$Models = @()
$Used = @()

try {
    $Models = Get-Models
    if ($Models.Count -lt 2) { throw 'FAIL: fewer than 2 visible models.' }

    $patterns = [ordered]@{
        proposer = @('qwen3.*coder','qwen3.*instruct','qwen2\.5.*coder','qwen2\.5.*instruct','qwen','mistral','gemma')
        critic = @('deepseek.*r1','deepseek','gemma.*27b','gemma.*12b','mistral','qwen')
        synthesizer = @('gpt-oss-20b','gpt-oss','qwen3','qwen2\.5','mistral','gemma')
    }

    foreach ($role in $patterns.Keys) {
        $model = Pick $patterns[$role] $Used
        if ($model) {
            $assignments[$role] = $model
            $Used += $model
        }
    }

    $missing = @('proposer','critic','synthesizer') | Where-Object { -not $assignments[$_] }
    if ($missing.Count -gt 0) { throw ('FAIL: missing core role diversity: ' + ($missing -join ', ')) }

    foreach ($role in $assignments.Keys) {
        $model = $assignments[$role]
        Write-Log ('LOAD role=' + $role + ' model=' + $model)
        $loaded = Load-Model $model
        $instanceId = [string]$loaded.instance_id
        if (-not $instanceId) { throw ('FAIL: load returned no instance_id for ' + $model) }
        if ([string]$loaded.status -ne 'loaded') { throw ('FAIL: load status was not loaded for ' + $model) }

        $tests += [pscustomobject]@{
            role = $role
            model = $model
            instance_id = $instanceId
            load_status = [string]$loaded.status
            load_time_seconds = $loaded.load_time_seconds
        }

        Write-Log ('UNLOAD role=' + $role + ' instance_id=' + $instanceId)
        $unloaded = Unload-Model $instanceId
        if ([string]$unloaded.instance_id -ne $instanceId) { throw ('FAIL: unload returned unexpected instance_id for ' + $model) }
    }

    if (-not $NoInference) {
        $first = $tests[0]
        $loaded = Load-Model $first.model
        $instanceId = [string]$loaded.instance_id
        try {
            $body = [ordered]@{
                model = $first.model
                input = 'Return exactly the word PASS.'
                system_prompt = 'You are a council runtime probe. Return exactly PASS.'
                context_length = $ContextLength
                max_output_tokens = 8
                temperature = 0
                store = $false
            }
            $response = Invoke-RestMethod -Uri ($Server + '/api/v1/chat') -Method Post -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 8) -TimeoutSec 180
            $messages = @($response.output | Where-Object { $_.type -eq 'message' })
            $text = (($messages | ForEach-Object { [string]$_.content }) -join "`n").Trim()
            if (-not $text) { throw 'FAIL: inference returned no message content.' }
            $tests += [pscustomobject]@{ role = 'inference_probe'; model = $first.model; output = $text }
        } finally {
            Unload-Model $instanceId | Out-Null
        }
    }

    Write-Log 'PASS: load, instance-id capture, unload, and optional inference probe completed.'
} catch {
    $status = 'FAIL'
    $errorMessage = $_.Exception.Message
    Write-Log ('FAIL: ' + $errorMessage)
}

$proofObject = [ordered]@{
    status = $status
    generated_utc = [DateTime]::UtcNow.ToString('o')
    server = $Server
    visible_model_count = $Models.Count
    visible_models = @($Models | ForEach-Object { $_.id })
    assignments = $assignments
    tests = $tests
    error = $errorMessage
    log = $Log
    guardrails = @('LOCAL_ONLY','NO_CREDENTIAL_PERSISTENCE','NO_PAYMENT','NO_PUBLIC_POSTING','EXPLICIT_INSTANCE_UNLOAD')
}

$json = $proofObject | ConvertTo-Json -Depth 12
$json | Set-Content -Path $Proof -Encoding UTF8
$json | Set-Content -Path $LastProof -Encoding UTF8
Write-Log ('PROOF=' + $Proof)

if ($status -ne 'PASS') { exit 1 }
exit 0
