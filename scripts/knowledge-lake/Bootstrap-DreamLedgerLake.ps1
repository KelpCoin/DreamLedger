param(
  [string]$SupabaseUrl = $env:SUPABASE_URL,
  [string]$SupabaseServiceRoleKey = $env:SUPABASE_SERVICE_ROLE_KEY,
  [string]$Root = 'C:\DreamLedger_Actual\knowledge-lake'
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($SupabaseUrl)) { throw 'SUPABASE_URL is required.' }
if ([string]::IsNullOrWhiteSpace($SupabaseServiceRoleKey)) { throw 'SUPABASE_SERVICE_ROLE_KEY is required.' }

New-Item -ItemType Directory -Force -Path $Root | Out-Null
$Fossils = Join-Path $Root 'fossils.ndjson'
$Manifest = Join-Path $Root 'sync-manifest.json'

if (-not (Test-Path $Fossils)) { New-Item -ItemType File -Path $Fossils | Out-Null }
if (-not (Test-Path $Manifest)) { Set-Content -Path $Manifest -Value '{"node_id":"LOCAL-PC","fossils":{}}' -Encoding ASCII }

$headers = @{
  apikey = $SupabaseServiceRoleKey
  Authorization = "Bearer $SupabaseServiceRoleKey"
}

$url = "$($SupabaseUrl.TrimEnd('/'))/rest/v1/knowledge_fossils?select=*&order=created_at.asc"
$rows = Invoke-RestMethod -Method Get -Uri $url -Headers $headers

$manifest = Get-Content $Manifest -Raw | ConvertFrom-Json
$seen = @{}
if ($manifest.fossils) {
  $manifest.fossils.psobject.Properties | ForEach-Object { $seen[$_.Name] = $_.Value }
}

foreach ($row in $rows) {
  if (-not $seen.ContainsKey($row.fossil_id)) {
    ($row | ConvertTo-Json -Compress -Depth 20) | Add-Content -Path $Fossils -Encoding UTF8
    $seen[$row.fossil_id] = $row.content_sha256
  }
}

$out = [ordered]@{
  node_id = 'LOCAL-PC'
  updated_at = (Get-Date).ToUniversalTime().ToString('o')
  fossils = $seen
}
$out | ConvertTo-Json -Depth 20 | Set-Content -Path $Manifest -Encoding UTF8

Write-Host "DreamLedger knowledge lake bootstrapped."
Write-Host "Cloud fossils: $($rows.Count)"
Write-Host "Local path: $Root"
