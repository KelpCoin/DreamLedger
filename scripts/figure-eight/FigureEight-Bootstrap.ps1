#requires -version 5.1
[CmdletBinding()]
param(
  [switch]$Apply,
  [switch]$VerifyOnly,
  [string]$ProjectRef = "wbwgroygjeyukkspnqiy"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$ProofDir = Join-Path $Repo "proof"
$SqlPath = Join-Path $Repo "supabase\migrations\20260923190000_figure_eight_governance_physics_v1.sql"
$ProofPath = Join-Path $ProofDir "figure-eight-bootstrap-proof.json"

New-Item -ItemType Directory -Force -Path $ProofDir | Out-Null

function Fail([string]$m) {
  Write-Error $m
  exit 1
}

function Require-Command([string]$name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    Fail "Required command not found: $name"
  }
}

if (-not (Test-Path $SqlPath)) {
  Fail "Migration missing: $SqlPath"
}

$checks = @()
$checks += [pscustomobject]@{ name="migration_present"; pass=(Test-Path $SqlPath) }
$checks += [pscustomobject]@{ name="project_ref"; pass=($ProjectRef -eq "wbwgroygjeyukkspnqiy") }

if (-not $VerifyOnly) {
  Require-Command "supabase"

  if ($Apply) {
    Write-Host "FIGURE EIGHT: pushing governed migration to $ProjectRef"
    & supabase link --project-ref $ProjectRef
    if ($LASTEXITCODE -ne 0) { Fail "supabase link failed" }

    & supabase db push --dry-run
    if ($LASTEXITCODE -ne 0) { Fail "migration dry-run failed" }

    & supabase db push
    if ($LASTEXITCODE -ne 0) { Fail "migration push failed" }
  }
}

$checks += [pscustomobject]@{
  name="apply_mode"
  pass=($VerifyOnly -or $Apply)
}

$proof = [ordered]@{
  schema = "figure_eight"
  project_ref = $ProjectRef
  migration = Split-Path $SqlPath -Leaf
  generated_at_utc = (Get-Date).ToUniversalTime().ToString("o")
  external_actions_performed = $false
  economic_truth_changed = $false
  checks = $checks
  required_runtime = @(
    "private_substrate",
    "append_only_event_log",
    "fossil_contract",
    "write_gate",
    "promotion_gate_policy",
    "release_gate",
    "instruction_boundary_envelope",
    "dependency_graph",
    "bi_temporal_fields",
    "durable_approval",
    "budget_reservation",
    "execution_receipts",
    "capability_graduation",
    "demotion",
    "economic_alignment_score",
    "seo_governance"
  )
  economic_scoreboard = @{
    verified_external_revenue_nzd = 0
    independent_buyers = 0
    settled_payments = 0
    fulfillments = 0
    verified_economic_fossils = 0
  }
}
$proof | ConvertTo-Json -Depth 10 | Set-Content -Encoding ASCII $ProofPath
Write-Host "FIGURE EIGHT BOOTSTRAP: READY"
Write-Host "Proof: $ProofPath"
