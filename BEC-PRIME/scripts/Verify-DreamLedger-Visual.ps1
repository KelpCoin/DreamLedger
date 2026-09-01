param(
    [string]$LiveUrl = 'https://dreamledger.org',
    [string]$ContractPath = '',
    [string]$OutputDir = ''
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::ASCII

$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if ([string]::IsNullOrWhiteSpace($ContractPath)) { $ContractPath = Join-Path $Root 'visual-contract.json' }
if ([string]::IsNullOrWhiteSpace($OutputDir)) { $OutputDir = Join-Path $Root 'BEC-PRIME\artifacts\visual-verification\latest' }
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

function Write-Ascii([string]$Path, [string]$Text) {
    $tmp = $Path + '.tmp.' + [Guid]::NewGuid().ToString('N')
    [System.IO.File]::WriteAllText($tmp, $Text, [System.Text.Encoding]::ASCII)
    Move-Item -LiteralPath $tmp -Destination $Path -Force
}

function Get-RepoCommit {
    try {
        $v = (& git -C $Root rev-parse HEAD 2>$null)
        if ($LASTEXITCODE -eq 0) { return [string]$v }
    } catch {}
    return 'unknown'
}

if (-not (Test-Path -LiteralPath $ContractPath)) { throw 'VISUAL_GATE_MISSING_CONTRACT' }
$contract = Get-Content -LiteralPath $ContractPath -Raw -Encoding UTF8 | ConvertFrom-Json

$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$checks = [ordered]@{}
$errors = @()
$httpStatus = 0
$liveHtml = ''
$version = $null

try {
    $r = Invoke-WebRequest -Uri $LiveUrl -UseBasicParsing -TimeoutSec 30
    $httpStatus = [int]$r.StatusCode
    $liveHtml = [string]$r.Content
    $checks.http_200 = ($httpStatus -eq 200)
    $checks.no_legacy_surface = ($liveHtml -notmatch 'Dream Ledger Deck')
    foreach ($needle in @($contract.required_text)) {
        $checks[('text_' + ($needle -replace '[^A-Za-z0-9]+','_'))] = ($liveHtml.IndexOf([string]$needle,[System.StringComparison]::OrdinalIgnoreCase) -ge 0)
    }
    foreach ($marker in @($contract.required_markers)) {
        $parts = $marker.Split('=',2)
        $checks[('marker_' + ($parts[0] -replace '[^A-Za-z0-9]+','_'))] = ($liveHtml.IndexOf($marker,[System.StringComparison]::OrdinalIgnoreCase) -ge 0)
    }
    $checks.hero = ($liveHtml -match '<section\s+class=["''][^"'']*hero')
    $checks.primary_cta = ($liveHtml -match 'Browse the catalogue')
    $checks.catalogue_rails = ($liveHtml -match 'Digital products') -and ($liveHtml -match 'Games &amp; experiments')
    $checks.mtg_shelf = ($liveHtml -match 'Magic &amp; collectibles') -and ($liveHtml -match 'Browse MTG')
    $checks.dreammeez = ($liveHtml -match 'dreammeez|dreammee|DreamMee')
    $checks.overflow_contract_present = ($liveHtml -match 'max-width|min\(')
} catch {
    $errors += ('homepage: ' + $_.Exception.Message)
    $checks.http_200 = $false
}

try {
    $v = Invoke-WebRequest -Uri ($LiveUrl.TrimEnd('/') + '/version') -UseBasicParsing -TimeoutSec 20
    $version = $v.Content | ConvertFrom-Json
    $checks.version_200 = ([int]$v.StatusCode -eq 200)
    $checks.version_surface = ([string]$version.surface -eq 'public-v6')
    $checks.version_commit_present = (-not [string]::IsNullOrWhiteSpace([string]$version.commit)) -and ([string]$version.commit -ne 'unknown')
} catch {
    $errors += ('version: ' + $_.Exception.Message)
    $checks.version_200 = $false
    $checks.version_surface = $false
    $checks.version_commit_present = $false
}

$localCommit = Get-RepoCommit
$localIndex = Join-Path $Root 'public\index.html'
$checks.local_canonical_index_exists = Test-Path -LiteralPath $localIndex
if ($checks.local_canonical_index_exists) {
    $localHtml = Get-Content -LiteralPath $localIndex -Raw -Encoding UTF8
    $checks.local_index_contract = ($localHtml -match 'dreamledger-visual-contract[^>]+catalogue-first-v1') -and ($localHtml -match 'DISCOVER') -and ($localHtml -match 'THINGS WORTH BUYING')
} else { $checks.local_index_contract = $false }

$browser = 'missing'
$screenshots = @()
$playwrightCmd = Get-Command npx -ErrorAction SilentlyContinue
if ($null -ne $playwrightCmd) {
    try {
        & npx --no-install playwright --version *> $null
        if ($LASTEXITCODE -eq 0) {
            $browser = 'playwright'
            $desktopShot = Join-Path $OutputDir 'desktop-1440x900.png'
            $mobileShot = Join-Path $OutputDir 'mobile-390x844.png'
            & npx --no-install playwright screenshot --device='Desktop Chrome HiDPI' --viewport-size='1440,900' $LiveUrl $desktopShot *> (Join-Path $OutputDir 'playwright-desktop.log')
            if ($LASTEXITCODE -eq 0 -and (Test-Path -LiteralPath $desktopShot)) { $screenshots += $desktopShot }
            & npx --no-install playwright screenshot --viewport-size='390,844' $LiveUrl $mobileShot *> (Join-Path $OutputDir 'playwright-mobile.log')
            if ($LASTEXITCODE -eq 0 -and (Test-Path -LiteralPath $mobileShot)) { $screenshots += $mobileShot }
        }
    } catch {}
}
$checks.browser_available = ($browser -eq 'playwright')
$checks.screenshot_desktop = (Test-Path -LiteralPath (Join-Path $OutputDir 'desktop-1440x900.png'))
$checks.screenshot_mobile = (Test-Path -LiteralPath (Join-Path $OutputDir 'mobile-390x844.png'))

$failed = @($checks.GetEnumerator() | Where-Object { -not [bool]$_.Value })
$pass = ($failed.Count -eq 0 -and $errors.Count -eq 0)

$report = [ordered]@{
    schema = 'dreamledger/visual-verification/v1'
    checked_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    live_url = $LiveUrl
    repo_root = $Root
    repo_commit = $localCommit
    live_version = $version
    http_status = $httpStatus
    browser = $browser
    screenshots = @($screenshots)
    checks = $checks
    failures = @($failed | ForEach-Object { $_.Key })
    errors = $errors
    verdict = if ($pass) { 'PASS' } else { 'FAIL' }
}

Write-Ascii -Path (Join-Path $OutputDir 'REPORT.json') -Text ($report | ConvertTo-Json -Depth 20)
Write-Ascii -Path (Join-Path $OutputDir 'homepage.html') -Text $liveHtml
Write-Ascii -Path (Join-Path $OutputDir 'VERDICT.txt') -Text (($report.verdict + "`r`nrepo_commit=" + $localCommit + "`r`nlive_commit=" + [string]$version.commit + "`r`nchecked_utc=" + $report.checked_at_utc))

Write-Host '=== DREAMLEDGER VISUAL TRUTH GATE ==='
Write-Host ('LIVE=' + $LiveUrl)
Write-Host ('REPO_COMMIT=' + $localCommit)
Write-Host ('LIVE_COMMIT=' + [string]$version.commit)
Write-Host ('BROWSER=' + $browser)
foreach ($k in $checks.Keys) {
    if ($checks[$k]) { Write-Host ('PASS ' + $k) } else { Write-Host ('FAIL ' + $k) }
}
Write-Host ('PROOF_DIR=' + $OutputDir)
Write-Host ('VISUAL_GATE_VERDICT=' + $report.verdict)
if (-not $pass) { exit 1 }
exit 0
