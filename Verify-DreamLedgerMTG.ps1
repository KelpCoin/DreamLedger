$root = Split-Path $MyInvocation.MyCommand.Path -Parent
$required = @(
    "scripts\verify_from_notion.py",
    "scripts\publish_from_notion.py",
    "scripts\validate_decklock.py",
    "scripts\verify_ledger.py",
    "scripts\generate_site.py",
    "scripts\ai_agent.py",
    "scripts\intake_server.py",
    "scripts\intake_worker.py",
    "scripts\create_revenue_atom.py",
    "workers\stripe-webhook\src\index.js",
    "boilerplate\templates\listing.html",
    "mobile-intake\app\intake.html",
    "ignition\seed_deck.json",
    "ignition\run_ignition.ps1",
    "Verify-Ignition.ps1",
    "ledger",
    "passports",
    "proofs"
)
$bad = @()
foreach ($x in $required) {
    if (Test-Path "$root\$x") { Write-Host "OK $x" -ForegroundColor Green }
    else { Write-Host "MISSING $x" -ForegroundColor Red; $bad += $x }
}
if ($bad) { Write-Host "`nFAILED" -ForegroundColor Red; exit 1 }
else { Write-Host "`nDREAMLEDGER MTG v3.3 READY" -ForegroundColor Green }