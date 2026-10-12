#Requires -Version 5.1
[CmdletBinding()]
param(
  [string[]]$Roots = @(),
  [string]$OutputPath = "",
  [int]$MaxFiles = 250000
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Read-only discovery only. Never execute, upload, move, delete, or publish scanned files.
if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  $base = if (Test-Path 'D:\') { 'D:\BrownEyeCortex\Runtime\proofs\cube-swarm' } else { Join-Path $HOME 'BrownEyeCortex\Runtime\proofs\cube-swarm' }
  $OutputPath = Join-Path $base 'LOCAL-ARTIFACT-INVENTORY-LATEST.json'
}
if (-not $Roots -or $Roots.Count -eq 0) {
  $Roots = @(
    'D:\BrownEyeCortex',
    'C:\BrownEyeCortex',
    'D:\DreamLedger',
    'C:\DreamLedger',
    'C:\DreamLedger_Actual',
    'D:\DreamLedger_Actual',
    (Join-Path $HOME 'BrownEyeCortex'),
    (Join-Path $HOME 'DreamLedger'),
    (Join-Path $HOME 'Desktop'),
    (Join-Path $HOME 'Documents'),
    (Join-Path $HOME 'Downloads')
  )
}
$extensions = @(
  '.ps1','.psm1','.psd1','.js','.mjs','.cjs','.ts','.tsx','.jsx','.py','.ipynb',
  '.html','.css','.json','.jsonl','.yaml','.yml','.toml','.md','.txt','.pdf',
  '.docx','.pptx','.xlsx','.csv','.zip','.7z','.tar','.gz','.png','.jpg','.jpeg',
  '.webp','.svg','.glb','.gltf','.blend','.obj','.fbx','.stl','.unity','.godot',
  '.wasm','.exe','.msi','.dll','.sql','.sh','.bat','.cmd'
)
$excludedDirNames = @(
  '.git','node_modules','.next','.nuxt','dist-cache','coverage','.cache','Cache',
  'Temp','tmp','AppData','Windows','Program Files','Program Files (x86)',
  '$Recycle.Bin','System Volume Information'
)
$secretPatterns = @(
  '(^|[\\/])\.env($|\.)','(^|[\\/])secrets?([\\/]|$)','(^|[\\/])credentials?([\\/]|$)',
  'id_rsa','id_ed25519','\.pem$','\.pfx$','\.key$','service[-_]?account',
  'secret[-_]?key','api[-_]?key','token[-_]?store','wallet\.dat'
)
$seen = @{}
$files = [System.Collections.Generic.List[object]]::new()
$errors = [System.Collections.Generic.List[string]]::new()
$existingRoots = @($Roots | Where-Object { -not [string]::IsNullOrWhiteSpace($_) -and (Test-Path -LiteralPath $_ -PathType Container) } | Select-Object -Unique)

# Discover additional likely artifact roots one directory below each available drive.
foreach ($drive in @('C:\','D:\')) {
  if (Test-Path -LiteralPath $drive) {
    try {
      Get-ChildItem -LiteralPath $drive -Directory -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '(?i)BrownEye|DreamLedger|Garage|BEC|Artifact|Factory|Cube|Cortex|Spine|Bootstrap' } |
        ForEach-Object { $existingRoots += $_.FullName }
    } catch { $errors.Add("ROOT_DISCOVERY:$drive:$($_.Exception.Message)") }
  }
}
$existingRoots = @($existingRoots | Select-Object -Unique)
$walked = 0
foreach ($root in $existingRoots) {
  $stack = [System.Collections.Generic.Stack[string]]::new()
  $stack.Push($root)
  while ($stack.Count -gt 0) {
    $dir = $stack.Pop()
    try {
      foreach ($entry in [System.IO.Directory]::EnumerateFileSystemEntries($dir)) {
        try {
          $attr = [System.IO.File]::GetAttributes($entry)
          if (($attr -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { continue }
          if (($attr -band [System.IO.FileAttributes]::Directory) -ne 0) {
            $leaf = [System.IO.Path]::GetFileName($entry)
            if ($excludedDirNames -contains $leaf) { continue }
            $stack.Push($entry)
            continue
          }
          $walked++
          if ($walked -gt $MaxFiles) { $errors.Add("MAX_FILES_REACHED:$MaxFiles"); break }
          $ext = [System.IO.Path]::GetExtension($entry).ToLowerInvariant()
          if ($extensions -notcontains $ext) { continue }
          $full = [System.IO.Path]::GetFullPath($entry)
          if ($seen.ContainsKey($full)) { continue }
          $seen[$full] = $true
          $relative = $full.Substring($root.Length).TrimStart('\','/')
          $sensitive = $false
          foreach ($pattern in $secretPatterns) { if ($full -match $pattern) { $sensitive = $true; break } }
          if ($sensitive) {
            $files.Add([ordered]@{ path=$full; root=$root; extension=$ext; classification='EXCLUDED_SENSITIVE_PATH'; sale_candidate=$false; reason='Potential secret/credential path; not hashed or inspected.' })
            continue
          }
          $fi = [System.IO.FileInfo]::new($full)
          $name = $fi.Name
          $artifactSignal = ($full -match '(?i)artifact|build|proof|deliver|product|factory|cube|garage|spine|bootstrap|report|export|compiled|release|package|prototype|demo|revenue|truth|elo[h]?im')
          $size = $fi.Length
          $files.Add([ordered]@{
            path=$full
            root=$root
            relative_path=$relative
            name=$name
            extension=$ext
            size_bytes=$size
            last_write_utc=$fi.LastWriteTimeUtc.ToString('o')
            classification=$(if($artifactSignal){'ARTIFACT_REVIEW_CANDIDATE'}else{'DISCOVERED_FILE'})
            sale_candidate=$false
            reason='Inventory metadata only. Commercial suitability requires content review, ownership/license review, validation, and explicit approval.'
          })
        } catch { $errors.Add("ENTRY:$entry:$($_.Exception.Message)") }
      }
    } catch { $errors.Add("DIRECTORY:$dir:$($_.Exception.Message)") }
    if ($walked -gt $MaxFiles) { break }
  }
  if ($walked -gt $MaxFiles) { break }
}
$parent = Split-Path -Parent $OutputPath
$null = New-Item -ItemType Directory -Force -Path $parent
$artifactCount = @($files | Where-Object classification -eq 'ARTIFACT_REVIEW_CANDIDATE').Count
$proof = [ordered]@{
  schema='DREAMLEDGER-LOCAL-ARTIFACT-INVENTORY/v1'
  generated_at_utc=[DateTime]::UtcNow.ToString('o')
  mode='READ_ONLY_METADATA_INVENTORY'
  status=$(if($errors.Count -gt 0){'INVENTORY_WITH_WARNINGS'}else{'INVENTORY_COMPLETE'})
  roots_scanned=$existingRoots
  roots_missing=@($Roots | Where-Object { -not (Test-Path -LiteralPath $_ -PathType Container) })
  files_walked=$walked
  files_included=$files.Count
  artifact_review_candidates=$artifactCount
  errors=@($errors | Select-Object -First 500)
  guardrails=@(
    'No files are modified, moved, deleted, executed, uploaded, or published.',
    'File contents are not read; secrets and credential-like paths are excluded from hashing and inspection.',
    'Inventory classification is not proof of ownership, quality, demand, or sellability.',
    'sale_candidate remains false until independent review and explicit approval.'
  )
  files=@($files)
}
$proof | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
Write-Output ('LOCAL_ARTIFACT_INVENTORY_STATUS=' + $proof.status)
Write-Output ('LOCAL_ROOTS_SCANNED=' + $existingRoots.Count)
Write-Output ('LOCAL_FILES_WALKED=' + $walked)
Write-Output ('ARTIFACT_REVIEW_CANDIDATES=' + $artifactCount)
Write-Output ('INVENTORY_PROOF=' + $OutputPath)
if ($walked -gt $MaxFiles) { exit 2 }
