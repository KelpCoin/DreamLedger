$root = "C:\BrownEyeCortex"
$required = @("$root\ledger\event_ledger.jsonl","$root\public\happyhomarid\index.html","$root\stencils\EDH_Upgrade_MicroAudit.json","$root\keys\stripe_secret.key")
foreach ($f in $required) { if (!(Test-Path $f)) { throw "MISSING CORE FILE: $f" } }
$key = Get-Content "$root\keys\stripe_secret.key" -Raw
if ($key.Trim().Length -lt 10) { throw "Stripe key empty or invalid" }
$html = Get-Content "$root\public\happyhomarid\index.html" -Raw
if ($html -notmatch "data-stripe-link") { Write-Warning "Storefront missing injection anchor" }
$badLines = 0
Get-Content "$root\ledger\event_ledger.jsonl" -Tail 2000 | ForEach-Object { try { $_ | ConvertFrom-Json | Out-Null } catch { $badLines++ } }
if ($badLines -gt 0) { Write-Warning "Corrupted ledger entries: $badLines" }
Write-Host "SYSTEM GUARD: OK (storefront: happyhomarid)" -ForegroundColor Green
