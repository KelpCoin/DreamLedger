# BECK read-only source export launcher. PowerShell 5.1, ASCII only.
# Does not write to databases, deploy, publish, spend, or change DNS.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$commit = 'ab32223239e3dcd30177616dd1d79b9472d43ec9'
$root = if (Test-Path 'D:\') { 'D:\BrownEyeCortex' } else { 'C:\BrownEyeCortex' }
$proofRoot = Join-Path $root 'Proof\DreamLedger-Migration'
$toolsRoot = Join-Path $root 'TOOLS\Migration'
$runDir = Join-Path $proofRoot ('G02-' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ'))
New-Item -ItemType Directory -Force -Path $runDir, $toolsRoot | Out-Null
$log = Join-Path $runDir 'run.log'
$proof = Join-Path $runDir 'proof.json'
$hashProof = Join-Path $runDir 'proof.sha256'
$status = 'BLOCKED'
$detail = 'NOT_STARTED'
$backup = $null
$transcriptStarted = $false
try {
  Start-Transcript -LiteralPath $log -Force | Out-Null
  $transcriptStarted = $true
  Write-Host 'BECK G02: read-only Supabase source backup, no production changes.'
  $dirs = @($env:PATH -split ';' | Where-Object { $_ })
  if ($env:ProgramFiles) {
    $pgRoot = Join-Path $env:ProgramFiles 'PostgreSQL'
    if (Test-Path $pgRoot) {
      $dirs = @(Get-ChildItem $pgRoot -Directory | ForEach-Object { Join-Path $_.FullName 'bin' }) + $dirs
    }
  }
  $pgBin = $null
  foreach ($d in $dirs) {
    if ((Test-Path (Join-Path $d 'psql.exe')) -and
        (Test-Path (Join-Path $d 'pg_dump.exe')) -and
        (Test-Path (Join-Path $d 'pg_restore.exe'))) { $pgBin = $d; break }
  }
  if (-not $pgBin) { throw 'PostgreSQL 17+ client tools not installed. Install psql, pg_dump and pg_restore and rerun.' }
  $env:PATH = $pgBin + ';' + $env:PATH
  $pgVersion = (& (Join-Path $pgBin 'pg_dump.exe') --version) -join ' '
  if ($pgVersion -notmatch 'PostgreSQL.*(17|18)\.') { throw 'pg_dump 17 or 18 required for Supabase PostgreSQL 17.' }
  Write-Host ('Client: ' + $pgVersion)

  $archive = Join-Path $toolsRoot ('DreamLedger-' + $commit + '.zip')
  $source = Join-Path $toolsRoot ('DreamLedger-' + $commit)
  if (-not (Test-Path $archive)) {
    $url = 'https://github.com/KelpCoin/DreamLedger/archive/' + $commit + '.zip'
    Invoke-WebRequest -Uri $url -OutFile $archive -UseBasicParsing -TimeoutSec 90
  }
  if (-not (Test-Path $source)) {
    New-Item -ItemType Directory -Force -Path $source | Out-Null
    Expand-Archive -LiteralPath $archive -DestinationPath $source -Force
  }
  $match = @(Get-ChildItem $source -Recurse -File -Filter 'Export-Supabase-ForensicBackup.ps1')
  if ($match.Count -ne 1) { throw 'Pinned exporter not found unambiguously.' }
  $exporter = $match[0].FullName
  if (-not (Test-Path (Join-Path $match[0].DirectoryName 'preflight.sql'))) { throw 'Inventory SQL missing.' }
  Write-Host 'Connection info is entered locally, and password is hidden.'
  Write-Host 'If IPv6 fails, use the exact IPv4 Session pooler address from Supabase Connect, port 5432.'
  Write-Host 'Username for Session pooler: postgres.wbwgroygjeyukkspnqiy'
  $target = Join-Path $runDir 'private-source'
  & $exporter -OutputRoot $target
  $manifests = @(Get-ChildItem $target -Recurse -File -Filter 'manifest.json' -ErrorAction SilentlyContinue)
  if ($manifests.Count -ne 1) { throw 'Expected one backup manifest, found different count.' }
  $manifest = Get-Content $manifests[0].FullName -Raw | ConvertFrom-Json
  if ($manifest.status -ne 'SOURCE_BACKUP_CREATED' -or $manifest.source_modified -ne $false -or $manifest.imported_to_neon -ne $false) {
    throw 'Backup manifest fails safe state checks.'
  }
  $backup = $manifests[0].DirectoryName
  if (@($manifest.hashes).Count -lt 4) { throw 'Incomplete backup file list.' }
  foreach ($f in $manifest.hashes) {
    $local = Join-Path $backup $f.file
    if (-not (Test-Path $local)) { throw 'A backup file is missing.' }
    if ((Get-FileHash $local -Algorithm SHA256).Hash -ne $f.sha256) { throw 'Backup hash mismatch.' }
  }
  $status = 'SOURCE_BACKUP_CREATED'
  $detail = 'G02_BACKUP_VALIDATED_SCOPE_REVIEW_REQUIRED'
}
catch {
  $detail = $_.Exception.Message
  Write-Warning $detail
}
finally {
  $obj = [ordered]@{
    schema = 'beck/g02-backup-proof/v1'
    status = $status
    detail = $detail
    captured_utc = [DateTime]::UtcNow.ToString('o')
    source_ref = 'wbwgroygjeyukkspnqiy'
    source_repo_commit = $commit
    source_backup_path = $backup
    source_modified = $false
    neon_import_performed = $false
    public_deployment_performed = $false
    dns_modified = $false
    legacy_providers_removed = $false
    next = if ($status -eq 'SOURCE_BACKUP_CREATED') { 'Review inventory and Auth/Storage/Realtime before scoped Neon import.' } else { 'Fix blocker recorded in log and rerun.' }
  }
  $obj | ConvertTo-Json -Depth 6 | Set-Content $proof -Encoding UTF8
  $sha = (Get-FileHash $proof -Algorithm SHA256).Hash
  ($sha + '  proof.json') | Set-Content $hashProof -Encoding ASCII
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  if ($transcriptStarted) { Stop-Transcript | Out-Null }
  Write-Host ('RESULT: ' + $status)
  Write-Host ('PROOF: ' + $proof)
  Write-Host ('LOG: ' + $log)
  Write-Host ('VERIFY: (Get-FileHash "' + $proof + '" -Algorithm SHA256).Hash -eq "' + $sha + '"')
}
if ($status -ne 'SOURCE_BACKUP_CREATED') { exit 2 }
