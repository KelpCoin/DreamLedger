#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$ConfigPath = "$PSScriptRoot\config.json",
    [switch]$Once
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Log([string]$Message) {
    $line = "$(Get-Date -Format o) $Message"
    Write-Host $line
    Add-Content -LiteralPath $script:LogFile -Value $line -Encoding UTF8
}

function Ensure-Dir([string]$Path) { if (-not (Test-Path -LiteralPath $Path)) { New-Item -ItemType Directory -Force -Path $Path | Out-Null } }
function Json([object]$Value) { $Value | ConvertTo-Json -Depth 20 -Compress }
function Get-Hash([string]$Text) { $sha=[Security.Cryptography.SHA256]::Create(); try { ($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Text)) | ForEach-Object ToString x2) -join '' } finally { $sha.Dispose() } }

$config = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
$root = [string]$config.paths.root
$script:LogDir = [string]$config.paths.logs
$script:ProofDir = [string]$config.paths.proofs
$script:QueueDir = [string]$config.paths.queue
$script:StateDir = [string]$config.paths.state
Ensure-Dir $root; Ensure-Dir $script:LogDir; Ensure-Dir $script:ProofDir; Ensure-Dir $script:QueueDir; Ensure-Dir $script:StateDir
$script:LogFile = Join-Path $script:LogDir 'autonomy.log'

function Invoke-JsonGet([string]$Url) {
    Invoke-RestMethod -Uri $Url -Method Get -TimeoutSec 30 -Headers @{ 'Cache-Control'='no-cache' }
}
function Invoke-LM([string]$System,[string]$User) {
    $body = @{ model=[string]$config.lm_studio.model; messages=@(@{role='system';content=$System},@{role='user';content=$User}); temperature=0.1; response_format=@{type='json_object'} } | ConvertTo-Json -Depth 10
    Invoke-RestMethod -Uri (([string]$config.lm_studio.base_url).TrimEnd('/') + '/chat/completions') -Method Post -ContentType 'application/json' -Body $body -TimeoutSec ([int]$config.lm_studio.timeout_seconds)
}

function Run-Gauntlet($Item) {
    $checks = [ordered]@{
        id_present = -not [string]::IsNullOrWhiteSpace([string]$Item.id)
        name_present = -not [string]::IsNullOrWhiteSpace([string]$Item.name)
        published = ([string]$Item.status -eq 'published')
        approved = ($Item.approval_required -eq $false)
        checkout = ($Item.checkout_available -eq $true)
        inventory = ([int]$Item.inventory -gt 0)
        price = ([int]$Item.price -gt 0)
    }
    $pass = -not ($checks.Values -contains $false)
    $canonical = Json $Item
    [pscustomobject]@{ verdict=if($pass){'PASS'}else{'FAIL'}; checks=$checks; signal_hash=(Get-Hash $canonical); reason=if($pass){'hardened'}else{'one_or_more_checks_failed'} }
}

function Write-Proof($Cycle,$ProductCount,$PassCount,$FailCount,$Actions) {
    $proof = [ordered]@{
        schema='BEC-AUTONOMY-PROOF-1'; timestamp_utc=(Get-Date).ToUniversalTime().ToString('o'); cycle=$Cycle
        status='PASS'; product_count=$ProductCount; gauntlet_pass=$PassCount; gauntlet_fail=$FailCount
        actions_generated=$Actions; lm_studio=[string]$config.lm_studio.base_url
        policy=@{ external_publish_requires_approval=$true; financial_settlement_requires_buyer_authorization=$true }
    }
    $proof.cycle_hash = Get-Hash (Json $proof)
    $path=Join-Path $script:ProofDir ("AUTONOMY_{0}.json" -f (Get-Date -Format 'yyyyMMdd_HHmmss'))
    $proof | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $path -Encoding UTF8
    return $path
}

$cycle=0
while ($true) {
    $cycle++
    try {
        Write-Log "CYCLE $cycle START"
        $health = Invoke-JsonGet (([string]$config.dreamledger.base_url).TrimEnd('/') + [string]$config.dreamledger.health_path)
        if ([string]$health.status -ne 'ok') { throw 'DreamLedger health gate failed' }
        $products = @(Invoke-JsonGet (([string]$config.dreamledger.base_url).TrimEnd('/') + [string]$config.dreamledger.products_path)).products
        $passes=0; $fails=0; $actions=0
        foreach ($p in $products) {
            $g=Run-Gauntlet $p
            if ($g.verdict -eq 'PASS') {
                $passes++
                $prompt = "Return JSON only with keys: priority, rationale, buyer_problem, suggested_action. Never claim a sale. Never publish. Product: $(Json $p) Gauntlet: $(Json $g)"
                $lm = Invoke-LM 'You are the Elohim Refinery. Refine verified commerce signals into conservative, executable next actions. Evidence before claims.' $prompt
                $content = [string]$lm.choices[0].message.content
                $actionPath=Join-Path $script:QueueDir (([string]$p.id) + '.json')
                [ordered]@{schema='BEC-AUTONOMY-ACTION-1'; created_utc=(Get-Date).ToUniversalTime().ToString('o'); product=$p; gauntlet=$g; refinery=$content; publish='APPROVAL_REQUIRED'; checkout='BUYER_INITIATED_ONLY'} | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $actionPath -Encoding UTF8
                $actions++
            } else { $fails++ }
        }
        $proof=Write-Proof $cycle $products.Count $passes $fails $actions
        Write-Log "CYCLE $cycle PASS products=$($products.Count) gauntlet_pass=$passes gauntlet_fail=$fails actions=$actions proof=$proof"
    } catch { Write-Log "CYCLE $cycle FAIL $($_.Exception.Message)" }
    if ($Once) { break }
    Start-Sleep -Seconds ([int]$config.poll_seconds)
}
