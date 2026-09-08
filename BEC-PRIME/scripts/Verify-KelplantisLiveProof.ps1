[CmdletBinding()]
param(
  [string]$ProofPath = "compiled/universal/game/kelplantis-mvp/kelplantis-live-browser-e2e-proof.json"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$full = Join-Path $root $ProofPath
if (-not (Test-Path -LiteralPath $full)) { throw "Proof not found: $full" }

$proof = Get-Content -LiteralPath $full -Raw | ConvertFrom-Json
$required = @(
  "player_created",
  "floor_1_entered",
  "movement_authoritative",
  "encounter_authoritative",
  "combat_authoritative",
  "boss_clear_authoritative",
  "world_consequence_observed",
  "floor_2_unlocked",
  "state_survived_reload",
  "illegal_floor_2_entry_rejected",
  "illegal_boss_clear_rejected",
  "illegal_world_mutation_rejected"
)

if ($proof.schema -ne "bec/kelplantis/live-browser-e2e-proof/v3") { throw "Wrong proof schema: $($proof.schema)" }
if ($proof.status -ne "PASS") { throw "Proof status is not PASS" }

foreach ($name in $required) {
  $value = $proof.$name
  if ($value -ne $true) { throw "Proof assertion failed: $name" }
}

if ($proof.synthetic_events_counted_as_player_evidence -ne $false) { throw "Synthetic evidence flag is unsafe" }
if ($proof.evidence_sha256.Length -ne 64) { throw "Missing or invalid evidence_sha256" }
if ($proof.console_errors.Count -ne 0) { throw "Browser console errors are present" }

Write-Host "KELPLANTIS LIVE PROOF: PASS"
Write-Host "Player: $($proof.player_id)"
Write-Host "Evidence SHA-256: $($proof.evidence_sha256)"
