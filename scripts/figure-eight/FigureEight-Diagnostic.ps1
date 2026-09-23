#requires -version 5.1
[CmdletBinding()]
param(
    [string]$RepoRoot = "",
    [string]$ProjectRef = "wbwgroygjeyukkspnqiy"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::ASCII

function Resolve-RepoRoot {
    param([string]$Requested)
    if (-not [string]::IsNullOrWhiteSpace($Requested)) {
        if (-not (Test-Path (Join-Path $Requested "supabase\migrations"))) {
            throw "RepoRoot does not contain supabase\migrations: $Requested"
        }
        return (Resolve-Path $Requested).Path
    }
    $here = (Resolve-Path $PSScriptRoot).Path
    while ($here -and (Split-Path $here -Parent) -ne $here) {
        if (Test-Path (Join-Path $here "supabase\migrations")) { return $here }
        $here = Split-Path $here -Parent
    }
    throw "Figure Eight repo was not found. Run this script from the DreamLedger checkout or pass -RepoRoot."
}

$RepoRoot = Resolve-RepoRoot $RepoRoot
$ProofDir = Join-Path $RepoRoot "proof\figure-eight"
$ProofPath = Join-Path $ProofDir "diagnostic.json"
New-Item -ItemType Directory -Force -Path $ProofDir | Out-Null

$results = New-Object System.Collections.Generic.List[object]
function Add-Check {
    param([string]$Name,[ValidateSet("PASS","WARN","FAIL","UNPROVEN")][string]$Status,[string]$Detail)
    $results.Add([pscustomobject]@{ name=$Name; status=$Status; detail=$Detail })
}

function Test-File {
    param([string]$Relative,[string]$Name=$Relative)
    $p=Join-Path $RepoRoot $Relative
    Add-Check $Name (if (Test-Path $p) {"PASS"} else {"FAIL"}) (if (Test-Path $p) {$p} else {"MISSING: $p"})
}

Test-File "scripts\figure-eight\FigureEight-Bootstrap.ps1"
Test-File "scripts\figure-eight\FigureEight-Verify.ps1"
Test-File "scripts\figure-eight\FigureEight.Common.ps1"
Test-File "scripts\figure-eight\state-machine.json"
Test-File "scripts\figure-eight\workers\FigureEight-Controller.ps1"
Test-File "scripts\figure-eight\workers\FigureEight-Actuator.ps1"
Test-File "scripts\figure-eight\workers\FigureEight-Reconciler.ps1"
Test-File "scripts\figure-eight\workers\FigureEight-Verifier.ps1"
Test-File "scripts\figure-eight\workers\FigureEight-Learner.ps1"
Test-File "scripts\figure-eight\workers\FigureEight-Replicator.ps1"

$migrations = @(
    "20260923190000_figure_eight_governance_physics_v1.sql",
    "20260923200000_figure_eight_runtime_workers_v2.sql",
    "20260923203000_figure_eight_runtime_workers_v3.sql",
    "20260923204000_figure_eight_worker_api_v3.sql"
)
foreach($m in $migrations){ Test-File ("supabase\migrations\"+$m) ("migration:"+$m) }

foreach($pair in @(
    @("FigureEight.Common.ps1","Get-Sha256Text"),
    @("FigureEight.Common.ps1","Invoke-FigureEightRpc"),
    @("FigureEight.Common.ps1","Invoke-StripePost"),
    @("FigureEight.Common.ps1","Invoke-StripeGetRaw")
)){
    $p=Join-Path $RepoRoot ("scripts\figure-eight\"+$pair[0])
    if (Test-Path $p) {
        $txt=Get-Content $p -Raw
        Add-Check ("function:"+$pair[1]) (if ($txt -match ("function\s+"+[regex]::Escape($pair[1])+"\b")) {"PASS"} else {"FAIL"}) $p
    }
}

$machineFiles=@(
    "public\agent.json",
    "public\agent-commerce.json",
    "public\.well-known\dreamledger.json"
)
foreach($rel in $machineFiles){
    $p=Join-Path $RepoRoot $rel
    if(-not(Test-Path $p)){ Add-Check ("json:"+$rel) "FAIL" "MISSING"; continue }
    try {
        Get-Content $p -Raw | ConvertFrom-Json | Out-Null
        Add-Check ("json:"+$rel) "PASS" "valid JSON"
    } catch {
        Add-Check ("json:"+$rel) "FAIL" $_.Exception.Message
    }
}

$sitemap=Join-Path $RepoRoot "public\sitemap.xml"
if(Test-Path $sitemap){
    $xml=Get-Content $sitemap -Raw
    $broken=@()
    [regex]::Matches($xml,'<loc>([^<]+)</loc>') | ForEach-Object {
        $u=$_.Groups[1].Value
        try {
            $uri=[Uri]$u
            if($uri.Host -ne "dreamledger.org"){ return }
            $path=$uri.AbsolutePath
            if($path -eq "/" ){ $candidate=Join-Path $RepoRoot "public\index.html" }
            elseif($path.EndsWith("/")){ $candidate=Join-Path $RepoRoot ("public"+$path+"index.html") }
            elseif($path.EndsWith(".xml")){ $candidate=Join-Path $RepoRoot ("public"+$path) }
            else { $candidate=Join-Path $RepoRoot ("public"+$path+".html") }
            if(-not(Test-Path $candidate)){
                if($path -eq "/truth-oracle"){ $candidate=Join-Path $RepoRoot "public\truth-oracle\index.html" }
                elseif($path -eq "/overpaying"){ $candidate=Join-Path $RepoRoot "public\overpaying\index.html" }
                elseif($path -eq "/mtg"){ $candidate=Join-Path $RepoRoot "public\mtg\index.html" }
                elseif($path -eq "/billboard"){ $candidate=Join-Path $RepoRoot "public\billboard\index.html" }
                elseif($path -eq "/dreammeez"){ $candidate=Join-Path $RepoRoot "public\dreammeez\index.html" }
                elseif($path -eq "/guides"){ $candidate=Join-Path $RepoRoot "public\guides\index.html" }
                elseif($path -eq "/guides/commander-deck-upgrades-nz"){ $candidate=Join-Path $RepoRoot "public\guides\commander-deck-upgrades-nz\index.html" }
            }
            if(-not(Test-Path $candidate)){ $broken += $u }
        } catch {}
    }
    if($broken.Count -eq 0){ Add-Check "sitemap_local_resolution" "PASS" "all checked URLs resolve to local artifacts" }
    else { Add-Check "sitemap_local_resolution" "FAIL" (($broken -join "; ")) }
} else { Add-Check "sitemap_local_resolution" "FAIL" "public/sitemap.xml missing" }

$common=Join-Path $RepoRoot "scripts\figure-eight\FigureEight.Common.ps1"
if(Test-Path $common){
    $ct=Get-Content $common -Raw
    Add-Check "stripe_secret_configuration" (if($env:STRIPE_SECRET_KEY){"PASS"}else{"WARN"}) (if($env:STRIPE_SECRET_KEY){"STRIPE_SECRET_KEY present; value not printed"}else{"STRIPE_SECRET_KEY not set in this shell"})
    Add-Check "supabase_service_configuration" (if($env:SUPABASE_URL -and ($env:SUPABASE_SERVICE_ROLE_KEY -or $env:SUPABASE_SERVICE_KEY)){"PASS"}else{"WARN"}) (if($env:SUPABASE_URL){"SUPABASE_URL present; secret not printed"}else{"SUPABASE_URL not set in this shell"})
}

# Economic truth is never inferred from files, rows, checkouts, or manifests.
Add-Check "economic_truth_default" "PASS" "This diagnostic never promotes simulated, internal, checkout-only, or test evidence to revenue."

# The 20 acceptance contracts are explicit. Positive end-to-end economic tests become PROVEN only after a real external loop exists.
$contracts=@(
"real_external_signal_creates_cell",
"signal_to_opportunity_requires_linked_opportunity",
"proposition_to_gauntlet_requires_verdict",
"gauntlet_to_authorization_requires_approval_request",
"authorization_requires_human_approval",
"actuator_refuses_non_authorized",
"stable_dedup_key_on_retry",
"duplicate_external_event_rejected",
"reconciliation_works_without_webhook",
"verifier_requires_direct_stripe_observation",
"verification_records_raw_hash_and_query",
"verification_is_reproducible",
"learner_requires_independent_verification",
"learner_requires_observed_fossil",
"learner_outputs_required_patterns",
"replicator_requires_verified_mechanism",
"replicator_outputs_match_score_and_fields",
"restart_is_idempotent",
"failed_external_action_returns_to_action_ready",
"test_simulated_internal_unmatched_never_create_rev_atom"
)
foreach($name in $contracts){ Add-Check ("contract:"+$name) "UNPROVEN" "Requires runtime/fixture evidence; diagnostic will not claim PASS by string presence." }

$counts=@{}
foreach($s in @("PASS","WARN","FAIL","UNPROVEN")){ $counts[$s]=@($results | Where-Object status -eq $s).Count }
$proof=[ordered]@{
    schema="dreamledger.figure_eight.diagnostic.v1"
    generated_at_utc=(Get-Date).ToUniversalTime().ToString("o")
    repo_root=$RepoRoot
    project_ref=$ProjectRef
    counts=$counts
    economic_truth=@{
        verified_external_revenue_nzd=0
        status="UNVERIFIED_UNLESS_REV_ATOM_EXISTS"
    }
    checks=$results
}
$proof | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $ProofPath -Encoding UTF8

$results | Format-Table -AutoSize
Write-Host ""
Write-Host ("FIGURE EIGHT DIAGNOSTIC: PASS={0} WARN={1} FAIL={2} UNPROVEN={3}" -f $counts.PASS,$counts.WARN,$counts.FAIL,$counts.UNPROVEN)
Write-Host ("Proof: {0}" -f $ProofPath)

if($counts.FAIL -gt 0){ exit 2 }
exit 0
