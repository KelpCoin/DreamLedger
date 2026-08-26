#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$RepoRoot = 'C:\BrownEyeCortex\DreamLedger',
    [switch]$Live
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProofRoot = 'D:\BrownEyeCortex\InverseShopping\proof'
$DataRoot = 'D:\BrownEyeCortex\InverseShopping\data'
$Port = 3000
$runStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logDir = Join-Path $ProofRoot 'logs'
New-Item -ItemType Directory -Force -Path $logDir,$ProofRoot,$DataRoot | Out-Null
$logFile = Join-Path $logDir ('wanted-hunt-' + $runStamp + '.log')
$stdout = Join-Path $logDir ('server-' + $runStamp + '.out.log')
$stderr = Join-Path $logDir ('server-' + $runStamp + '.err.log')
$server = $null

function Invoke-Checked([string]$File,[string[]]$Args) {
    & $File @Args 2>&1 | Tee-Object -FilePath $logFile -Append
    if ($LASTEXITCODE -ne 0) { throw ($File + ' exited ' + $LASTEXITCODE) }
}
function Get-LatestProof {
    Get-ChildItem -LiteralPath $ProofRoot -Filter 'WANTED-HUNT-PROOF-*.json' -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
}

Start-Transcript -LiteralPath $logFile -Force | Out-Null
try {
    if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot 'package.json'))) { throw 'DreamLedger repository not found.' }
    Push-Location $RepoRoot
    $env:WANTED_DATA_DIR = $DataRoot
    $env:INVERSE_PROOF_DIR = $ProofRoot

    Write-Host '=== DETERMINISTIC GATES ===' -ForegroundColor Cyan
    Invoke-Checked 'npm' @('run','verify:wanted')
    Invoke-Checked 'npm' @('run','verify:hunt')

    if (-not $Live) {
        Write-Host 'LIVE_MODE=NOT_RUN' -ForegroundColor Yellow
        Write-Host 'Run again with -Live and EBAY_OAUTH_TOKEN or EBAY_APP_ID + EBAY_CERT_ID in the process environment.'
        exit 0
    }

    if ([string]::IsNullOrWhiteSpace($env:EBAY_OAUTH_TOKEN) -and ([string]::IsNullOrWhiteSpace($env:EBAY_APP_ID) -or [string]::IsNullOrWhiteSpace($env:EBAY_CERT_ID))) {
        throw 'Live hunt requires EBAY_OAUTH_TOKEN or EBAY_APP_ID plus EBAY_CERT_ID.'
    }

    $before = @(Get-ChildItem -LiteralPath $ProofRoot -Filter 'WANTED-HUNT-PROOF-*.json' -File -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName)
    Write-Host '=== START RUNTIME ===' -ForegroundColor Cyan
    $server = Start-Process -FilePath 'npm' -ArgumentList 'start' -WorkingDirectory $RepoRoot -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru -WindowStyle Hidden

    $ready = $false
    $deadline = (Get-Date).AddSeconds(45)
    while ((Get-Date) -lt $deadline) {
        if ($server.HasExited) { throw ('Server exited. See ' + $stderr) }
        try {
            $h = Invoke-WebRequest -Uri ('http://localhost:' + $Port + '/healthz') -UseBasicParsing -TimeoutSec 2
            if ($h.StatusCode -ge 200 -and $h.StatusCode -lt 300) { $ready = $true; break }
        } catch { Start-Sleep -Seconds 1 }
    }
    if (-not $ready) { throw 'Runtime did not become ready.' }

    $wantedText = 'FUBU jacket XL or 2XL vintage 1990s/2000s black or red under NZ$120'
    Write-Host '=== CREATE WANTED ===' -ForegroundColor Cyan
    $wanted = Invoke-RestMethod -Uri ('http://localhost:' + $Port + '/api/wanted') -Method Post -ContentType 'application/json' -Body (@{text=$wantedText} | ConvertTo-Json) -TimeoutSec 15
    $wantedId = [string]$wanted.item.id
    if ([string]::IsNullOrWhiteSpace($wantedId)) { throw 'WANTED route did not return item.id.' }
    Write-Host ('WANTED_ID=' + $wantedId) -ForegroundColor Green

    Write-Host '=== LIVE HUNT ===' -ForegroundColor Cyan
    $hunt = Invoke-RestMethod -Uri ('http://localhost:' + $Port + '/api/hunt') -Method Post -ContentType 'application/json' -Body (@{wantedId=$wantedId;limit=50} | ConvertTo-Json) -TimeoutSec 60
    if ([string]$hunt.wantedId -ne $wantedId) { throw 'HUNT response wantedId mismatch.' }
    Write-Host ('HUNT_ID=' + [string]$hunt.huntId) -ForegroundColor Green
    Write-Host ('RUN_ID=' + [string]$hunt.runId) -ForegroundColor Green

    $proof = $null
    $deadline = (Get-Date).AddSeconds(15)
    while ((Get-Date) -lt $deadline) {
        $candidate = Get-LatestProof
        if ($null -ne $candidate -and $before -notcontains $candidate.FullName) { $proof = $candidate; break }
        Start-Sleep -Seconds 1
    }
    if ($null -eq $proof) { throw 'No fresh engine-produced proof artifact found.' }

    Write-Host '=== VERIFY PROOF ===' -ForegroundColor Cyan
    $proofJson = Get-Content -LiteralPath $proof.FullName -Raw | ConvertFrom-Json
    if ([string]$proofJson.wanted_id -ne $wantedId) { throw 'Proof wanted_id does not match the WANTED response.' }
    if ([string]$proofJson.hunt_id -ne [string]$hunt.huntId) { throw 'Proof hunt_id does not match HUNT response.' }
    if ([string]$proofJson.run_id -ne [string]$hunt.runId) { throw 'Proof run_id does not match HUNT response.' }
    if ([string]$proofJson.source.platform -ne 'ebay') { throw 'Proof source is not ebay.' }
    if ([string]$proofJson.source.request.params.filter -notmatch 'deliveryCountry:NZ') { throw 'Actual request filter did not contain deliveryCountry:NZ.' }
    if ([string]$proofJson.source.request.params.filter -match 'price:\[\.\.120\].*priceCurrency:NZD') { throw 'Proof falsely claims an NZD price filter on the default AUD marketplace.' }
    if ([string]$proofJson.commercial_signal -ne 'UNPROVEN') { throw 'Commercial signal must remain UNPROVEN.' }

    Write-Host ('PROOF_FILE=' + $proof.FullName) -ForegroundColor Green
    Write-Host ('SOURCE_FEASIBILITY=' + [string]$proofJson.source_feasibility) -ForegroundColor Green
    Write-Host 'COMMERCIAL_SIGNAL=UNPROVEN' -ForegroundColor Yellow
    Write-Host 'VERIFY_60S=Get-Content -LiteralPath "' + $proof.FullName + '" | ConvertFrom-Json | Select-Object wanted_id,hunt_id,run_id,source_feasibility,commercial_signal' -ForegroundColor Yellow
}
catch {
    Write-Host ('EVIDENCE_GATE_FAIL=' + $_.Exception.Message) -ForegroundColor Red
    Write-Host ('LOG=' + $logFile) -ForegroundColor Red
    exit 1
}
finally {
    if ($null -ne $server -and -not $server.HasExited) { Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue }
    Remove-Item Env:EBAY_APP_ID -ErrorAction SilentlyContinue
    Remove-Item Env:EBAY_CERT_ID -ErrorAction SilentlyContinue
    Remove-Item Env:EBAY_OAUTH_TOKEN -ErrorAction SilentlyContinue
    if ($null -ne (Get-Variable -Name RepoRoot -ErrorAction SilentlyContinue)) { Pop-Location -ErrorAction SilentlyContinue }
    try { Stop-Transcript | Out-Null } catch { }
}
