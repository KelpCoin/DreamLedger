# BrownEye Cortex - MTG 80/20 customizer, local-only bootstrap
# PowerShell 5.1 and 7 compatible. ASCII-only. Idempotent.
# No repository commit, deploy, Stripe action, or public posting.
[CmdletBinding()]
param([string]$RepoRoot = '')
$ErrorActionPreference = 'Stop'

function Locate-Repo {
    param([string]$Explicit)
    $choices = @()
    if ($Explicit) { $choices += $Explicit }
    $choices += @('D:\DreamLedger_Actual', 'D:\DreamLedger', 'D:\BrownEyeCortexData\DreamLedger', 'C:\BrownEyeCortex\DreamLedger', (Get-Location).Path)
    foreach ($path in $choices) {
        if ($path -and (Test-Path (Join-Path $path 'BEC-PRIME'))) { return (Resolve-Path $path).Path }
    }
    throw 'Cannot locate DreamLedger repo. Pass -RepoRoot with the directory containing BEC-PRIME.'
}

$RepoRoot = Locate-Repo $RepoRoot
$Root = Join-Path $RepoRoot 'BEC-PRIME'
$ConfigDir = Join-Path $Root 'catalog\customization'
$UiDir = Join-Path $Root 'website'
$ProofDir = if (Test-Path 'D:\') { 'D:\BrownEye\BROWNEYE_ARTIFACTS\MTG_8020' } else { Join-Path $Root 'RUN-PROOFS\MTG_8020' }
foreach ($dir in @($ConfigDir,$UiDir,$ProofDir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

# Never overwrite real operator-entered customization inventory.
$ConfigFile = Join-Path $ConfigDir 'EDH_0001.json'
$ProductFile = Join-Path $Root 'catalog\products\EDH_0001.json'
if (-not (Test-Path $ProductFile)) { throw 'Canonical EDH_0001 product JSON not found; refusing to invent it.' }
$product = Get-Content -LiteralPath $ProductFile -Raw | ConvertFrom-Json
if ($product.id -ne 'EDH_0001' -or [int]$product.price -ne 40000 -or $product.currency -ne 'nzd') {
    throw 'Canonical EDH_0001 id, 40000 cents, or nzd mismatch; refusing to change price.'
}
if (-not (Test-Path $ConfigFile)) {
@'
{
  "schema": "BEC/MTG_8020/v1",
  "id": "EDH_0001",
  "silo": "mtg",
  "land_packages": [],
  "approved_swaps": [],
  "premium_upgrades": [],
  "max_card_swaps": 2,
  "stock_checked": false,
  "full_100_card_list_verified": false,
  "simulation_evidence": null,
  "primer_evidence": null,
  "approved_for_public_checkout": false
}
'@ | Set-Content -LiteralPath $ConfigFile -Encoding ASCII
}

# Offline prototype. All prices are informational until stock/pricing are verified
# against the canonical server, so the payment button is intentionally absent.
$UiFile = Join-Path $UiDir 'mtg-8020.html'
@'
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Make It Yours | Commander Deck Configurator</title>
<style>
:root{color-scheme:dark;font-family:system-ui,Segoe UI,sans-serif;background:#0c1116;color:#f3f0e9}
*{box-sizing:border-box}body{margin:0}main{max-width:760px;margin:auto;padding:28px 18px 70px}
h1{font-size:clamp(2.2rem,7vw,3.5rem);line-height:1.05}p{line-height:1.55;color:#bdc7cf}
section{padding:22px;margin:20px 0;background:#161e26;border:1px solid #394653;border-radius:16px}
label{display:block;margin:15px 0 8px}select{width:100%;padding:12px;background:#0c1116;color:white;border:1px solid #64788c;border-radius:9px}
.tag{color:#e7be65;font-weight:800;letter-spacing:.09em;font-size:.8rem}.notice{padding:14px;background:#302a1b;border-radius:8px}
button{padding:12px 18px;background:#e7be65;color:#10151a;border:0;border-radius:9px;font-weight:bold}
button:disabled{opacity:.55}.price{font-size:1.75rem;font-weight:900}.meta{font-size:.86rem}
</style></head><body><main>
<div class="tag">MTG SILO / LOCAL CONFIGURATOR PROTOTYPE</div>
<h1>Built to play. Finished your way.</h1>
<p>Start with a finished Commander deck, then choose from verified lands and up to two approved substitutions.</p>
<section><h2>1. Deck foundation</h2><div id="deck">Checking local product data...</div></section>
<section><h2>2. Choose your lands</h2><label for="lands">Land package</label><select id="lands" disabled><option>No verified land packages yet</option></select></section>
<section><h2>3. Personalize two slots</h2><label for="swap1">First approved swap</label><select id="swap1" disabled><option>No verified swaps yet</option></select><label for="swap2">Second approved swap</label><select id="swap2" disabled><option>No verified swaps yet</option></select></section>
<section><h2>4. Review</h2><p id="choices">Waiting for confirmed inventory.</p><div class="price" id="price">Price not verified</div><p class="meta">Prices are indicative until the server verifies stock and constructs an order.</p><button disabled>Checkout locked until verified</button></section>
<p class="notice">This is an offline prototype, not a live offer. It does not reserve cards, create a Stripe session, or claim completed simulations.</p>
</main>
<script>
(function(){'use strict';
const qs = (id) => document.getElementById(id);
async function get(url) {const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}
function option(select,obj) {const o=document.createElement('option');o.value=obj.id;o.textContent=obj.name+' (NZ$'+(Number(obj.price_delta_cents||0)/100).toFixed(2)+')';select.appendChild(o);}
function fill(select,items,placeholder){if(!items.length)return;select.innerHTML='';option(select,{id:'none',name:placeholder,price_delta_cents:0});items.forEach(x=>{if(x.in_stock===true&&x.approved===true)option(select,x)});select.disabled=(select.options.length<=1);}
let cfg=null,product=null;
function total(){let cents=Number(product.price||0);const picked=[];for(const k of ['lands','swap1','swap2']){const id=qs(k).value;const list=k==='lands'?cfg.land_packages:cfg.approved_swaps;const obj=list.find(x=>x.id===id);if(obj){cents+=Number(obj.price_delta_cents||0);picked.push(obj.name)}}qs('price').textContent='Indicative: NZ$'+(cents/100).toFixed(2);qs('choices').textContent=picked.length?picked.join(' / '):'Base deck only';}
async function boot(){try{[cfg,product]=await Promise.all([get('./catalog/customization/EDH_0001.json'),get('./catalog/products/EDH_0001.json')]);
if(product.id!=='EDH_0001'||product.price!==40000||product.currency!=='nzd'||cfg.id!=='EDH_0001')throw new Error('Canonical product mismatch');
qs('deck').textContent=(product.name||'EDH_0001')+' | NZ$'+(product.price/100).toFixed(2);
fill(qs('lands'),cfg.land_packages||[],'Standard lands');fill(qs('swap1'),cfg.approved_swaps||[],'Keep original');fill(qs('swap2'),cfg.approved_swaps||[],'Keep original');
for(const id of ['lands','swap1','swap2'])qs(id).addEventListener('change',()=>{if(qs('swap1').value!=='none'&&qs('swap1').value===qs('swap2').value){qs('swap2').value='none'}total()});total();
}catch(e){qs('deck').textContent='Unverified: '+e.message;}}
boot();})();
</script></body></html>
'@ | Set-Content -LiteralPath $UiFile -Encoding ASCII

$checks = [ordered]@{}
$checks.canonical_product = ($product.id -eq 'EDH_0001' -and [int]$product.price -eq 40000 -and $product.currency -eq 'nzd')
$checks.config_exists = Test-Path $ConfigFile
$checks.ui_exists = Test-Path $UiFile
$cfg = Get-Content -LiteralPath $ConfigFile -Raw | ConvertFrom-Json
$checks.silo_isolated = ($cfg.silo -eq 'mtg')
$checks.no_unverified_checkout = ($cfg.approved_for_public_checkout -eq $false)
$checks.max_two_swaps = ([int]$cfg.max_card_swaps -eq 2)
$checks.no_fabricated_options = (($cfg.land_packages.Count + $cfg.approved_swaps.Count + $cfg.premium_upgrades.Count) -eq 0)
$checks.page_no_payment_action = -not ((Get-Content -LiteralPath $UiFile -Raw) -match 'fetch\s*\([^)]*checkout')
$pass = @($checks.Values | Where-Object { -not $_ }).Count -eq 0
$ProofFile = Join-Path $ProofDir 'MTG-8020-PROOF.json'
$LogFile = Join-Path $ProofDir 'MTG-8020.log'
$proof = [ordered]@{
    schema='BEC/MTG_8020_LOCAL_PROOF/v1'
    timestamp_utc=(Get-Date).ToUniversalTime().ToString('o')
    status=$(if($pass){'PASS_LOCAL_SCAFFOLD'}else{'FAIL'})
    repo_root=$RepoRoot
    product_id='EDH_0001'
    canonical_price_cents=40000
    checks=$checks
    config_path=$ConfigFile
    ui_path=$UiFile
    config_sha256=(Get-FileHash -LiteralPath $ConfigFile -Algorithm SHA256).Hash
    ui_sha256=(Get-FileHash -LiteralPath $UiFile -Algorithm SHA256).Hash
    public_deployment='NOT_ATTEMPTED'
    checkout='NOT_ATTEMPTED'
    paid_event='NOT_PROVEN'
}
$proof | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $ProofFile -Encoding ASCII
("{0} status={1} proof={2}" -f $proof.timestamp_utc,$proof.status,$ProofFile) | Add-Content -LiteralPath $LogFile -Encoding ASCII
Write-Host ('STATUS=' + $proof.status)
Write-Host ('PROOF=' + $ProofFile)
Write-Host ('LOG=' + $LogFile)
Write-Host ('UI=' + $UiFile)
Write-Host ('CONFIG=' + $ConfigFile)
if(-not $pass){throw 'Local scaffold verification failed. See proof.'}