$root = Split-Path $MyInvocation.MyCommand.Path -Parent
$required = @(
    "scripts\verify_from_notion.py",
    "scripts\publish_from_notion.py",
    "scripts\validate_decklock.py",
    "scripts\verify_ledger.py",
    "scripts\generate_site.py",
    "workers\stripe-webhook\src\index.js",
    "boilerplate\templates\listing.html",
    "ledger",
    "passports",
    "proofs"
)
$bad = @()
foreach ($x in $required) {
    if (Test-Path "$root\$x") {
        Write-Host "OK $x"
    } else {
        Write-Host "MISSING $x"
        $bad += $x
    }
}
if ($bad.Count -gt 0) {
    Write-Host "`nFAILED" -ForegroundColor Red
    exit 1
}
Write-Host "`nDREAMLEDGER MTG READY" -ForegroundColor Green
