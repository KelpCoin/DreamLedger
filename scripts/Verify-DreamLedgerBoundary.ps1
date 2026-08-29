#requires -version 5.1
$ErrorActionPreference = 'Continue'
$Base = 'https://dreamledger.org'
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$ProofRoot = if (Test-Path 'D:\BrownEyeCortex') { 'D:\BrownEyeCortex\PROOF' } else { 'C:\BrownEyeCortex\PROOF' }
New-Item -ItemType Directory -Force -Path $ProofRoot | Out-Null
$Proof = Join-Path $ProofRoot "DreamLedger-Boundary-$Stamp.json"

$public = @('/', '/billboard', '/go', '/healthz')
$private = @('/gauntlet','/elohim','/trust-engine','/ip','/portfolio','/BEC-PRIME','/distribution','/compiler','/internal','/admin','/debug')
$sensitive = @('/.env','/package.json','/package-lock.json','/server.js','/start.js')
$terms = @('BECK','DECK','BEC-PRIME','Gauntlet','Elohim','Economic Court','Trust Engine','Compiler','LIVE_CONFIGURABLE','QUARANTINED_NO_FULFILLMENT','orchestration','ledger','proof')

$results = [ordered]@{
  timestamp = (Get-Date).ToUniversalTime().ToString('o')
  base = $Base
  public = [ordered]@{}
  private = [ordered]@{}
  sensitive = [ordered]@{}
  leak_scan = [ordered]@{ terms = @(); clean = $false }
  overall = 'FAIL'
}

function Probe($path) {
  try {
    $r = Invoke-WebRequest -Uri ($Base + $path) -UseBasicParsing -TimeoutSec 20 -MaximumRedirection 0 -ErrorAction Stop
    return [ordered]@{ status = [int]$r.StatusCode; verdict = 'REVIEW'; bytes = [int]$r.Content.Length; body = [string]$r.Content }
  } catch {
    $resp = $_.Exception.Response
    if ($resp) {
      $status = [int]$resp.StatusCode
      $body = ''
      try { $body = (New-Object IO.StreamReader($resp.GetResponseStream())).ReadToEnd() } catch {}
      return [ordered]@{ status = $status; verdict = $(if($status -in 403,404){'PASS'}elseif($status -ge 300 -and $status -lt 400){'REVIEW'}else{'FAIL'}); bytes = $body.Length; body = $body }
    }
    return [ordered]@{ status = 0; verdict = 'FAIL'; bytes = 0; body = $_.Exception.Message }
  }
}

foreach ($p in $public) {
  $x = Probe $p
  $results.public[$p] = [ordered]@{ status=$x.status; verdict=$(if($p -eq '/go' -and $x.status -in 200,301,302,303,307,308){'PASS'}elseif($p -ne '/go' -and $x.status -eq 200){'PASS'}else{'FAIL'}); bytes=$x.bytes }
  if ($p -eq '/' -and $x.body) {
    $hits = @()
    foreach ($t in $terms) { if ($x.body -match [regex]::Escape($t)) { $hits += $t } }
    $results.leak_scan.terms = $hits
  }
}

foreach ($p in $private) {
  $x = Probe $p
  $results.private[$p] = [ordered]@{ status=$x.status; verdict=$x.verdict }
}
foreach ($p in $sensitive) {
  $x = Probe $p
  $results.sensitive[$p] = [ordered]@{ status=$x.status; verdict=$(if($x.status -in 403,404){'PASS'}else{'FAIL'}) }
}

$results.leak_scan.clean = ($results.leak_scan.terms.Count -eq 0)
$publicPass = ($results.public.Values | Where-Object { $_.verdict -ne 'PASS' }).Count -eq 0
$privatePass = ($results.private.Values | Where-Object { $_.verdict -ne 'PASS' }).Count -eq 0
$sensitivePass = ($results.sensitive.Values | Where-Object { $_.verdict -ne 'PASS' }).Count -eq 0
$results.overall = if($publicPass -and $privatePass -and $sensitivePass -and $results.leak_scan.clean){'PASS'}else{'FAIL'}

$json = $results | ConvertTo-Json -Depth 8
Set-Content -Path $Proof -Value $json -Encoding ASCII
$hash = (Get-FileHash $Proof -Algorithm SHA256).Hash
Add-Content -Path $Proof -Value "`nSHA256=$hash" -Encoding ASCII

Write-Host "BOUNDARY_PROOF=$($results.overall)" -ForegroundColor $(if($results.overall -eq 'PASS'){'Green'}else{'Red'})
Write-Host "PROOF=$Proof"
Write-Host "SHA256=$hash"
Write-Host "60-SECOND VERIFICATION: Get-Content '$Proof' -Tail 80"
