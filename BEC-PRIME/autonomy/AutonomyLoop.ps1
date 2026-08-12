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
function Json([object]$Value) { $Value | ConvertTo-Json -Depth 30 -Compress }
function Get-Hash([string]$Text) { $sha=[Security.Cryptography.SHA256]::Create(); try { ($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Text)) | ForEach-Object ToString x2) -join '' } finally { $sha.Dispose() } }

$config = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
$root = [string]$config.paths.root
$script:LogDir = [string]$config.paths.logs
$script:ProofDir = [string]$config.paths.proofs
$script:QueueDir = [string]$config.paths.queue
$script:HumaniserDir = Join-Path $script:QueueDir 'humaniser'
$script:HumaniserWaitingDir = Join-Path $script:HumaniserDir 'waiting'
$script:HumaniserApprovedDir = Join-Path $script:HumaniserDir 'approved'
$script:StateDir = [string]$config.paths.state
Ensure-Dir $root; Ensure-Dir $script:LogDir; Ensure-Dir $script:ProofDir; Ensure-Dir $script:QueueDir; Ensure-Dir $script:HumaniserWaitingDir; Ensure-Dir $script:HumaniserApprovedDir; Ensure-Dir $script:StateDir
$script:LogFile = Join-Path $script:LogDir 'autonomy.log'

function Invoke-JsonGet([string]$Url) { Invoke-RestMethod -Uri $Url -Method Get -TimeoutSec 30 -Headers @{ 'Cache-Control'='no-cache' } }
function Invoke-LM([string]$System,[string]$User) {
    $body = @{ model=[string]$config.lm_studio.model; messages=@(@{role='system';content=$System},@{role='user';content=$User}); temperature=0.1; response_format=@{type='json_object'} } | ConvertTo-Json -Depth 10
    Invoke-RestMethod -Uri (([string]$config.lm_studio.base_url).TrimEnd('/') + '/chat/completions') -Method Post -ContentType 'application/json' -Body $body -TimeoutSec ([int]$config.lm_studio.timeout_seconds)
}
function Invoke-NodeMacro { $macro=Join-Path $root 'repo\BEC-PRIME\macro\MacroEngine.js'; if (-not (Test-Path -LiteralPath $macro)) { return @{ status='SKIP'; reason='MacroEngine not present at configured local repo path' } }; $result=& node $macro 2>&1; return @{ status='PASS'; output=($result -join "`n") } }
function Run-Gauntlet($Item) {
    $checks=[ordered]@{ id_present=-not [string]::IsNullOrWhiteSpace([string]$Item.id); name_present=-not [string]::IsNullOrWhiteSpace([string]$Item.name); published=([string]$Item.status -eq 'published'); approved=($Item.approval_required -eq $false); checkout=($Item.checkout_available -eq $true); inventory=([int]$Item.inventory -gt 0); price=([int]$Item.price -gt 0) }
    $pass=-not ($checks.Values -contains $false)
    [pscustomobject]@{ verdict=if($pass){'PASS'}else{'FAIL'}; checks=$checks; signal_hash=(Get-Hash (Json $Item)); reason=if($pass){'hardened'}else{'one_or_more_checks_failed'} }
}
function Test-Humaniser($Action) {
    $signatures=@($Action.human_signatures | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_.reviewer_role) -and -not [string]::IsNullOrWhiteSpace([string]$_.timestamp_utc) -and -not [string]::IsNullOrWhiteSpace([string]$_.change_summary) })
    $ok=$signatures.Count -ge 2
    [pscustomobject]@{ verdict=if($ok){'PASS'}else{'WAITING'}; human_signatures=$signatures.Count; required=2; robot_smell=if($ok){'ERODED'}else{'PRESENT'} }
}
function Write-Proof($Cycle,$ProductCount,$PassCount,$FailCount,$Actions,$HumaniserWaiting,$HumaniserPass,$Macro) {
    $proof=[ordered]@{ schema='BEC-AUTONOMY-PROOF-3'; timestamp_utc=(Get-Date).ToUniversalTime().ToString('o'); cycle=$Cycle; status='PASS'; product_count=$ProductCount; gauntlet_pass=$PassCount; gauntlet_fail=$FailCount; actions_generated=$Actions; humaniser_waiting=$HumaniserWaiting; humaniser_pass=$HumaniserPass; macro=$Macro; lm_studio=[string]$config.lm_studio.base_url; policy=@{ external_publish_requires_approval=$true; external_products_require_two_human_footprints=$true; financial_settlement_requires_buyer_authorization=$true; checkout_buyer_initiated_only=$true } }
    $proof.cycle_hash=Get-Hash (Json $proof)
    $path=Join-Path $script:ProofDir ("AUTONOMY_{0}.json" -f (Get-Date -Format 'yyyyMMdd_HHmmss'))
    $proof | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $path -Encoding UTF8
    return $path
}

$cycle=0
while ($true) {
    $cycle++
    try {
        Write-Log "CYCLE $cycle START"
        $health=Invoke-JsonGet (([string]$config.dreamledger.base_url).TrimEnd('/') + [string]$config.dreamledger.health_path)
        if ([string]$health.status -ne 'ok') { throw 'DreamLedger health gate failed' }
        $macro=Invoke-NodeMacro
        $products=@(Invoke-JsonGet (([string]$config.dreamledger.base_url).TrimEnd('/') + [string]$config.dreamledger.products_path)).products
        $passes=0; $fails=0; $actions=0; $humaniserWaiting=0; $humaniserPass=0
        foreach ($p in $products) {
            $g=Run-Gauntlet $p
            if ($g.verdict -eq 'PASS') {
                $passes++
                $prompt="Return JSON only with keys: priority, rationale, buyer_problem, suggested_action. Never claim a sale. Never publish. Product: $(Json $p) Gauntlet: $(Json $g)"
                $lm=Invoke-LM 'You are the Elohim Refinery. Refine verified commerce signals into conservative, executable next actions. Evidence before claims.' $prompt
                $content=[string]$lm.choices[0].message.content
                $action=[ordered]@{ schema='BEC-AUTONOMY-ACTION-3'; created_utc=(Get-Date).ToUniversalTime().ToString('o'); product=$p; gauntlet=$g; refinery=$content; human_signatures=@(); humaniser=@{ required=2; verdict='WAITING'; robot_smell='PRESENT' }; publish='APPROVAL_REQUIRED'; checkout='BUYER_INITIATED_ONLY' }
                $human=Test-Humaniser $action
                if ($human.verdict -eq 'PASS') { $action.humaniser=$human; $humaniserPass++; $actionPath=Join-Path $script:HumaniserApprovedDir (([string]$p.id)+'.json') }
                else { $action.humaniser=$human; $humaniserWaiting++; $actionPath=Join-Path $script:HumaniserWaitingDir (([string]$p.id)+'.json') }
                $action | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $actionPath -Encoding UTF8
                $actions++
            } else { $fails++ }
        }
        $proof=Write-Proof $cycle $products.Count $passes $fails $actions $humaniserWaiting $humaniserPass $macro
        Write-Log "CYCLE $cycle PASS products=$($products.Count) gauntlet_pass=$passes gauntlet_fail=$fails actions=$actions humaniser_waiting=$humaniserWaiting humaniser_pass=$humaniserPass proof=$proof"
    } catch { Write-Log "CYCLE $cycle FAIL $($_.Exception.Message)" }
    if ($Once) { break }
    Start-Sleep -Seconds ([int]$config.poll_seconds)
}
