#Requires -Version 5.1
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$InventoryPath,
  [Parameter(Mandatory=$true)][string]$RegistryPath,
  [string]$OutputPath = "",
  [int]$MaxFiles = 5000,
  [int]$MaxBytesPerFile = 1048576
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  $OutputPath = Join-Path (Split-Path -Parent $InventoryPath) 'LOCAL-ARTIFACT-COMMERCIAL-REVIEW-LATEST.json'
}
$inventory = Get-Content -LiteralPath $InventoryPath -Raw | ConvertFrom-Json
$registry = Get-Content -LiteralPath $RegistryPath -Raw | ConvertFrom-Json
$allowed = @('.ps1','.psm1','.psd1','.js','.mjs','.cjs','.ts','.tsx','.jsx','.py','.html','.css','.json','.jsonl','.yaml','.yml','.toml','.md','.txt','.csv','.sql','.sh','.bat','.cmd')
$deny = '(?i)(^|[\\/])(\.env($|\.)|secrets?([\\/]|$)|credentials?([\\/]|$)|id_rsa|id_ed25519|[^\\/]*\.(pem|pfx|key)$|service[-_]?account|secret[-_]?key|api[-_]?key|token[-_]?store|wallet\.dat)'
function Get-Tokens([string]$Value) {
  @([regex]::Matches(($Value ?? '').ToLowerInvariant(), '[a-z0-9]{4,}') | ForEach-Object { $_.Value } | Where-Object { $_ -notin @('with','from','that','this','into','your','have','will','only','not','then','when','where','what','buyer','teams','team','report','tool','data','product','existing','candidate','mechanism','potential','hypothesis','validated') } | Select-Object -Unique)
}
$mechanisms = @($registry.mechanisms)
$rows = [System.Collections.Generic.List[object]]::new()
$readCount = 0
$skipCount = 0
$errors = [System.Collections.Generic.List[string]]::new()
foreach ($item in @($inventory.files)) {
  if ($readCount -ge $MaxFiles) { break }
  $p = [string]$item.path
  $ext = [string]$item.extension
  if ([string]::IsNullOrWhiteSpace($p) -or $item.classification -eq 'EXCLUDED_SENSITIVE_PATH' -or $p -match $deny -or $allowed -notcontains $ext) { $skipCount++; continue }
  try {
    $fi = [System.IO.FileInfo]::new($p)
    if (-not $fi.Exists -or $fi.Length -gt $MaxBytesPerFile) { $skipCount++; continue }
    $body = [System.IO.File]::ReadAllText($p)
    if ($body -match '(?i)(-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|sk_live_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+|AKIA[0-9A-Z]{16})') { $skipCount++; continue }
    $readCount++
    $fileTokens = @(Get-Tokens (($fi.Name + ' ') + $body.Substring(0,[Math]::Min($body.Length,200000))))
    if ($fileTokens.Count -eq 0) { continue }
    $matches = @()
    foreach ($m in $mechanisms) {
      $mt = @(Get-Tokens (([string]$m.title + ' ' + [string]$m.description + ' ' + [string]$m.deliverable + ' ' + [string]$m.buyer_segment)))
      if ($mt.Count -eq 0) { continue }
      $common = @($mt | Where-Object { $fileTokens -contains $_ } | Select-Object -Unique)
      if ($common.Count -ge 2) {
        $matches += [ordered]@{ mechanism_id=$m.mechanism_id; title=$m.title; matched_terms=$common; heuristic_score=[Math]::Min(100, [int](100 * $common.Count / [Math]::Max(1,$mt.Count))); status='LOCAL_MATCH_REQUIRES_HUMAN_REVIEW' }
      }
    }
    $best = @($matches | Sort-Object heuristic_score -Descending | Select-Object -First 5)
    if ($best.Count -gt 0) {
      $rows.Add([ordered]@{
        path=$p
        extension=$ext
        size_bytes=$fi.Length
        last_write_utc=$fi.LastWriteTimeUtc.ToString('o')
        content_sha256=(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant()
        top_mechanism_matches=$best
        classification='LOCAL_TEXT_MATCH_NOT_A_SALEABILITY_VERDICT'
      })
    }
  } catch { $errors.Add(($p + ': ' + $_.Exception.Message)) }
}
$parent = Split-Path -Parent $OutputPath
$null = New-Item -ItemType Directory -Force -Path $parent
$report = [ordered]@{
  schema='DREAMLEDGER-LOCAL-ARTIFACT-COMMERCIAL-REVIEW/v1'
  generated_at_utc=[DateTime]::UtcNow.ToString('o')
  status=$(if($errors.Count -gt 0){'REVIEW_WITH_WARNINGS'}else{'LOCAL_HEURISTIC_REVIEW_COMPLETE'})
  mode='LOCAL_ONLY_SAFE_TEXT_HEURISTICS'
  files_read=$readCount
  files_skipped=$skipCount
  files_with_mechanism_matches=$rows.Count
  max_files=$MaxFiles
  max_bytes_per_file=$MaxBytesPerFile
  top_matches=@($rows | Sort-Object { ($_.top_mechanism_matches | Measure-Object heuristic_score -Maximum).Maximum } -Descending | Select-Object -First 500)
  errors=@($errors | Select-Object -First 100)
  guardrails=@(
    'File contents are processed locally and are not uploaded or included in this report.',
    'Potential secret-like files and detected credential-bearing content are skipped.',
    'Keyword overlap is a discovery hint, not semantic review, ownership clearance, buyer demand, quality, or saleability.',
    'No artifact is executed, modified, moved, published, or sold.',
    'All mechanisms remain unvalidated hypotheses until their commercial gates pass.'
  )
}
$report | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
Write-Output ('LOCAL_COMMERCIAL_REVIEW_STATUS=' + $report.status)
Write-Output ('FILES_READ=' + $readCount)
Write-Output ('FILES_WITH_MATCHES=' + $rows.Count)
Write-Output ('COMMERCIAL_REVIEW_PROOF=' + $OutputPath)
