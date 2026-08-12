#requires -Version 5.1
[CmdletBinding()]
param([string]$Atom = 'MTG-001',[string]$BaseUrl = 'https://dreamledger.org')
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$AtomDir = Join-Path $Root 'atoms'
$ProofDir = Join-Path $Root 'proof\atoms'
$StateFile = Join-Path $AtomDir 'ATOM_STATE.json'
$QueueFile = Join-Path $AtomDir 'ATOM_QUEUE.json'
New-Item -ItemType Directory -Force -Path $ProofDir | Out-Null
$queue = Get-Content -Raw $QueueFile | ConvertFrom-Json
$item = @($queue.queue | Where-Object { $_.atom_id -eq $Atom }) | Select-Object -First 1
if (-not $item) { throw "Unknown atom: $Atom" }
$now = (Get-Date).ToUniversalTime().ToString('o')
$result = [ordered]@{ atom_id=$Atom; silo=$item.silo; action=$item.action; timestamp_utc=$now; status='FAIL'; evidence_level=0; verified_revenue_nzd=0; payment_verified=$false; notes=@() }

switch ($item.action) {
  'VERIFY_CHECKOUT' {
    $page = Invoke-WebRequest -Uri ($BaseUrl.TrimEnd('/') + '/commander-diagnostic.html') -UseBasicParsing -TimeoutSec 20
    if ($page.StatusCode -ne 200) { throw "Sales page HTTP status $($page.StatusCode)" }
    if ($page.Content -notmatch 'NZD \$25') { throw 'Sales page does not advertise NZD $25.' }
    if ($page.Content -notmatch 'COMMANDER-DECK-DIAGNOSTIC-001') { throw 'Sales page is not wired to canonical MTG product.' }
    $result.status='PASS'; $result.evidence_level=1; $result.notes += 'Public sales page is reachable and advertises NZD $25.'
    $result.next_atom='MTG-002'
  }
  'VERIFY_DELIVERY' {
    $page = Invoke-WebRequest -Uri ($BaseUrl.TrimEnd('/') + '/commander-diagnostic.html') -UseBasicParsing -TimeoutSec 20
    if ($page.StatusCode -ne 200) { throw "Delivery surface HTTP status $($page.StatusCode)" }
    if ($page.Content -notmatch 'Power-level assessment') { throw 'Delivery promise missing.' }
    $result.status='PASS'; $result.evidence_level=1; $result.notes += 'Published delivery promise is present.'; $result.next_atom='MTG-003'
  }
  default { throw "Atom action $($item.action) is not executable by this safe runner yet. No synthetic success is permitted." }
}
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$proof = Join-Path $ProofDir "$Atom-$stamp.json"
$result | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 $proof
$state = [ordered]@{ last_atom=$Atom; last_status=$result.status; next_atom=$result.next_atom; timestamp_utc=$now; verified_revenue_nzd=0; payments=0; fulfilled_orders=0; repeat_payments=0; active_experiments=1; winner=$null; rabbit_mode=$false; proof_path=$proof }
$state | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 $StateFile
Write-Host "ATOM=$Atom STATUS=$($result.status) REVENUE_NZD=0 PROOF=$proof"
if ($result.status -ne 'PASS') { exit 1 }
