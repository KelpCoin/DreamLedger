$root = "D:\DreamLedgerMTG"
Write-Host "DreamLedger MTG v3.3 IGNITION" -ForegroundColor Cyan
# 1. Seed exists
if (Test-Path "$root\ignition\seed_deck.json") { Write-Host "[PASS] Seed product exists" -ForegroundColor Green } else { Write-Host "[FAIL] Seed missing" -ForegroundColor Red; exit 1 }
# 2. Create passport via Python (run publish_from_notion.py with env)
python $root\scripts\publish_from_notion.py
if ($LASTEXITCODE -ne 0) { Write-Host "[FAIL] Publish script error" -ForegroundColor Red; exit 1 }
# 3. Validate passport
if (Test-Path "$root\passports\DL-MTG-00001.json") { Write-Host "[PASS] Passport generated" -ForegroundColor Green } else { Write-Host "[FAIL] Passport missing" -ForegroundColor Red; exit 1 }
# 4. Check Stripe URL (requires secrets)
$passport = Get-Content "$root\passports\DL-MTG-00001.json" | ConvertFrom-Json
if ($passport.commerce.stripe_url) { Write-Host "[PASS] Checkout URL exists" -ForegroundColor Green } else { Write-Host "[WARN] Stripe not configured" -ForegroundColor Yellow }
# 5. Site generated
python $root\scripts\generate_site.py
if (Test-Path "$root\_site\mtg\DL-MTG-00001\index.html") { Write-Host "[PASS] Listing generated" -ForegroundColor Green } else { Write-Host "[FAIL] Listing missing" -ForegroundColor Red; exit 1 }
# 6. Ledger valid
python $root\scripts\verify_ledger.py
if ($LASTEXITCODE -eq 0) { Write-Host "[PASS] Ledger valid" -ForegroundColor Green } else { Write-Host "[FAIL] Ledger broken" -ForegroundColor Red; exit 1 }
# 7. Revenue directory
if (Test-Path "$root\revenue\atoms") { Write-Host "[PASS] Revenue system ready" -ForegroundColor Green } else { Write-Host "[FAIL] Missing revenue dir" -ForegroundColor Red; exit 1 }
Write-Host "SYSTEM STATE: READY FOR FIRST CUSTOMER" -ForegroundColor Green