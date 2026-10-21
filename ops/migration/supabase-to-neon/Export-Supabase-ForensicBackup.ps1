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
$pgRestore = Get-Command pg_restore -ErrorAction SilentlyContinue
if (-not $psql -or -not $pgDump -or -not $pgRestore) {
  throw "Install PostgreSQL client tools (psql, pg_dump, and pg_restore) before running this export."
}

try {
  if (-not (Test-Path -LiteralPath "D:\")) { throw "D: unavailable" }
  New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null
} catch {
  if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) { throw "No writable private proof location is available." }
  $OutputRoot = Join-Path $env:LOCALAPPDATA "DreamLedger\migration-proof"
  New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null
}

try {
  $stamp = [DateTime]::UtcNow.ToString("yyyyMMddTHHmmssZ")
  $dest = Join-Path $OutputRoot $stamp
  New-Item -ItemType Directory -Path $dest -Force | Out-Null

  $env:PGSSLMODE = "require"
  $env:PGCONNECT_TIMEOUT = "15"
  if ([string]::IsNullOrWhiteSpace($env:PGPORT)) { $env:PGPORT = "5432" }

  $connArgs = @("-h", $env:PGHOST, "-p", $env:PGPORT, "-U", $env:PGUSER, "-d", $env:PGDATABASE, "-w")
  $inventoryPath = Join-Path $dest "source-inventory.json"
  $inventory = & $psql.Source @connArgs -X -v ON_ERROR_STOP=1 -A -t -f (Join-Path $PSScriptRoot "preflight.sql") 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "Read-only database inventory failed. No database changes were made. Check source connectivity and credentials, then retry."
  }
  ($inventory -join [Environment]::NewLine) | Set-Content -LiteralPath $inventoryPath -Encoding UTF8

  $dumpPath = Join-Path $dest "supabase-full-source.dump"
  & $pgDump.Source @connArgs --format=custom --no-owner --no-acl --file $dumpPath 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Full source backup failed. No database changes were made. Inspect the private proof directory before retrying."
  }

  $schemaPath = Join-Path $dest "supabase-full-schema.sql"
  & $pgDump.Source @connArgs --schema-only --no-owner --no-acl --file $schemaPath 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Schema backup failed. The full backup may exist already; inspect the private proof directory before retrying."
  }

  $restoreListingPath = Join-Path $dest "pg-restore-list.txt"
  & $pgRestore.Source --list $dumpPath 2>&1 | Set-Content -LiteralPath $restoreListingPath -Encoding UTF8
  if ($LASTEXITCODE -ne 0) {
    throw "The custom-format backup failed pg_restore validation. Preserve the private proof directory and investigate."
  }

  $names = @("source-inventory.json", "supabase-full-source.dump", "supabase-full-schema.sql", "pg-restore-list.txt")
  $hashes = foreach ($name in $names) {
    $filePath = Join-Path $dest $name
    $item = Get-Item -LiteralPath $filePath
    if ($item.Length -le 0) { throw "Expected evidence file is empty: $name" }
    $hash = Get-FileHash -LiteralPath $filePath -Algorithm SHA256
    [PSCustomObject]@{ file = $name; bytes = $item.Length; sha256 = $hash.Hash }
  }

  $manifest = [PSCustomObject]@{
    schema = "dreamledger/supabase-source-backup/v1"
    status = "SOURCE_BACKUP_CREATED"
    captured_at_utc = [DateTime]::UtcNow.ToString("o")
    source_project_ref = "wbwgroygjeyukkspnqiy"
    source_database = $env:PGDATABASE
    source_host = $env:PGHOST
    imported_to_neon = $false
    source_modified = $false
    restore_listing_valid = $true
    hashes = @($hashes)
    next_gate = "Review all-schema dependency inventory, then define the exact include/reimplement/replace/exclude scope before any import."
  }
  $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $dest "manifest.json") -Encoding UTF8
  $hashes | ForEach-Object { "$($_.sha256)  $($_.file)" } | Set-Content -LiteralPath (Join-Path $dest "SHA256SUMS.txt") -Encoding ASCII

  [PSCustomObject]@{
    status = "PASS"
    proof_directory = $dest
    files = @($names) + @("manifest.json", "SHA256SUMS.txt")
    imported_to_neon = $false
    source_modified = $false
    instruction = "Keep this artifact private. Never restore Supabase-managed auth/storage/realtime internals into Neon without dependency review."
  } | ConvertTo-Json -Depth 6
}
finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:PGSSLMODE -ErrorAction SilentlyContinue
  Remove-Item Env:PGCONNECT_TIMEOUT -ErrorAction SilentlyContinue
}
