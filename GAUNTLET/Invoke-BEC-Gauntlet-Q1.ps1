#!/usr/bin/env pwsh
# Invoke-BEC-Gauntlet-Q1.ps1
# BEC PRIME - Q1 Messy CSV Cleanup
# Data processing only. Never fabricates revenue, payments, customers, or economic events.

[CmdletBinding()]
param(
    [ValidateSet('Run','Verify')]
    [string]$Action = 'Run',
    [string]$InboxPath = (Join-Path $PSScriptRoot 'Q1-MESSY-CSV\INBOX'),
    [string]$CleanPath = (Join-Path $PSScriptRoot 'Q1-MESSY-CSV\CLEAN'),
    [string]$ReportsPath = (Join-Path $PSScriptRoot 'Q1-MESSY-CSV\REPORTS'),
    [string]$ProofPath = (Join-Path $PSScriptRoot 'Q1-MESSY-CSV\PROOF'),
    [string]$LogsPath = (Join-Path $PSScriptRoot 'Q1-MESSY-CSV\LOGS'),
    [switch]$AllowEmptyInbox
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Ensure-Directory {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Force -Path $Path | Out-Null
    }
}

foreach ($path in @($InboxPath, $CleanPath, $ReportsPath, $ProofPath, $LogsPath)) {
    Ensure-Directory -Path $path
}

$logFile = Join-Path $LogsPath 'gauntlet-q1.log'

function Write-Log {
    param([string]$Message, [string]$Level = 'INFO')
    $line = '[{0}] [{1}] {2}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss.fff'), $Level, $Message
    Add-Content -LiteralPath $logFile -Value $line -Encoding UTF8
    Write-Host $line
}

function Get-Sha256 {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Normalize-ColumnNames {
    param([object[]]$Headers)
    $output = @()
    $used = @{}
    foreach ($header in $Headers) {
        $name = [string]$header
        $name = $name -replace '[^a-zA-Z0-9_]', '_'
        $name = $name -replace '_+', '_'
        $name = $name.Trim('_')
        if ([string]::IsNullOrWhiteSpace($name)) {
            $name = 'Column_' + ($output.Count + 1)
        }
        $base = $name
        $number = 1
        while ($used.ContainsKey($name)) {
            $number++
            $name = '{0}_{1}' -f $base, $number
        }
        $used[$name] = $true
        $output += $name
    }
    return $output
}

function Detect-Delimiter {
    param([string]$Path)
    $lines = @(Get-Content -LiteralPath $Path -TotalCount 10)
    $sample = $lines -join "`n"
    if ([string]::IsNullOrWhiteSpace($sample)) { return ',' }
    $counts = @{
        ','  = ([regex]::Matches($sample, ',')).Count
        ';'  = ([regex]::Matches($sample, ';')).Count
        "`t" = ([regex]::Matches($sample, "`t")).Count
        '|'  = ([regex]::Matches($sample, '\|')).Count
    }
    return ($counts.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 1).Name
}

function Write-Proof {
    param([object]$Payload)
    $runId = 'Q1-' + (Get-Date -Format 'yyyyMMdd-HHmmssfff')
    $proofFile = Join-Path $ProofPath ('Q1-PROOF-{0}.json' -f $runId.Substring(3))
    $proof = [ordered]@{
        schema_version = 'BEC-GAUNTLET-Q1/v3'
        run_id = $runId
        timestamp = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
        action = $Action
        truth_scope = 'data_processing_only'
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
    $json = $proof | ConvertTo-Json -Depth 30
    Set-Content -LiteralPath $proofFile -Value $json -Encoding UTF8
    $hash = Get-Sha256 -Path $proofFile
    Set-Content -LiteralPath ($proofFile + '.sha256') -Value $hash -NoNewline -Encoding ASCII
    Write-Log "Proof artifact: $proofFile"
    Write-Log "Proof SHA256: $hash"
    return [pscustomobject]@{ Path = $proofFile; Hash = $hash; RunId = $runId }
}

function Process-Csv {
    param(
        [string]$InputPath,
        [string]$OutputPath,
        [string]$ReportPath
    )

    Write-Log "Processing: $InputPath"
    $delimiter = Detect-Delimiter -Path $InputPath
    Write-Log ("Detected delimiter: '{0}'" -f ([string]$delimiter -replace "`t", 'TAB'))

    try {
        $data = @(Import-Csv -LiteralPath $InputPath -Delimiter $delimiter -ErrorAction Stop)
    }
    catch {
        Write-Log ('CSV parse failed: {0}' -f $_.Exception.Message) 'ERROR'
        return $null
    }

    if ($data.Count -eq 0) {
        Set-Content -LiteralPath $ReportPath -Value "# Q1 Anomaly Report`n`nNo data rows detected." -Encoding UTF8
        return [pscustomobject]@{
            SourceFile = $InputPath
            OutputFile = $null
            ReportFile = $ReportPath
            RowCount = 0
            DuplicatesRemoved = 0
            AnomalyCount = 1
            Headers = $null
            SourceHash = Get-Sha256 -Path $InputPath
            OutputHash = $null
            ReportHash = Get-Sha256 -Path $ReportPath
        }
    }

    $originalHeaders = @($data[0].PSObject.Properties.Name)
    $normalizedHeaders = @(Normalize-ColumnNames -Headers $originalHeaders)
    $headerMap = @{}
    for ($i = 0; $i -lt $originalHeaders.Count; $i++) {
        $headerMap[$originalHeaders[$i]] = $normalizedHeaders[$i]
    }

    $cleanRows = @()
    $anomalies = @()
    $rowIndex = 0
    foreach ($row in $data) {
        $rowIndex++
        $cleanRow = [ordered]@{}
        foreach ($originalHeader in $originalHeaders) {
            $value = $row.$originalHeader
            if ($null -eq $value) { $value = '' }
            $value = ([string]$value).Trim()
            if ([string]::IsNullOrWhiteSpace($value)) {
                $anomalies += ('Row {0}: ''{1}'' is empty or whitespace' -f $rowIndex, $originalHeader)
            }
            $cleanRow[$headerMap[$originalHeader]] = $value
        }
        $cleanRows += [pscustomobject]$cleanRow
    }

    $firstColumn = $normalizedHeaders[0]
    $seen = @{}
    $dedupedRows = @()
    $duplicates = 0
    foreach ($row in $cleanRows) {
        $key = [string]$row.$firstColumn
        if ($seen.ContainsKey($key)) {
            $duplicates++
            $anomalies += ('Duplicate ''{0}'': {1}' -f $firstColumn, $key)
        }
        else {
            $seen[$key] = $true
            $dedupedRows += $row
        }
    }

    if ($dedupedRows.Count -gt 0) {
        $dedupedRows | Export-Csv -LiteralPath $OutputPath -NoTypeInformation -Encoding UTF8
    }

    $report = @(
        '# Q1 Anomaly Report'
        ''
        ('Generated: {0}' -f (Get-Date).ToUniversalTime().ToString('o'))
        ('Source: {0}' -f $InputPath)
        ('Total anomalies: {0}' -f $anomalies.Count)
        ('Duplicates removed: {0}' -f $duplicates)
        ''
        '## Anomalies'
    )
    if ($anomalies.Count -gt 0) { $report += $anomalies } else { $report += 'No anomalies detected.' }
    $report | Set-Content -LiteralPath $ReportPath -Encoding UTF8

    Write-Log ('Clean rows: {0}; duplicates: {1}; anomalies: {2}' -f $dedupedRows.Count, $duplicates, $anomalies.Count)

    return [pscustomobject]@{
        SourceFile = $InputPath
        OutputFile = $OutputPath
        ReportFile = $ReportPath
        RowCount = [int]$dedupedRows.Count
        DuplicatesRemoved = [int]$duplicates
        AnomalyCount = [int]$anomalies.Count
        Headers = $normalizedHeaders
        SourceHash = Get-Sha256 -Path $InputPath
        OutputHash = Get-Sha256 -Path $OutputPath
        ReportHash = Get-Sha256 -Path $ReportPath
    }
}

Write-Log ('Q1 Gauntlet started; action={0}' -f $Action)

if ($Action -eq 'Verify') {
    $sidecars = @(Get-ChildItem -LiteralPath $ProofPath -Filter '*.sha256' -File -ErrorAction SilentlyContinue)
    if ($sidecars.Count -eq 0) { throw 'No Q1 proof sidecars found.' }
    $valid = $true
    foreach ($sidecar in $sidecars) {
        $jsonFile = $sidecar.FullName.Substring(0, $sidecar.FullName.Length - 7)
        if (-not (Test-Path -LiteralPath $jsonFile -PathType Leaf)) {
            Write-Log "Missing proof JSON for $($sidecar.Name)" 'ERROR'
            $valid = $false
            continue
        }
        $storedHash = (Get-Content -LiteralPath $sidecar.FullName -Raw).Trim().ToLowerInvariant()
        $computedHash = Get-Sha256 -Path $jsonFile
        if ($storedHash -ne $computedHash) {
            Write-Log "HASH MISMATCH: $($sidecar.Name)" 'ERROR'
            $valid = $false
        }
        else {
            Write-Log "VALID: $($sidecar.Name)"
        }
    }
    if (-not $valid) { throw 'Q1 proof verification failed.' }
    Write-Log 'Q1 proof verification PASSED'
    exit 0
}

$files = @(Get-ChildItem -LiteralPath $InboxPath -File -ErrorAction Stop | Where-Object {
    $_.Extension -in '.csv', '.CSV', '.xlsx', '.XLSX', '.xls', '.XLS'
})

if ($files.Count -eq 0) {
    $message = "No CSV/XLS/XLSX input files found in $InboxPath"
    $payload = [ordered]@{ run_type = 'Run'; status = 'NO_INPUT'; files_discovered = 0; files_processed = 0; files_failed = 0; total_rows_cleaned = 0; total_duplicates_removed = 0; total_anomalies = 0; results = @() }
    $null = Write-Proof -Payload $payload
    if ($AllowEmptyInbox) {
        Write-Log $message 'WARN'
        exit 0
    }
    Write-Log $message 'ERROR'
    exit 2
}

$results = @()
$failed = 0

foreach ($file in $files) {
    if ($file.Extension -match '^\.xls[x]?$') {
        Write-Log "Excel input detected: $($file.Name)"
        Write-Log 'Excel input cannot be converted safely in this CI runner; leave it for the Windows execution path.' 'ERROR'
        $failed++
        continue
    }

    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
    $cleanFile = Join-Path $CleanPath ($baseName + '-clean.csv')
    $reportFile = Join-Path $ReportsPath ($baseName + '-anomalies.md')

    try {
        $result = Process-Csv -InputPath $file.FullName -OutputPath $cleanFile -ReportPath $reportFile
        if ($null -ne $result) { $results += $result } else { $failed++ }
    }
    catch {
        Write-Log ('Processing failure for {0}: {1}' -f $file.Name, $_.Exception.Message) 'ERROR'
        $failed++
    }
}

$totalRows = 0
$totalDuplicates = 0
$totalAnomalies = 0
foreach ($result in $results) {
    $totalRows += [int]$result.RowCount
    $totalDuplicates += [int]$result.DuplicatesRemoved
    $totalAnomalies += [int]$result.AnomalyCount
}

$status = if ($failed -eq 0) { 'PASS' } else { 'FAIL' }
$payload = [ordered]@{
    run_type = 'Run'
    status = $status
    files_discovered = [int]$files.Count
    files_processed = [int]$results.Count
    files_failed = [int]$failed
    total_rows_cleaned = [int]$totalRows
    total_duplicates_removed = [int]$totalDuplicates
    total_anomalies = [int]$totalAnomalies
    results = @($results)
}

$proof = Write-Proof -Payload $payload
Write-Host "Q1 STATUS: $status"
Write-Host "FILES PROCESSED: $($results.Count)"
Write-Host "FILES FAILED: $failed"
Write-Host "ROWS CLEANED: $totalRows"
Write-Host "DUPLICATES REMOVED: $totalDuplicates"
Write-Host "ANOMALIES: $totalAnomalies"
Write-Host "PROOF: $($proof.Path)"
Write-Host "PROOF SHA256: $($proof.Hash)"

if ($failed -ne 0) { exit 1 }
Write-Log 'Q1 Gauntlet completed successfully'
exit 0
