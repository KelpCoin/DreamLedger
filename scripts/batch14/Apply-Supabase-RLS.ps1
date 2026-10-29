#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# This script deliberately creates a migration through the Supabase CLI.
# It does not invent a migration filename and does not guess application policies.
# Review the generated migration before applying it to production.

if (-not (Get-Command supabase.exe -ErrorAction SilentlyContinue)) {
  throw "Supabase CLI is required."
}

$tables = @(
  "pre_registrations",
  "evidence_graph_edges",
  "gauntlet_certificates",
  "gauntlet_policy_registry"
)

$name = "batch14_enable_rls_on_public_tables"
supabase migration new $name

$mig = Get-ChildItem -Path ".\supabase\migrations" -Filter "*_$name.sql" |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $mig) { throw "Migration file was not created by Supabase CLI." }

$sql = @(
  "BEGIN;"
  "ALTER TABLE public.pre_registrations ENABLE ROW LEVEL SECURITY;"
  "ALTER TABLE public.evidence_graph_edges ENABLE ROW LEVEL SECURITY;"
  "ALTER TABLE public.gauntlet_certificates ENABLE ROW LEVEL SECURITY;"
  "ALTER TABLE public.gauntlet_policy_registry ENABLE ROW LEVEL SECURITY;"
  "COMMIT;"
) -join [Environment]::NewLine

Set-Content -Path $mig.FullName -Value $sql -Encoding ASCII

Write-Host "Generated migration:"
Write-Host $mig.FullName
Write-Host ""
Write-Host "IMPORTANT: enabling RLS can remove API visibility until correct policies exist."
Write-Host "Inspect the application access model and policies before production apply."
Write-Host ""
Write-Host "Use Supabase CLI help to confirm the current apply command for your installed version."
