#Requires -Version 5.1

param(
    [Parameter(Mandatory = $true)]
    [string]$Task,
    [string]$Server = 'http://127.0.0.1:1234',
    [int]$ContextLength = 8192,
    [int]$MaxOutputTokens = 900,
    [int]$MemoryEntries = 12,
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = 'D:\BrownEyeCortex\ARTIFACTS\LM-COUNCIL'
$LogDir = Join-Path $Root 'LOGS'
$RunDir = Join-Path $Root 'RUNS'
$MemoryDir = Join-Path $Root 'MEMORY'
$MemoryPath = Join-Path $MemoryDir 'memory.jsonl'
$ProofPath = Join-Path $Root 'LM-COUNCIL-LAST-RUN-PROOF.json'
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$LogPath = Join-Path $LogDir ('run-' + $Stamp + '.log')
$RunPath = Join-Path $RunDir ('council-' + $Stamp + '.json')

New-Item -ItemType Directory -Force -Path $Root,$LogDir,$RunDir,$MemoryDir | Out-Null
Start-Transcript -Path $LogPath -Force | Out-Null

function Write-Event([string]$Message) {
    Write-Host $Message
    Add-Content -Path $LogPath -Value $Message
}

function Get-Models {
    $r = Invoke-RestMethod -Uri ($Server + '/v1/models') -Method Get -TimeoutSec 10
    return @($r.data | Where-Object { $_.id })
}

function Pick-Model([string[]]$Patterns, [string[]]$Used) {
    foreach ($pattern in $Patterns) {
        $hit = @($script:Models | Where-Object {
            ($_.id -match $pattern) -and ($Used -notcontains $_.id)
        } | Select-Object -First 1)
        if ($hit.Count -gt 0) { return [string]$hit[0].id }
    }
    return $null
}

function Get-MemoryContext {
    if (-not (Test-Path $MemoryPath)) { return 'No prior council memory.' }
    $lines = @(Get-Content -Path $MemoryPath -Tail $MemoryEntries -ErrorAction SilentlyContinue)
    if ($lines.Count -eq 0) { return 'No prior council memory.' }
    $text = ($lines -join "`n")
    if ($text.Length -gt 12000) { $text = $text.Substring($text.Length - 12000) }
    return $text
}

function Invoke-CouncilChat([string]$Model, [string]$Role, [string]$Input, [string]$SystemPrompt) {
    $body = [ordered]@{
        model = $Model
        input = $Input
        system_prompt = $SystemPrompt
        context_length = $ContextLength
        max_output_tokens = $MaxOutputTokens
        temperature = 0.1
        store = $false
    }
    $start = Get-Date
    $response = Invoke-RestMethod -Uri ($Server + '/api/v1/chat') -Method Post -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 8) -TimeoutSec 600
    $elapsed = ((Get-Date) - $start).TotalSeconds
    $messages = @($response.output | Where-Object { $_.type -eq 'message' })
    $content = (($messages | ForEach-Object { [string]$_.content }) -join "`n").Trim()
    if (-not $content) { throw "Role $Role returned no message content." }
    return [pscustomobject]@{
        role = $Role
        model = $Model
        content = $content
        elapsed_seconds = [math]::Round($elapsed,2)
        stats = $response.stats
    }
}

function Unload-Model([string]$InstanceId) {
    if (-not $InstanceId) { return }
    try {
        $body = @{ instance_id = $InstanceId } | ConvertTo-Json
        Invoke-RestMethod -Uri ($Server + '/api/v1/models/unload') -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 30 | Out-Null
    } catch {
        Write-Event ('WARN: unload failed for ' + $InstanceId + ': ' + $_.Exception.Message)
    }
}

Write-Event 'LM STUDIO CLOSED-LOOP COUNCIL RUNNER'
Write-Event ('UTC: ' + [DateTime]::UtcNow.ToString('o'))
Write-Event ('Task: ' + $Task)

$Models = Get-Models
if ($Models.Count -lt 2) {
    throw 'FAIL: fewer than 2 visible LM Studio models. A council requires model diversity.'
}

$used = @()
$RolePatterns = [ordered]@{
    proposer = @('qwen3.*coder','qwen3.*instruct','qwen2\.5.*coder','qwen2\.5.*instruct','qwen','mistral','gemma')
    critic = @('deepseek.*r1','deepseek','gemma.*27b','gemma.*12b','mistral','qwen')
    synthesizer = @('gpt-oss-20b','gpt-oss','qwen3','qwen2\.5','mistral','gemma')
    coder = @('qwen3.*coder','qwen2\.5.*coder','qwen.*coder','qwen3','qwen2\.5')
}

$Assignments = [ordered]@{}
foreach ($role in $RolePatterns.Keys) {
    $model = Pick-Model $RolePatterns[$role] $used
    if ($model) {
        $Assignments[$role] = $model
        $used += $model
    }
}

$coreMissing = @('proposer','critic','synthesizer') | Where-Object { -not $Assignments[$_] }
if ($coreMissing.Count -gt 0) {
    throw ('FAIL: missing core council roles: ' + ($coreMissing -join ', '))
}

Write-Event ('Visible models: ' + (($Models | ForEach-Object { $_.id }) -join ', '))
Write-Event ('Assignments: ' + (($Assignments.GetEnumerator() | ForEach-Object { $_.Key + '=' + $_.Value }) -join '; '))

if ($DryRun) {
    $proof = [ordered]@{
        status = 'DRY_RUN_PASS'
        generated_utc = [DateTime]::UtcNow.ToString('o')
        server = $Server
        task = $Task
        models = @($Models | ForEach-Object { $_.id })
        assignments = $Assignments
        memory = $MemoryPath
        log = $LogPath
        run = $RunPath
    }
    $proof | ConvertTo-Json -Depth 10 | Set-Content -Path $ProofPath -Encoding UTF8
    $proof | ConvertTo-Json -Depth 10 | Set-Content -Path $RunPath -Encoding UTF8
    Write-Event 'DRY RUN PASS: no inference executed.'
    Stop-Transcript | Out-Null
    exit 0
}

$memory = Get-MemoryContext
$results = @()
$prior = $memory

try {
    $pPrompt = @"
TASK:
$Task

PERSISTENT COUNCIL MEMORY (recent):
$memory

You are the PROPOSER. Produce a concrete, commercially useful proposal. Prefer the smallest executable move that can produce evidence or revenue. Separate facts from assumptions. Do not claim revenue without payment evidence. Return concise structured prose.
"@
    $p = Invoke-CouncilChat $Assignments.proposer 'proposer' $Task $pPrompt
    $results += $p
    Add-Content -Path $MemoryPath -Value (($p | ConvertTo-Json -Compress -Depth 8))
    Unload-Model $p.model

    $cPrompt = @"
TASK:
$Task

PROPOSER OUTPUT:
$($p.content)

RECENT MEMORY:
$prior

You are the CRITIC. Attack the proposal. Identify unsupported claims, technical failure modes, commercial dead ends, silo violations, unnecessary compute, and missing proof. Then give a short ranked correction list.
"@
    $c = Invoke-CouncilChat $Assignments.critic 'critic' $Task $cPrompt
    $results += $c
    Add-Content -Path $MemoryPath -Value (($c | ConvertTo-Json -Compress -Depth 8))
    Unload-Model $c.model

    $sPrompt = @"
TASK:
$Task

PROPOSER:
$($p.content)

CRITIC:
$($c.content)

You are the SYNTHESIZER. Resolve the disagreement into one executable plan. Select only steps that are evidence-backed or explicitly labelled as experiments. Include verification, monetization path, and rollback. Do not publish or spend money. Return an ordered action plan.
"@
    $s = Invoke-CouncilChat $Assignments.synthesizer 'synthesizer' $Task $sPrompt
    $results += $s
    Add-Content -Path $MemoryPath -Value (($s | ConvertTo-Json -Compress -Depth 8))
    Unload-Model $s.model

    if ($Assignments.Contains('coder')) {
        $codePrompt = @"
TASK:
$Task

SYNTHESIZED PLAN:
$($s.content)

You are the CODER/IMPLEMENTER. Convert the plan into bounded implementation steps suitable for PowerShell 5.1, local-first execution, and idempotent operation. Do not make public changes, push code, spend money, or use credentials. Identify exact files/commands that would be needed.
"@
        $x = Invoke-CouncilChat $Assignments.coder 'coder' $Task $codePrompt
        $results += $x
        Add-Content -Path $MemoryPath -Value (($x | ConvertTo-Json -Compress -Depth 8))
        Unload-Model $x.model
    }

    $proof = [ordered]@{
        status = 'PASS'
        generated_utc = [DateTime]::UtcNow.ToString('o')
        server = $Server
        task = $Task
        council_strategy = 'SEQUENTIAL_MULTI_MODEL_DELIBERATION'
        assignments = $Assignments
        result_count = $results.Count
        results = $results
        memory = $MemoryPath
        log = $LogPath
        run = $RunPath
        guardrails = @('NO_PUBLIC_POSTING','NO_PAYMENT','NO_CREDENTIAL_PERSISTENCE','NO_CROSS_SILO_CONTEXT','NO_REVENUE_CLAIM_WITHOUT_PAYMENT_EVIDENCE')
    }
    $proof | ConvertTo-Json -Depth 12 | Set-Content -Path $ProofPath -Encoding UTF8
    $proof | ConvertTo-Json -Depth 12 | Set-Content -Path $RunPath -Encoding UTF8
    Write-Event ('PASS: council completed with ' + $results.Count + ' role outputs.')
    Write-Event ('Proof: ' + $ProofPath)
} catch {
    $proof = [ordered]@{
        status = 'FAIL'
        generated_utc = [DateTime]::UtcNow.ToString('o')
        server = $Server
        task = $Task
        assignments = $Assignments
        error = $_.Exception.Message
        partial_results = $results
        memory = $MemoryPath
        log = $LogPath
        run = $RunPath
    }
    $proof | ConvertTo-Json -Depth 12 | Set-Content -Path $ProofPath -Encoding UTF8
    $proof | ConvertTo-Json -Depth 12 | Set-Content -Path $RunPath -Encoding UTF8
    Write-Event ('FAIL: ' + $_.Exception.Message)
    Stop-Transcript | Out-Null
    exit 1
}

Stop-Transcript | Out-Null
exit 0
