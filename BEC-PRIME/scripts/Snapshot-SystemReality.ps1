Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

function Get-ArtifactRoot {
    if (Test-Path 'D:\BrownEye') { return 'D:\BrownEye\BROWNEYE_ARTIFACTS' }
    return 'C:\BrownEyeCortexData\BROWNEYE_ARTIFACTS'
}

function Get-Timestamp { return (Get-Date).ToString('yyyyMMdd_HHmmss') }

$artifactRoot = Get-ArtifactRoot
if (-not (Test-Path $artifactRoot)) { New-Item -ItemType Directory -Path $artifactRoot -Force | Out-Null }

$ts = Get-Timestamp
$outFile = Join-Path $artifactRoot ('artifact_' + $ts + '_SYSTEM_REALITY_SNAPSHOT.md')
$tasks = @(schtasks /Query /FO CSV | ConvertFrom-Csv)
$running = @()
$ready = @()

foreach ($t in $tasks) {
    if ($t.Status -eq 'Running') { $running += $t.TaskName }
    elseif ($t.Status -eq 'Ready') { $ready += $t.TaskName }
}

$lines = @(
    '# SYSTEM REALITY SNAPSHOT',
    '',
    ('Generated: ' + $ts),
    '',
    '## RUNNING TASKS'
)
if ($running.Count -eq 0) { $lines += '- none' } else { $running | Sort-Object | ForEach-Object { $lines += '- ' + $_ } }
$lines += ''
$lines += '## READY / STOPPED TASKS'
if ($ready.Count -eq 0) { $lines += '- none' } else { $ready | Sort-Object | ForEach-Object { $lines += '- ' + $_ } }
$lines += ''
$lines += '## NOTES'
$lines += '- This snapshot is machine-generated.'
$lines += '- No interpretation or advice is included.'
$lines += '- This artifact is immutable once written.'

$lines | Out-File -FilePath $outFile -Encoding ASCII -Force
Write-Host 'OK. Snapshot generated:'
Write-Host $outFile
