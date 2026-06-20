Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

# =========================
# ROOTS
# =========================
$Root = "C:\BrownEyeCortex"
$DL = "D:\dreamledger"

$SKU = "$DL\sku"
$Store = "$DL\store"
$Ledger = "$DL\ledger"
$Vault = "$DL\vault"

New-Item -ItemType Directory -Force -Path $SKU, $Store, $Ledger, $Vault | Out-Null

# =========================
# 1. SKU REGISTRY (SOURCE OF TRUTH)
# =========================
$skuFile = "$SKU\registry.json"

if (!(Test-Path $skuFile)) {
    @() | ConvertTo-Json | Set-Content $skuFile -Encoding UTF8
}

function Add-SKU {
    param(
        [string]$id,
        [string]$title,
        [decimal]$price,
        [string]$file,
        [string]$license = "single",
        [string]$resell = "no"
    )

    $data = Get-Content $skuFile | ConvertFrom-Json

    $item = [PSCustomObject]@{
        id = $id
        title = $title
        price = $price
        file = $file
        license = $license
        resell = $resell
        created = (Get-Date -Format o)
    }

    $data += $item
    $data | ConvertTo-Json -Depth 10 | Set-Content $skuFile -Encoding UTF8

    Write-Host "SKU_ADDED:$id"
}

# =========================
# 2. SEED DEMO SKUS (RESELLABLE CARTRIDGES)
# =========================
Add-SKU "DL-001" "MTG Deck Pack Alpha" 9.99 "mtg-alpha.zip" "single" "yes"
Add-SKU "DL-002" "Prompt Engine Bundle" 14.99 "prompt-bundle.zip" "multi" "yes"
Add-SKU "DL-003" "Business Automation Kit" 29.99 "automation-kit.zip" "enterprise" "yes"

# create dummy payloads
"alpha" | Set-Content "$Vault\mtg-alpha.zip"
"prompts" | Set-Content "$Vault\prompt-bundle.zip"
"automation" | Set-Content "$Vault\automation-kit.zip"

# =========================
# 3. LEDGER (APPEND ONLY SALES LOG)
# =========================
$ledgerFile = "$Ledger\sales.log"
New-Item -ItemType File -Force -Path $ledgerFile | Out-Null

function Log-Sale {
    param([string]$sku, [string]$tx)

    $line = "$(Get-Date -Format o) SALE $sku TX:$tx"
    Add-Content $ledgerFile $line
}

# =========================
# 4. STORE GENERATOR (ENDLESS SCROLL HTML)
# =========================
function Build-Store {
    $items = Get-Content $skuFile | ConvertFrom-Json

    $htmlItems = ""

    foreach ($i in $items) {

        $htmlItems += @"
<div class="card">
<h2>$($i.title)</h2>
<p>SKU: $($i.id)</p>
<p>License: $($i.license) | Resell: $($i.resell)</p>
<p>Price: $$($i.price)</p>
<a class="buy" href="/buy.html?sku=$($i.id)">Buy Now</a>
</div>
"@
    }

    $html = @"
<html>
<head>
<meta charset="UTF-8">
<title>DreamLedger Store</title>
<style>
body{font-family:sans-serif;background:#0b0b0b;color:#e0e0e0;max-width:900px;margin:2rem auto}
.card{background:#1a1a1a;border:1px solid #333;padding:1.2rem;margin-bottom:1rem;border-radius:8px}
h1{color:#ffd966}
.buy{display:inline-block;background:#ffd966;color:#000;padding:0.5rem 1rem;text-decoration:none}
</style>
</head>
<body>

<h1>DreamLedger Marketplace</h1>
<p>Resellable digital cartridges. Steam-style infinite SKU feed.</p>

$htmlItems

</body>
</html>
"@

    $path = "$Store\store.html"
    $html | Set-Content $path -Encoding UTF8

    Write-Host "STORE_BUILT:$path"
}

Build-Store

# =========================
# 5. BUY FLOW (LOCAL STRIPE GATE SIMULATION)
# =========================
$buy = @"
<html>
<body style="background:#111;color:#fff;font-family:sans-serif">
<h2>DreamLedger Checkout Stub</h2>
<p>This is where Stripe redirect will attach.</p>
<p>SKU will be resolved server-side later.</p>
</body>
</html>
"@

$buy | Set-Content "$Store\buy.html" -Encoding UTF8

# =========================
# 6. PROOF ARTIFACT
# =========================
$proof = "$Ledger\bootstrap-proof.json"

@{
    timestamp = (Get-Date -Format o)
    skus = (Get-Content $skuFile | ConvertFrom-Json).Count
    store = "$Store\store.html"
    ledger = $ledgerFile
    vault = $Vault
} | ConvertTo-Json | Set-Content $proof

Write-Host "BOOTSTRAP_COMPLETE"
Write-Host "STORE: $Store\store.html"
Write-Host "SKU: $skuFile"
Write-Host "PROOF: $proof"