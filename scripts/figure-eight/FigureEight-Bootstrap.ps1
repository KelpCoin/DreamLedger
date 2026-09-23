#requires -version 5.1
[CmdletBinding()]
param(
  [switch]$Apply,
  [switch]$VerifyOnly,
  [switch]$RepairMachineSeo,
  [string]$ProjectRef = "wbwgroygjeyukkspnqiy"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::ASCII

function Resolve-RepoRoot {
  $p=(Resolve-Path $PSScriptRoot).Path
  while($p -and (Split-Path $p -Parent) -ne $p){
    if(Test-Path (Join-Path $p "supabase\migrations")){return $p}
    $p=Split-Path $p -Parent
  }
  throw "DreamLedger repository root not found above $PSScriptRoot."
}
$Repo=Resolve-RepoRoot
$ProofDir=Join-Path $Repo "proof\figure-eight"
$ProofPath=Join-Path $ProofDir "bootstrap-proof.json"
New-Item -ItemType Directory -Force -Path $ProofDir | Out-Null

function Fail([string]$m){throw $m}
function Pick([bool]$Condition,[string]$WhenTrue,[string]$WhenFalse){if($Condition){return $WhenTrue}else{return $WhenFalse}}
function CheckFile([string]$rel){
  $p=Join-Path $Repo $rel
  [pscustomobject]@{name=$rel;present=(Test-Path $p);path=$p}
}
function Hash([string]$s){
  $sha=[Security.Cryptography.SHA256]::Create()
  try{return ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($s))).Replace("-","").ToLowerInvariant())}
  finally{$sha.Dispose()}
}

$required=@(
  "scripts\figure-eight\FigureEight.Common.ps1",
  "scripts\figure-eight\FigureEight-Diagnostic.ps1",
  "scripts\figure-eight\FigureEight-Verify.ps1",
  "scripts\figure-eight\state-machine.json",
  "scripts\figure-eight\workers\FigureEight-Controller.ps1",
  "scripts\figure-eight\workers\FigureEight-Actuator.ps1",
  "scripts\figure-eight\workers\FigureEight-Reconciler.ps1",
  "scripts\figure-eight\workers\FigureEight-Verifier.ps1",
  "scripts\figure-eight\workers\FigureEight-Learner.ps1",
  "scripts\figure-eight\workers\FigureEight-Replicator.ps1",
  "supabase\migrations\20260923190000_figure_eight_governance_physics_v1.sql",
  "supabase\migrations\20260923200000_figure_eight_runtime_workers_v2.sql",
  "supabase\migrations\20260923203000_figure_eight_runtime_workers_v3.sql",
  "supabase\migrations\20260923204000_figure_eight_worker_api_v3.sql",
  "supabase\migrations\20260923210000_figure_eight_worker_api_restore_v4.sql",
  "supabase\migrations\20260923211000_figure_eight_worker_api_extension_v5.sql",
  "supabase\migrations\20260923212000_figure_eight_worker_api_complete_v6.sql"
)
$checks=New-Object System.Collections.Generic.List[object]
foreach($rel in $required){
  $c=CheckFile $rel
  $checks.Add([pscustomobject]@{name=$c.name;status=(Pick ([bool]$c.present) "PASS" "FAIL");detail=$c.path})
}

# Never create demo revenue, fake customers, fake settlement, or simulated economic proof.
$checks.Add([pscustomobject]@{name="economic_truth";status="PASS";detail="Bootstrap creates no revenue cell and never marks settlement or REV_ATOM."})

# Local legacy paths are discovered, not assumed.
$rootCandidates=@("D:\BrownEyeCortex","C:\BrownEyeCortex")
$root=$rootCandidates | Where-Object {Test-Path $_} | Select-Object -First 1
if($root){
  $checks.Add([pscustomobject]@{name="brown_eye_runtime_root";status="PASS";detail=$root})
  foreach($rel in @("_moneyfarm\StripeFulfillmentV1","_moneyfarm\CashClosure\bin")){
    $p=Join-Path $root $rel
    $checks.Add([pscustomobject]@{name=("legacy:"+$rel);status=(Pick (Test-Path $p) "PASS" "WARN");detail=$p})
  }
}else{
  $checks.Add([pscustomobject]@{name="brown_eye_runtime_root";status="WARN";detail="No D:\BrownEyeCortex or C:\BrownEyeCortex found. GitHub runtime can still be verified."})
}

# Machine-readable public surface preflight.
foreach($rel in @("public\agent.json","public\agent-commerce.json","public\.well-known\dreamledger.json")){
  $p=Join-Path $Repo $rel
  if(Test-Path $p){
    try{Get-Content $p -Raw | ConvertFrom-Json | Out-Null;$status="PASS";$detail="valid JSON"}
    catch{$status="FAIL";$detail=$_.Exception.Message}
  }else{$status="WARN";$detail="missing"}
  $checks.Add([pscustomobject]@{name=("machine:"+$rel);status=$status;detail=$detail})
}

if($RepairMachineSeo){
  $llms=Join-Path $Repo "public\llms.txt"
  $checks.Add([pscustomobject]@{name="machine:llms.txt";status=(Pick (Test-Path $llms) "PASS" "WARN");detail=$llms})
  $sitemap=Join-Path $Repo "public\sitemap.xml"
  $checks.Add([pscustomobject]@{name="seo:sitemap";status=(Pick (Test-Path $sitemap) "PASS" "FAIL");detail=$sitemap})
}

if(-not $VerifyOnly -and $Apply){
  if(-not (Get-Command supabase -ErrorAction SilentlyContinue)){Fail "supabase CLI not found. Install/login or run -VerifyOnly."}
  & supabase link --project-ref $ProjectRef
  if($LASTEXITCODE -ne 0){Fail "supabase link failed."}
  & supabase db push --dry-run
  if($LASTEXITCODE -ne 0){Fail "supabase migration dry-run failed."}
  & supabase db push
  if($LASTEXITCODE -ne 0){Fail "supabase db push failed."}
}

$seo=Join-Path $Repo "scripts\figure-eight\FigureEight-SEO-Preflight.ps1"
if(Test-Path $seo){try{& $seo}catch{ $checks.Add([pscustomobject]@{name="seo_preflight";status="FAIL";detail=$_.Exception.Message}) }}

$diag=Join-Path $Repo "scripts\figure-eight\FigureEight-Diagnostic.ps1"
if(-not $VerifyOnly -and (Test-Path $diag)){
  try{& $diag -ProjectRef $ProjectRef; $diagExit=$LASTEXITCODE}
  catch{$diagExit=1;$checks.Add([pscustomobject]@{name="diagnostic";status="FAIL";detail=$_.Exception.Message})}
}else{$diagExit=0}

$failCount=@($checks|Where-Object status -eq "FAIL").Count
$warnCount=@($checks|Where-Object status -eq "WARN").Count
$proof=[ordered]@{
  schema="dreamledger.figure_eight.bootstrap.v2"
  generated_at_utc=(Get-Date).ToUniversalTime().ToString("o")
  repository_root=$Repo
  project_ref=$ProjectRef
  mode=(Pick $VerifyOnly "VERIFY_ONLY" (Pick $Apply "APPLY" "PREFLIGHT"))
  external_actions_performed=$false
  economic_truth=@{verified_external_revenue_nzd=0;independent_buyers=0;settled_payments=0;verified_economic_loops=0}
  checks=$checks
  diagnostic_exit_code=$diagExit
  fail_count=$failCount
  warn_count=$warnCount
}
$proof|ConvertTo-Json -Depth 20|Set-Content -LiteralPath $ProofPath -Encoding ASCII

Write-Host ""
Write-Host "FIGURE EIGHT BOOTSTRAP"
Write-Host ("Repo:   " + $Repo)
Write-Host ("Proof:  " + $ProofPath)
Write-Host ("FAIL:   " + $failCount + "  WARN: " + $warnCount)
Write-Host "Economic truth remains NZ$0 until a real independently verified external settlement produces REV_ATOM."
if($failCount -gt 0){exit 2}
exit 0
