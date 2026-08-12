[CmdletBinding()]
param(
    [string]$ConfigPath = "D:\BrownEyeCortex\BEC-PRIME\autonomy\AUTONOMOUS_REFINERY.json"
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

function Read-Json([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { throw "Missing JSON: $Path" }
    return (Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json)
}

function Write-Json([string]$Path, $Object) {
    $dir = Split-Path -Parent $Path
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $Object | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $Path -Encoding UTF8
}

$config = Read-Json $ConfigPath
$root = [string]$config.paths.root
$memoryPath = [string]$config.memory.path
$candidateDir = [string]$config.paths.candidate_dir
$proofDir = [string]$config.paths.proof_dir
$logDir = [string]$config.paths.log_dir
$approvedDir = [string]$config.paths.approved_draft_dir
$endpoint = ([string]$config.refinery.endpoint).TrimEnd('/')
$gauntlet = [string]$config.gauntlet.script
$maxIterations = [int]$config.refinery.max_iterations
$temperature = [double]$config.refinery.temperature

foreach ($d in @($candidateDir,$proofDir,$logDir,$approvedDir,(Split-Path -Parent $memoryPath))) {
    New-Item -ItemType Directory -Force -Path $d | Out-Null
}
if (-not (Test-Path -LiteralPath $memoryPath)) { New-Item -ItemType File -Force -Path $memoryPath | Out-Null }

$logPath = Join-Path $logDir "refinery.log"
function Log([string]$Message) {
    Add-Content -LiteralPath $logPath -Value ((Get-Date -Format o) + " " + $Message)
    Write-Host $Message
}
function Memory([hashtable]$Entry) {
    $Entry | ConvertTo-Json -Depth 30 -Compress | Add-Content -LiteralPath $memoryPath -Encoding UTF8
}

function Get-Models {
    $r = Invoke-RestMethod -Uri ($endpoint + "/v1/models") -Method Get -TimeoutSec 5
    return @($r.data | ForEach-Object { [string]$_.id })
}

$available = Get-Models
if ($available.Count -eq 0) { throw "LM Studio returned no models." }

function Resolve-Model([string]$Requested) {
    $exact = @($available | Where-Object { $_ -eq $Requested })
    if ($exact.Count -gt 0) { return $exact[0] }
    $needle = ($Requested -replace '[-_.]','').ToLowerInvariant()
    $fuzzy = @($available | Where-Object { (($_ -replace '[-_.]','').ToLowerInvariant()).Contains($needle) })
    if ($fuzzy.Count -gt 0) { return $fuzzy[0] }
    return $available[0]
}

$models = @{
    proposer = Resolve-Model ([string]$config.refinery.roles.proposer)
    critic = Resolve-Model ([string]$config.refinery.roles.critic)
    synthesizer = Resolve-Model ([string]$config.refinery.roles.synthesizer)
    monetizer = Resolve-Model ([string]$config.refinery.roles.monetizer)
}

function Invoke-LM([string]$Model,[string]$Prompt) {
    $body = @{
        model = $Model
        messages = @(
            @{ role = "system"; content = "You are one role in a local autonomous commerce refinery. Return only the requested content. Never invent payments, customers, credentials, URLs, or evidence. Keep the MTG silo isolated." },
            @{ role = "user"; content = $Prompt }
        )
        temperature = $temperature
    } | ConvertTo-Json -Depth 20
    $r = Invoke-RestMethod -Uri ($endpoint + "/v1/chat/completions") -Method Post -ContentType "application/json" -Body $body -TimeoutSec 300
    if (-not $r.choices[0].message.content) { throw "LM Studio returned empty content for $Model" }
    return [string]$r.choices[0].message.content
}

function Extract-Json([string]$Text) {
    $clean = $Text.Trim()
    if ($clean.StartsWith('```')) {
        $clean = $clean -replace '^```[A-Za-z0-9_-]*\s*',''
        $clean = $clean -replace '\s*```$',''
    }
    try { return ($clean | ConvertFrom-Json) } catch {}
    $start = $clean.IndexOf('{')
    $end = $clean.LastIndexOf('}')
    if ($start -ge 0 -and $end -gt $start) {
        return ($clean.Substring($start, $end - $start + 1) | ConvertFrom-Json)
    }
    throw "Monetizer did not return parseable JSON."
}

function Run-Gauntlet([string]$CandidatePath,[string]$ProofPath) {
    if (-not (Test-Path -LiteralPath $gauntlet)) { throw "Missing Gauntlet: $gauntlet" }
    & node.exe $gauntlet $CandidatePath $ProofPath
    return ($LASTEXITCODE -eq 0)
}

Log "=== AUTONOMOUS REFINERY START ==="
Log ("Available models: " + ($available -join ', '))
Log ("Roles: proposer=" + $models.proposer + " critic=" + $models.critic + " synthesizer=" + $models.synthesizer + " monetizer=" + $models.monetizer)
Log ("Max iterations: " + $maxIterations)

$history = @()
$passed = $false
$finalCandidate = $null
$finalProof = $null

for ($iteration = 1; $iteration -le $maxIterations; $iteration++) {
    Log ("[Iteration " + $iteration + "] proposer")
    $memoryTail = @(Get-Content -LiteralPath $memoryPath -Tail 5 -ErrorAction SilentlyContinue) -join "`n"
    $proposal = Invoke-LM $models.proposer @"
Create one commercially useful MTG offer proposal from this signal:
$($config.refinery.signal)

Previous refinery memory:
$memoryTail

The offer must be deliverable by a small local operation, must have a clear buyer, and must not claim evidence that does not exist.
"@

    Log ("[Iteration " + $iteration + "] critic")
    $critique = Invoke-LM $models.critic @"
Ruthlessly critique this MTG offer proposal for real-world saleability, clarity, price justification, delivery feasibility, proof, silo safety, and checkout readiness.
Identify concrete defects and specify fixes. Do not rewrite the offer yet.

PROPOSAL:
$proposal
"@

    Log ("[Iteration " + $iteration + "] synthesizer")
    $synthesis = Invoke-LM $models.synthesizer @"
Rebuild the MTG offer using the proposal and critique below.
Preserve only claims that can be verified. Make the offer concrete, small, sellable, and deliverable.

PROPOSAL:
$proposal

CRITIQUE:
$critique
"@

    Log ("[Iteration " + $iteration + "] monetizer")
    $monetized = Invoke-LM $models.monetizer @"
Convert this synthesized MTG offer into ONLY one JSON object with these exact fields:
offer_id,name,problem,target_buyer,deliverable,delivery_mechanism,price,currency,payment_adapter,checkout_route,approval_required,checkout_available,status,proof_of_delivery,verification_rules,provenance,silo,kill_condition

Rules:
- silo must be mtg
- currency must be nzd
- price must be positive
- approval_required must be true
- checkout_available must be false
- status must be candidate
- provenance.private_material must be excluded
- no claims of prior customers, revenue, payment, or market proof
- checkout_route may describe the intended route but must not contain fabricated live URLs

SYNTHESIS:
$synthesis
"@

    try {
        $candidate = Extract-Json $monetized
    } catch {
        Memory @{ schema_version='BEC-REFINERY-MEMORY-1.0'; iteration=$iteration; timestamp=(Get-Date -Format o); status='PARSE_FAIL'; monetized=$monetized; error=$_.Exception.Message }
        Log ("[Iteration " + $iteration + "] FAIL: invalid candidate JSON")
        continue
    }

    $candidatePath = Join-Path $candidateDir ("CANDIDATE-{0:D3}.json" -f $iteration)
    $proofPath = Join-Path $proofDir ("GAUNTLET-{0:D3}.json" -f $iteration)
    Write-Json $candidatePath $candidate

    Log ("[Iteration " + $iteration + "] deterministic Gauntlet")
    $passed = Run-Gauntlet $candidatePath $proofPath
    $gauntletProof = Read-Json $proofPath

    Memory @{
        schema_version='BEC-REFINERY-MEMORY-1.0'
        iteration=$iteration
        timestamp=(Get-Date -Format o)
        proposal=$proposal
        critique=$critique
        synthesis=$synthesis
        monetized=$monetized
        candidate=$candidate
        gauntlet=$gauntletProof
        result=if($passed){'PASS'}else{'FAIL'}
    }

    if ($passed) {
        $finalCandidate = $candidate
        $finalProof = $gauntletProof
        $approvedPath = Join-Path $approvedDir ("APPROVED-DRAFT-{0}.json" -f $candidate.offer_id)
        Write-Json $approvedPath $candidate
        Log ("[PASS] Gauntlet passed. Internal draft written: " + $approvedPath)
        Log "Public execution remains blocked by policy. No checkout, outreach, deploy, or payment claim was made."
        break
    }

    Log ("[Iteration " + $iteration + "] Gauntlet FAIL. Feedback persisted; next iteration will see it in memory.")
}

$resultPath = Join-Path $proofDir ("REFINERY-RUN-{0}.json" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
Write-Json $resultPath ([ordered]@{
    schema_version='BEC-REFINERY-RUN-1.0'
    timestamp=(Get-Date -Format o)
    silo='mtg'
    iterations=$maxIterations
    passed=$passed
    verified_revenue_nzd=0
    payment_claimed=$false
    public_execution=$false
    final_candidate=$finalCandidate
    final_gauntlet=$finalProof
})

if ($passed) {
    Log "=== REFINERY COMPLETE: PASS ==="
    Write-Host ("PROOF: " + $resultPath)
    exit 0
}

Log "=== REFINERY COMPLETE: NO PASS ==="
Write-Host ("PROOF: " + $resultPath)
exit 1
