#!/usr/bin/env pwsh
# Invoke-BEC-Gauntlet-Q1.ps1
# BEC PRIME - Q1 Messy CSV Cleanup
# Purpose: normalize existing operational CSV data and produce proof artifacts.
# Truth rule: this script never fabricates rows, revenue, payments, or economic events.
# PowerShell 5.1+ / PowerShell 7 compatible for CSV processing.

[CmdletBinding()]
param(
    [ValidateSet("Run", "Verify")]
    [string]$Action = "Run",
    [string]$InboxPath = (Join-Path $PSScriptRoot "Q1-MESSY-CSV\INBOX"),
    [string]$CleanPath = (Join-Path $PSScriptRoot "Q1-MESSY-CSV\CLEAN"),
    [string]$ReportsPath = (Join-Path $PSScriptRoot "Q1-MESSY-CSV\REPORTS"),
    [string]$ProofPath = (Join-Path $PSScriptRoot "Q1-MESSY-CSV\PROOF"),
    [string]$LogsPath = (Join-Path $PSScriptRoot "Q1-MESSY-CSV\LOGS"),
    [switch]$AllowEmptyInbox
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Ensure-Directory([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Force -Path $Path | Out-Null
    }
}
foreach ($p in @($InboxPath,$CleanPath,$ReportsPath,$ProofPath,$LogsPath)) { Ensure-Directory $p }

$logFile = Join-Path $LogsPath "gauntlet-q1.log"
function Write-Log([string]$Message, [string]$Level = "INFO") {
    $line = "[{0}] [{1}] {2}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"), $Level, $Message
    Add-Content -LiteralPath $logFile -Value $line -Encoding UTF8
    Write-Host $line
}
function Get-Sha256([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
    (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}
function Normalize-ColumnNames([object[]]$Headers) {
    $out = @(); $used = @{}
    foreach ($h in $Headers) {
        $name = [string]$h
        $name = $name -replace '[^a-zA-Z0-9_]', '_'
        $name = $name -replace '_+', '_'
        $name = $name.Trim('_')
        if ([string]::IsNullOrWhiteSpace($name)) { $name = "Column_$($out.Count + 1)" }
        $base = $name; $n = 1
        while ($used.ContainsKey($name)) { $n++; $name = "{0}_{1}" -f $base,$n }
        $used[$name] = $true; $out += $name
    }
    return $out
}
function Detect-Delimiter([string]$Path) {
    $lines = @(Get-Content -LiteralPath $Path -TotalCount 10)
    $sample = ($lines -join "`n")
    if ([string]::IsNullOrWhiteSpace($sample)) { return ',' }
    $counts = @{
        ',' = ([regex]::Matches($sample, ',')).Count
        ';' = ([regex]::Matches($sample, ';')).Count
        "`t" = ([regex]::Matches($sample, "`t")).Count
        '|' = ([regex]::Matches($sample, '\|')).Count
    }
    ($counts.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 1).Name
}
function Write-Proof([hashtable]$Payload) {
    $runId = "Q1-" + (Get-Date -Format "yyyyMMdd-HHmmssfff")
    $proofPath = Join-Path $ProofPath ("Q1-PROOF-{0}.json" -f $runId.Substring(3))
    $proof = [ordered]@{
        schema_version = "BEC-GAUNTLET-Q1/v2"
        run_id = $runId
        timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        action = $Action
        truth_scope = "data_processing_only"
        economic_claim = $false
        sale_settled = $false
        economic_proof = $false
        inbox_path = $InboxPath
        clean_path = $CleanPath
        reports_path = $ReportsPath
        proof_path = $ProofPath
        logs_path = $LogsPath
        payload = $Payload
    }
    $proof | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $proofPath -Encoding UTF8
    $hash = Get-Sha256 $proofPath
    Set-Content -LiteralPath ($proofPath + '.sha256') -Value $hash -NoNewline -Encoding ASCII
    Write-Log "Proof artifact: $proofPath"
    Write-Log "Proof SHA256: $hash"
    [pscustomobject]@{ Path=$proofPath; Hash=$hash; RunId=$runId }
}
function Process-Csv([string]$InputPath, [string]$OutputPath, [string]$ReportPath) {
    Write-Log "Processing $InputPath"
    $delimiter = Detect-Delimiter $InputPath
    Write-Log ("Detected delimiter: {0}" -f ([string]$delimiter -replace "`t", "TAB"))
    try { $data = @(Import-Csv -LiteralPath $InputPath -Delimiter $delimiter -ErrorAction Stop) }
    catch { Write-Log ("CSV parse failed: {0}" -f $_.Exception.Message) 'ERROR'; return $null }
    if ($data.Count -eq 0) {
        Write-Log "CSV contains no data rows" 'WARN'
        Set-Content -LiteralPath $ReportPath -Value "# Q1 Anomaly Report`n`nNo data rows detected." -Encoding UTF8
        return [ordered]@{ SourceFile=$InputPath; OutputFile=$null; ReportFile=$ReportPath; RowCount=0; DuplicatesRemoved=0; AnomalyCount=1; Headers=@(); SourceHash=(Get-Sha256 $InputPath); OutputHash=$null; ReportHash=(Get-Sha256 $ReportPath) }
    }
    $originalHeaders = @($data[0].PSObject.Properties.Name)
    $normalizedHeaders = @(Normalize-ColumnNames $originalHeaders)
    $map = @{}
    for ($i=0; $i -lt $originalHeaders.Count; $i++) { $map[$originalHeaders[$i]] = $normalizedHeaders[$i] }
    $rows = New-Object System.Collections.Generic.List[object]
    $anomalies = New-Object System.Collections.Generic.List[string]
    $rowIndex = 0
    foreach ($row in $data) {
        $rowIndex++; $clean = [ordered]@{}
        foreach ($orig in $originalHeaders) {
            $value = $row.$orig
            if ($null -eq $value) { $value = '' }
            $value = ([string]$value).Trim()
            if ([string]::IsNullOrWhiteSpace($value)) { $anomalies.Add(("Row {0}: '{1}' is empty or whitespace" -f $rowIndex,$orig)) }
            $clean[$map[$orig]] = $value
        }
        $rows.Add([pscustomobject]$clean)
    }
    $firstCol = $normalizedHeaders[0]; $seen = @{}; $deduped = New-Object System.Collections.Generic.List[object]; $duplicates = 0
    foreach ($row in $rows) {
        $key = [string]$row.$firstCol
        if ($seen.ContainsKey($key)) { $duplicates++; $anomalies.Add(("Duplicate '{0}': {1}" -f $firstCol,$key)) }
        else { $seen[$key] = $true; $deduped.Add($row) }
    }
    if ($deduped.Count -gt 0) { $deduped | Export-Csv -LiteralPath $OutputPath -NoTypeInformation -Encoding UTF8 }
    $report = @('# Q1 Anomaly Report','',('Generated: {0}' -f (Get-Date).ToUniversalTime().ToString('o')),('Source: {0}' -f $InputPath),('Total anomalies: {0}' -f $anomalies.Count),('Duplicates removed: {0}' -f $duplicates),'','## Anomalies')
    if ($anomalies.Count -gt 0) { $report += @($anomalies) } else { $report += 'No anomalies detected.' }
    $report | Set-Content -LiteralPath $ReportPath -Encoding UTF8
    Write-Log ("Clean rows: {0}; duplicates: {1}; anomalies: {2}" -f $deduped.Count,$duplicates,$anomalies.Count)
    [ordered]@{ SourceFile=$InputPath; OutputFile=$OutputPath; ReportFile=$ReportPath; RowCount=$deduped.Count; DuplicatesRemoved=$duplicates; AnomalyCount=$anomalies.Count; Headers=$normalizedHeaders; SourceHash=(Get-Sha256 $InputPath); OutputHash=(Get-Sha256 $OutputPath); ReportHash=(Get-Sha256 $ReportPath) }
}

Write-Log ("Q1 Gauntlet started; action={0}" -f $Action)
if ($Action -eq 'Verify') {
    $sidecars = @(Get-ChildItem -LiteralPath $ProofPath -Filter '*.sha256' -File -ErrorAction SilentlyContinue)
    if ($sidecars.Count -eq 0) { throw 'No Q1 proof sidecars found.' }
    $valid = $true
    foreach ($sidecar in $sidecars) {
        $json = $sidecar.FullName.Substring(0,$sidecar.FullName.Length - 7)
        if (-not (Test-Path -LiteralPath $json -PathType Leaf)) { Write-Log "Missing proof JSON for $($sidecar.Name)" 'ERROR'; $valid=$false; continue }
        $stored = (Get-Content -LiteralPath $sidecar.FullName -Raw).Trim().ToLowerInvariant(); $actual = Get-Sha256 $json
        if ($stored -ne $actual) { Write-Log "HASH MISMATCH: $($sidecar.Name)" 'ERROR'; $valid=$false } else { Write-Log "VALID: $($sidecar.Name)" }
    }
    if (-not $valid) { throw 'Q1 proof verification failed.' }
    Write-Log 'Q1 proof verification PASSED'; exit 0
}
$files = @(Get-ChildItem -LiteralPath $InboxPath -File -ErrorAction Stop | Where-Object { $_.Extension -in '.csv','.CSV','.xlsx','.XLSX','.xls','.XLS' })
if ($files.Count -eq 0) {
    $message = "No CSV/XLS/XLSX input files found in $InboxPath"
    if ($AllowEmptyInbox) { Write-Log $message 'WARN'; $proof = Write-Proof @{ run_type='Run'; status='NO_INPUT'; files_processed=0; files_failed=0; results=@() }; exit 0 }
    Write-Log $message 'ERROR'; $proof = Write-Proof @{ run_type='Run'; status='NO_INPUT'; files_processed=0; files_failed=0; results=@() }; exit 2
}
$results = New-Object System.Collections.Generic.List[object]; $failed = 0
foreach ($file in $files) {
    if ($file.Extension -match '^\.xls[x]?$') { Write-Log "Excel input detected: $($file.Name)"; Write-Log "Excel input cannot be converted safely in this CI runner; leave it for the Windows execution path." 'ERROR'; $failed++; continue }
    $base = [System.IO.Path]::GetFileNameWithoutExtension($file.Name); $clean = Join-Path $CleanPath ($base + '-clean.csv'); $report = Join-Path $ReportsPath ($base + '-anomalies.md')
    try { $r = Process-Csv $file.FullName $clean $report; if ($null -ne $r) { $results.Add($r) } else { $failed++ } }
    catch { Write-Log ("Processing failure for {0}: {1}" -f $file.Name,$_.Exception.Message) 'ERROR'; $failed++ }
}
$rows = ($results | Measure-Object -Property RowCount -Sum).Sum; $dupes = ($results | Measure-Object -Property DuplicatesRemoved -Sum).Sum; $anoms = ($results | Measure-Object -Property AnomalyCount -Sum).Sum; $status = if ($failed -eq 0) { 'PASS' } else { 'FAIL' }
$proof = Write-Proof @{ run_type='Run'; status=$status; files_discovered=$files.Count; files_processed=$results.Count; files_failed=$failed; total_rows_cleaned=$rows; total_duplicates_removed=$dupes; total_anomalies=$anoms; results=@($results) }
Write-Host "Q1 STATUS: $status"; Write-Host "FILES PROCESSED: $($results.Count)"; Write-Host "FILES FAILED: $failed"; Write-Host "ROWS CLEANED: $rows"; Write-Host "DUPLICATES REMOVED: $dupes"; Write-Host "ANOMALIES: $anoms"; Write-Host "PROOF: $($proof.Path)"; Write-Host "PROOF SHA256: $($proof.Hash)"
if ($failed -ne 0) { exit 1 }; Write-Log 'Q1 Gauntlet completed successfully'; exit 0
