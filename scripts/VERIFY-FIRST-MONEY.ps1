# Read-only production/local verifier for the DreamLedger first-money sprint.
# It never purchases, deploys, changes DNS, writes to Supabase, or publishes content.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$preferred = 'D:\BrownEyeCortex\reports'
if (Test-Path 'D:\') {
    $reportDir = $preferred
} else {
    $reportDir = Join-Path $env:USERPROFILE 'Documents\BrownEyeCortex\reports'
}
New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
$reportPath = Join-Path $reportDir "first-money-verification-$stamp.txt"
$lines = [System.Collections.Generic.List[string]]::new()
$lines.Add('DREAMLEDGER FIRST-MONEY VERIFICATION')
$lines.Add("ObservedAtLocal=$((Get-Date).ToString('o'))")
$lines.Add('Purpose=Read-only smoke checks; not a payment or revenue test')
$lines.Add('Checkout GET deliberately omitted because it creates an unpaid Stripe Checkout Session. Do not use this verifier to create sessions.')
$lines.Add('VERIFIED_EXTERNAL_REVENUE_NZD=0.00 until independent settlement and fulfillment reconcile')
$lines.Add('')

$urls = @(
    'https://dreamledger.org/go/',
    'https://dreamledger.org/api/toll/v1/manifest',
    'https://dreamledger-silo-gateway.onrender.com/api/toll/v1/manifest',
    'https://dreamledger.org/toll-road?ref=qr&c=universal-20261011',
    'https://dreamledger.org/api/toll/v1/checkout/bridge-events',
    'https://dreamledger.org/.well-known/agent-commerce.json'
)
foreach ($url in $urls) {
    try {
        $response = Invoke-WebRequest -Uri $url -Method Get -TimeoutSec 20 -MaximumRedirection 5 -UseBasicParsing
        $lines.Add("HTTP=$([int]$response.StatusCode) URL=$url")
        if ($response.Headers.Location) { $lines.Add("Location=$($response.Headers.Location)") }
    } catch {
        $status = 'NO_HTTP_STATUS'
        try {
            if ($_.Exception.Response -and $_.Exception.Response.StatusCode) { $status = [int]$_.Exception.Response.StatusCode }
        } catch { }
        $lines.Add("HTTP=$status URL=$url ERROR=$($_.Exception.Message)")
    }
}

$lines.Add('')
$lines.Add('LOCAL_LM_STUDIO')
try {
    $models = Invoke-RestMethod -Uri 'http://127.0.0.1:1234/v1/models' -Method Get -TimeoutSec 3
    $ids = @($models.data | ForEach-Object { $_.id }) -join ', '
    $lines.Add("LM_STUDIO=REACHABLE MODELS=$ids")
} catch {
    $lines.Add("LM_STUDIO=UNAVAILABLE ERROR=$($_.Exception.Message)")
}

$repoCandidates = @(
    'C:\BrownEyeCortex\DreamLedger',
    'C:\BrownEyeCortex',
    'D:\DreamLedger',
    'D:\KelpCoin\DreamLedger'
)
$repo = $repoCandidates | Where-Object { Test-Path (Join-Path $_ 'scripts\777_compounding_gate.py') } | Select-Object -First 1
$lines.Add('')
if ($repo) {
    $lines.Add("REPO_ROOT=$repo")
    try {
        $status = & git -C $repo status --short 2>&1
        $lines.Add('GIT_STATUS_BEGIN')
        $lines.AddRange([string[]]@($status))
        $lines.Add('GIT_STATUS_END')
    } catch { $lines.Add("GIT_STATUS=UNAVAILABLE ERROR=$($_.Exception.Message)") }
    $gate = Get-Content -Raw -LiteralPath (Join-Path $repo 'scripts\777_compounding_gate.py')
    if ($gate -match '(?m)^import os\s*$') { $lines.Add('777_GATE_IMPORT_OS=PRESENT') }
    else { $lines.Add('777_GATE_IMPORT_OS=MISSING') }
    $test = Join-Path $repo 'tests\test_777_compounding_gate_import.py'
    if (Test-Path $test) {
        try {
            & python -m unittest discover -s (Join-Path $repo 'tests') -p 'test_777_compounding_gate_import.py' 2>&1 | ForEach-Object { $lines.Add([string]$_) }
            $lines.Add("777_GATE_REGRESSION_EXIT=$LASTEXITCODE")
        } catch { $lines.Add("777_GATE_REGRESSION=UNAVAILABLE ERROR=$($_.Exception.Message)") }
    } else { $lines.Add('777_GATE_REGRESSION=TEST_FILE_NOT_FOUND') }
    $becPrime = Join-Path $repo 'BEC-PRIME'
    if (Test-Path (Join-Path $becPrime 'package.json')) {
        Push-Location $becPrime
        try {
            & npm test 2>&1 | ForEach-Object { $lines.Add([string]$_) }
            $lines.Add("BEC_PRIME_NPM_TEST_EXIT=$LASTEXITCODE")
        } catch {
            $lines.Add("BEC_PRIME_NPM_TEST=UNAVAILABLE ERROR=$($_.Exception.Message)")
        } finally {
            Pop-Location
        }
    } else {
        $lines.Add('BEC_PRIME_NPM_TEST=PACKAGE_NOT_FOUND')
    }
} else {
    $lines.Add('REPO_ROOT=NOT_FOUND_IN_KNOWN_PATHS')
    $lines.Add('NOTE=Run this script on the local PC; this chat session cannot execute commands on that machine.')
}

$lines | Set-Content -LiteralPath $reportPath -Encoding UTF8
Write-Output "REPORT=$reportPath"
Write-Output 'No purchase, deployment, DNS change, database write, or public post was attempted.'
Write-Output 'Review every HTTP status; 200 on a manifest alone does not prove checkout or fulfillment.'
