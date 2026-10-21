param(
  [string]$OutputRoot = "D:\BrownEyeCortex\Proof\DreamLedger-Migration"
)
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

foreach ($name in @("PGHOST", "PGDATABASE", "PGUSER", "PGPASSWORD")) {
  if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) {
    throw "Set $name in this PowerShell process using the approved Supabase connection details. Do not paste credentials into chat or commit them."
  }
}
$psql = Get-Command psql -ErrorAction SilentlyContinue
$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $psql -or -not $pgDump) { throw "Install PostgreSQL client tools (psql and pg_dump) first." }

try {
  if (-not (Test-Path -LiteralPath "D:\")) { throw "D: unavailable" }
  New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null
} catch {
  if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) { throw "No writable private proof location is available." }
  $OutputRoot = Join-Path $env:LOCALAPPDATA "DreamLedger\migration-proof"
  New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null
}
$stamp = [DateTime]::UtcNow.ToString("yyyyMMddTHHmmssZ")
$dest = Join-Path $OutputRoot $stamp
New-Item -ItemType Directory -Path $dest -Force | Out-Null
$env:PGSSLMODE = "require"
$env:PGCONNECT_TIMEOUT = "15"
$args = @("-h", $env:PGHOST, "-p", $(if ($env:PGPORT) { $env:PGPORT } else { "5432" }), "-U", $env:PGUSER, "-d", $env:PGDATABASE, "-w")
$inventoryPath = Join-Path $dest "source-inventory.json"
$inventory = & $psql.Source @args -X -v ON_ERROR_STOP=1 -A -t -f (Join-Path $PSScriptRoot "preflight.sql") 2>&1
if ($LASTEXITCODE -ne 0) { throw "Read-only database inventory failed. No source data was changed. Check network/pooler connectivity and retry." }
$inventory | Set-Content -LiteralPath $inventoryPath -Encoding UTF8

$dumpPath = Join-Path $dest "supabase-full-source.dump"
& $pgDump.Source @args --format=custom --no-owner --no-acl --file $dumpPath
if ($LASTEXITCODE -ne 0) { throw "Full source backup failed. No database changes were made. Inspect the private proof folder before retrying." }
$schemaPath = Join-Path $dest "supabase-full-schema.sql"
& $pgDump.Source @args --schema-only --no-owner --no-acl --file $schemaPath
if ($LASTEXITCODE -ne 0) { throw "Schema backup failed. Full backup may exist; inspect the private proof folder before retrying." }

$hashes = @()
foreach ($name in @("source-inventory.json", "supabase-full-source.dump", "supabase-full-schema.sql")) {
  $filePath = Join-Path $dest $name
  $hash = Get-FileHash -LiteralPath $filePath -Algorithm SHA256
  $hashes += [PSCustomObject]@{ file = $name; bytes = (Get-Item -LiteralPath $filePath).Length; sha256 = $hash.Hash }
}
$manifest = [PSCustomObject]@{
  status = "SOURCE_BACKUP_CREATED"
  captured_at_utc = [DateTime]::UtcNow.ToString("o")
  source_project_ref = "wbwgroygjeyukkspnqiy"
  source_database = $env:PGDATABASE
  source_host = $env:PGHOST
  imported = $false
  source_modified = $false
  hashes = $hashes
  next_gate = "Review auth/storage/function dependencies before selecting a Neon import scope."
}
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $dest "manifest.json") -Encoding UTF8
$hashes | ForEach-Object { "$($_.sha256)  $($_.file)" } | Set-Content -LiteralPath (Join-Path $dest "SHA256SUMS.txt") -Encoding ASCII
[PSCustomObject]@{ status = "PASS"; proof_directory = $dest; imported_to_neon = $false; source_modified = $false; note = "Keep backup private and do not restore Supabase auth/storage schemas into Neon without dependency review." } | ConvertTo-Json -Depth 6

Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
Remove-Item Env:PGSSLMODE -ErrorAction SilentlyContinue
Remove-Item Env:PGCONNECT_TIMEOUT -ErrorAction SilentlyContinue
