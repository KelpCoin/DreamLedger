$root = "D:\DreamLedgerMTG"
$checks = @(
    "ignition\seed_deck.json",
    "passports\DL-MTG-00001.json",
    "ledger\chain.jsonl",
    "revenue\atoms",
    "proofs\revenue"
)
$bad = @()
foreach ($c in $checks) {
    if (Test-Path "$root\$c") { Write-Host "[PASS] $c" -ForegroundColor Green }
    else { Write-Host "[FAIL] $c" -ForegroundColor Red; $bad += $c }
}
if ($bad) { Write-Host "`nNOT READY" -ForegroundColor Red; exit 1 }
else { Write-Host "`nSYSTEM STATE: READY FOR FIRST CUSTOMER" -ForegroundColor Green }