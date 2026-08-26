#requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

param(
    [string]$RepoRoot = '',
    [switch]$Live
)

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    if (Test-Path (Join-Path (Get-Location) 'package.json')) {
        $RepoRoot = (Get-Location).Path
    } elseif (Test-Path 'C:\BrownEyeCortex\DreamLedger\package.json') {
        $RepoRoot = 'C:\BrownEyeCortex\DreamLedger'
    } else {
        throw 'DreamLedger repo not found. Pass -RepoRoot C:\path\to\DreamLedger.'
    }
}

$ProofRoot = 'D:\BrownEyeCortex\InverseShopping\proof'
New-Item -ItemType Directory -Path $ProofRoot -Force | Out-Null
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$Proof = Join-Path $ProofRoot ("WANTED-HUNT-PROOF-{0}.txt" -f $Stamp)

Push-Location $RepoRoot
try {
    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add('WANTED HUNT ENGINE PROOF')
    $lines.Add(('UTC: {0}' -f [DateTime]::UtcNow.ToString('o')))
    $lines.Add(('REPO: {0}' -f (Get-Location).Path))
    $lines.Add(('GIT_HEAD: {0}' -f ((git rev-parse HEAD) 2>$null)))
    $lines.Add('')

    $verifyWanted = & npm run verify:wanted 2>&1
    $wantedExit = $LASTEXITCODE
    $lines.Add('=== verify:wanted ===')
    $lines.AddRange([string[]]$verifyWanted)
    $lines.Add(('EXIT={0}' -f $wantedExit))
    $lines.Add('')

    $verifyHunt = & npm run verify:hunt 2>&1
    $huntExit = $LASTEXITCODE
    $lines.Add('=== verify:hunt ===')
    $lines.AddRange([string[]]$verifyHunt)
    $lines.Add(('EXIT={0}' -f $huntExit))
    $lines.Add('')

    if ($Live) {
        if ([string]::IsNullOrWhiteSpace($env:EBAY_OAUTH_TOKEN) -and ([string]::IsNullOrWhiteSpace($env:EBAY_APP_ID) -or [string]::IsNullOrWhiteSpace($env:EBAY_CERT_ID))) {
            throw 'Live hunt requires EBAY_OAUTH_TOKEN or EBAY_APP_ID plus EBAY_CERT_ID in the process environment.'
        }
        $env:WANTED_DATA_DIR = 'D:\BrownEyeCortex\InverseShopping\data'
        $payload = @{
            wanted = @{
                id = 'W-PROOF-FUBU'
                raw_text = 'FUBU jacket XL or 2XL vintage 1990s/2000s black or red under NZ$120'
                brand = 'FUBU'
                category = 'jacket'
                size = 'XL, 2XL'
                colour = 'black, red'
                era = '1990s, 2000s'
                style = 'vintage'
                max_price = 120
                currency = 'NZD'
            }
            limit = 50
        } | ConvertTo-Json -Depth 8 -Compress

        $node = @'
const fs = require('fs');
const { hunt } = require('./BEC-PRIME/hunt/HuntEngine');
const input = JSON.parse(process.env.WANTED_PROOF_PAYLOAD);
hunt(input.wanted, { wantedId: input.wanted.id, ebay: { limit: input.limit } })
  .then(result => {
    console.log(JSON.stringify({status: result.status, adapters: result.adapters, candidate_count: result.candidates.length, best: result.candidates[0] || null}, null, 2));
  })
  .catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
'@
        $env:WANTED_PROOF_PAYLOAD = $payload
        $liveOutput = & node -e $node 2>&1
        $liveExit = $LASTEXITCODE
        $lines.Add('=== LIVE eBay HUNT ===')
        $lines.AddRange([string[]]$liveOutput)
        $lines.Add(('EXIT={0}' -f $liveExit))
        $lines.Add('')
        $lines.Add('LIVE_MODE=' + $(if ($liveExit -eq 0) { 'PASS' } else { 'FAIL' }))
    } else {
        $lines.Add('LIVE_MODE=NOT_RUN')
        $lines.Add('Set EBAY_APP_ID/EBAY_CERT_ID or EBAY_OAUTH_TOKEN, then rerun with -Live for the real marketplace proof.')
    }

    $overall = ($wantedExit -eq 0 -and $huntExit -eq 0)
    if ($Live) { $overall = $overall -and ($liveExit -eq 0) }
    $lines.Add('')
    $lines.Add('OVERALL=' + $(if ($overall) { 'PASS' } else { 'FAIL' }))
    $lines | Set-Content -LiteralPath $Proof -Encoding ASCII

    if (-not $overall) { throw "WANTED proof failed. See $Proof" }
    Write-Host "PROOF=PASS" -ForegroundColor Green
    Write-Host "PROOF_FILE=$Proof" -ForegroundColor Cyan
    Write-Host 'VERIFY_60S=Get-Content -LiteralPath ' + $Proof -ForegroundColor Yellow
}
finally {
    Pop-Location
}
