param(
  [string]$BaseUrl = "https://dreamledger.org"
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$QueueFile = Join-Path $Root "atoms\ATOM_QUEUE.json"
$StateFile = Join-Path $Root "atoms\ATOM_STATE.json"
$ProofDir = Join-Path $Root "Proof\Atoms"
$FossilDir = Join-Path $Root "Proof\Fossils"
New-Item -ItemType Directory -Force -Path $ProofDir,$FossilDir | Out-Null
function Write-Proof($Atom,$Status,$Evidence) {
  $name = "{0}-{1}.json" -f $Atom.atom_id,(Get-Date -Format "yyyyMMdd-HHmmss")
  $path = Join-Path $ProofDir $name
  $proof = [ordered]@{atom_id=$Atom.atom_id;status=$Status;timestamp=(Get-Date).ToString("o");verified_revenue_nzd=0;silo=$Atom.silo;evidence=$Evidence}
  $proof | ConvertTo-Json -Depth 10 | Set-Content -Encoding ASCII $path
  return $path
}
$queue = Get-Content -Raw $QueueFile | ConvertFrom-Json
$atom = $queue.queue | Where-Object { $_.status -eq "pending" } | Select-Object -First 1
if (-not $atom) { Write-Host "NO_PENDING_ATOM"; exit 0 }
$status = "FAIL"
$evidence = @{}
try {
  switch ($atom.action) {
    "VERIFY_CHECKOUT" {
      $r = Invoke-RestMethod -Uri ($BaseUrl + "/api/products") -Method Get -TimeoutSec 15
      $p = $r.products | Where-Object { $_.id -eq "COMMANDER-DECK-DIAGNOSTIC-001" } | Select-Object -First 1
      if ($p -and $p.status -eq "published" -and $p.checkout_available -eq $true -and $p.approval_required -eq $false -and [int]$p.inventory -gt 0) { $status="PASS"; $evidence=@{endpoint=($BaseUrl+"/api/products");product_id=$p.id;price=$p.price;currency=$p.currency;checkout_available=$p.checkout_available;approval_required=$p.approval_required;inventory=$p.inventory} } else { throw "MTG checkout is not publicly payable according to the live product API." }
    }
    "VERIFY_DELIVERY" {
      $server = Get-Content -Raw (Join-Path $Root "server.js")
      $checks = @("checkout.session.completed","recordPayment","recordFulfillment","transaction_id","FIRST_PAYMENT_PROOF")
      $missing = @($checks | Where-Object { $server -notmatch [regex]::Escape($_) })
      if ($missing.Count -eq 0) { $status="PASS"; $evidence=@{delivery_webhook_present=$true;payment_recording_present=$true;fulfillment_recording_present=$true;proof_path_present=$true} } else { throw ("Delivery verification missing: " + ($missing -join ", ")) }
    }
    "FIND_PROSPECTS" { throw "Requires a real prospect source. No simulated prospects are permitted." }
    "PREPARE_OUTREACH" { throw "Requires approved prospect data. No simulated drafts are permitted." }
    "REQUEST_APPROVAL" { $status="PENDING_HUMAN"; $evidence=@{approval_required=$true;message="Human approval required before any outreach."} }
    "SEND_OUTREACH" { throw "Public outreach is approval-gated and is not executed by this atom runner." }
    "MONITOR_PAYMENT" {
      $files = @(Get-ChildItem -Path $FossilDir -Filter "*.json" -ErrorAction SilentlyContinue)
      $paid = @($files | ForEach-Object { try { $x=Get-Content -Raw $_.FullName | ConvertFrom-Json; if ($x.payment_received -eq $true -and $x.transaction_id) { $x } } catch {} })
      if ($paid.Count -ge 1) { $status="PASS"; $evidence=@{payment_count=$paid.Count;transaction_id=$paid[0].transaction_id;source="Stripe checkout.session.completed webhook"} } else { throw "No verified payment Fossil exists." }
    }
    "FULFIL_ORDER" {
      $files = @(Get-ChildItem -Path $FossilDir -Filter "*.json" -ErrorAction SilentlyContinue)
      $paid = @($files | ForEach-Object { try { $x=Get-Content -Raw $_.FullName | ConvertFrom-Json; if ($x.payment_received -eq $true -and $x.transaction_id) { $x } } catch {} })
      if ($paid.Count -ge 1) { $status="PASS"; $evidence=@{paid_orders=$paid.Count;fulfillment_contract="server.js revenueLedger/createFulfillment"} } else { throw "Cannot fulfil without verified payment." }
    }
    "WRITE_FOSSIL" {
      $files = @(Get-ChildItem -Path $FossilDir -Filter "*.json" -ErrorAction SilentlyContinue)
      $paid = @($files | Where-Object { $_.Name -notlike "ATOM-*" } | ForEach-Object { try { $x=Get-Content -Raw $_.FullName | ConvertFrom-Json; if ($x.payment_received -eq $true -and $x.transaction_id) { $x } } catch {} })
      if ($paid.Count -ge 1) { $status="PASS"; $evidence=@{fossil_count=$paid.Count;transaction_id=$paid[0].transaction_id;source="Stripe webhook"} } else { throw "No payment Fossil to confirm." }
    }
    "TEST_REPEATABILITY" {
      $files = @(Get-ChildItem -Path $FossilDir -Filter "*.json" -ErrorAction SilentlyContinue)
      $paid = @($files | ForEach-Object { try { $x=Get-Content -Raw $_.FullName | ConvertFrom-Json; if ($x.payment_received -eq $true -and $x.transaction_id) { $x } } catch {} })
      if ($paid.Count -ge 2) { $status="PASS"; $evidence=@{independent_payment_fossils=$paid.Count} } else { throw ("Need 2 independent payment Fossils; found " + $paid.Count) }
    }
    default { throw ("Unsupported atom action: " + $atom.action) }
  }
} catch { $evidence=@{error=$_.Exception.Message} }
$proofPath = Write-Proof $atom $status $evidence
foreach ($q in $queue.queue) {
  if ($q.atom_id -eq $atom.atom_id) {
    $q.status=$status
    $q.proof_path=$proofPath
    $q.completed_at=(Get-Date).ToString("o")
    if ($status -eq "PASS") { $q.next_atom=$q.next_on_success } elseif ($status -eq "FAIL") { $q.next_atom=$q.next_on_failure } else { $q.next_atom=$null }
  }
}
$queue | ConvertTo-Json -Depth 20 | Set-Content -Encoding ASCII $QueueFile
$paidFiles = @(Get-ChildItem -Path $FossilDir -Filter "*.json" -ErrorAction SilentlyContinue | Where-Object { $_.Name -notlike "ATOM-*" })
$state = [ordered]@{verified_revenue_nzd=0;payments=0;fulfilled_orders=0;repeat_payments=0;active_experiments=1;winner=$null;rabbit_mode=$false;last_atom=$atom.atom_id;last_status=$status;next_atom=($queue.queue | Where-Object { $_.status -eq "pending" } | Select-Object -First 1).atom_id;last_updated=(Get-Date).ToString("o")}
$realPaid = @($paidFiles | ForEach-Object { try { $x=Get-Content -Raw $_.FullName | ConvertFrom-Json; if ($x.payment_received -eq $true -and $x.transaction_id) { $x } } catch {} })
$state.payments=$realPaid.Count
if ($realPaid.Count -gt 0) { $state.verified_revenue_nzd=($realPaid | Measure-Object -Property amount_total_nzd -Sum).Sum; if ($null -eq $state.verified_revenue_nzd) { $state.verified_revenue_nzd=0 } }
if ($realPaid.Count -ge 2) { $state.repeat_payments=1 }
$state | ConvertTo-Json -Depth 10 | Set-Content -Encoding ASCII $StateFile
Write-Host ("ATOM={0} STATUS={1} PROOF={2} REVENUE_NZD={3}" -f $atom.atom_id,$status,$proofPath,$state.verified_revenue_nzd)
if ($status -eq "FAIL") { exit 2 }
if ($status -eq "PENDING_HUMAN") { exit 3 }
exit 0
