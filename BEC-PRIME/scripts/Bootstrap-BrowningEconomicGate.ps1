[CmdletBinding()]
param([string]$RepoRoot = "")
$ErrorActionPreference = "Stop"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$proofRoot = "D:\BrownEyeCortex\DreamLedger\EconomicGate"
New-Item -ItemType Directory -Force -Path $proofRoot | Out-Null
$log = Join-Path $proofRoot "bootstrap-$stamp.log"
Start-Transcript -Path $log -Force | Out-Null
try {
  if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $RepoRoot = (Get-Location).Path
    if (-not (Test-Path (Join-Path $RepoRoot "BEC-PRIME\package.json"))) {
      $candidates = @("C:\DreamLedger","C:\KelpCoin\DreamLedger","$env:USERPROFILE\DreamLedger")
      foreach ($c in $candidates) { if (Test-Path (Join-Path $c "BEC-PRIME\package.json")) { $RepoRoot=$c; break } }
    }
  }
  if (-not (Test-Path (Join-Path $RepoRoot "BEC-PRIME\package.json"))) { throw "DreamLedger repository not found. Run from repo root or pass -RepoRoot C:\path\to\DreamLedger." }
  $git = Get-Command git -ErrorAction SilentlyContinue
  if (-not $git) { throw "git is required" }
  Push-Location $RepoRoot
  $sha = (git rev-parse HEAD).Trim()
  $branch = (git branch --show-current).Trim()
  $dirty = (git status --porcelain)
  $backup = "bec-pre-browning-$stamp"
  git branch $backup $sha | Out-Null
  $gauntletDir = Join-Path $RepoRoot "BEC-PRIME\gauntlet"
  New-Item -ItemType Directory -Force -Path $gauntletDir | Out-Null
  $adapter = @'
'use strict';
const crypto = require('crypto');
const firstSaleGate = require('./FirstSaleGate');
const STATES = Object.freeze(['REJECT','QUARANTINE','PRE-MONEY','SELLABLE']);
function hash(v){ return crypto.createHash('sha256').update(JSON.stringify(v),'utf8').digest('hex'); }
function resolve(product, specialist){
  const p = product || {};
  const checks = [];
  if (!product || !p.id) return result('REJECT','PRODUCT_MISSING',checks,p,specialist);
  if (p.silo === 'mtg' && /amplissa|adult/i.test(JSON.stringify(p))) return result('REJECT','SILO_BOUNDARY',checks,p,specialist);
  if (p.commercial_truth && (p.commercial_truth.quarantine === true || String(p.commercial_truth.verdict || '').toUpperCase() === 'QUARANTINE')) return result('QUARANTINE','EXPLICIT_QUARANTINE',checks,p,specialist);
  if (specialist && Array.isArray(specialist)) {
    for (const g of specialist) if (String(g?.verdict || g?.status || '').toUpperCase() === 'FAIL') return result('REJECT',g.reason || g.message || 'SPECIALIST_GATE_FAIL',checks,p,specialist);
  }
  const fsr = firstSaleGate.check(p);
  if (fsr.verdict !== 'PASS') return result('PRE-MONEY','FIRST_SALE_GATE_FAIL',checks,p,{firstSaleGate:fsr});
  const ready = p.status === 'published' && p.commercial_truth?.approval_required === false && Number(p.inventory || 0) > 0 && Number(p.price) > 0;
  if (!ready) return result('PRE-MONEY','COMMERCIAL_READINESS_INCOMPLETE',checks,p,{firstSaleGate:fsr});
  return result('SELLABLE','ALL_CANONICAL_CHECKS_PASS',checks,p,{firstSaleGate:fsr});
}
function result(verdict,reason,checks,product,specialist){ return { verdict, reason, product_id: product?.id || null, checks, specialist, evaluated_at:new Date().toISOString(), evidence_hash:hash({verdict,reason,product,specialist}) }; }
module.exports={STATES,resolve};
'@
  $adapterPath = Join-Path $gauntletDir "BrowningVerdictAdapter.js"
  [IO.File]::WriteAllText($adapterPath,$adapter,(New-Object Text.UTF8Encoding($false)))
  $route = Join-Path $RepoRoot "BEC-PRIME\routes\mvpRoutes.js"
  $text = [IO.File]::ReadAllText($route)
  if ($text -notmatch "BrowningVerdictAdapter") {
    $text = $text.Replace("const stripeProof = require('../lib/stripeWebhookProof');", "const stripeProof = require('../lib/stripeWebhookProof');`r`nconst browning = require('../gauntlet/BrowningVerdictAdapter');")
  }
  $old = "  const p = checkoutableProduct(requested);`r`n  if (!p) return json(res, 403, { error: 'Product is not approved and checkoutable' });"
  $new = "  const candidate = product(requested);`r`n  const gate = browning.resolve(candidate);`r`n  if (gate.verdict !== 'SELLABLE') return json(res, 403, { error: 'Browning Gauntlet blocked checkout', verdict: gate.verdict, reason: gate.reason, product_id: gate.product_id });`r`n  const p = checkoutableProduct(requested);`r`n  if (!p) return json(res, 403, { error: 'Product is not approved and checkoutable' });"
  if ($text.Contains($old)) { $text=$text.Replace($old,$new) } elseif ($text -notmatch "Browning Gauntlet blocked checkout") { throw "Expected createCheckout anchor not found; no route patch applied." }
  [IO.File]::WriteAllText($route,$text,(New-Object Text.UTF8Encoding($false)))
  $verify = @'
'use strict';
const assert=require('assert');
const {resolve,STATES}=require('../gauntlet/BrowningVerdictAdapter');
function base(){return {id:'TEST',silo:'mtg',status:'published',inventory:1,price:29,currency:'nzd',checkout:{mode:'payment'},commercial_truth:{approval_required:false,payment_surface:'engine-generated-stripe-checkout',sellable:true}};}
const cases=[];
let p=base(); p.status='draft'; cases.push(['REJECT-ish PRE-MONEY',resolve(p).verdict,'PRE-MONEY']);
p=base(); p.commercial_truth.approval_required=true; cases.push(['approval locked',resolve(p).verdict,'PRE-MONEY']);
p=base(); p.inventory=0; cases.push(['no inventory',resolve(p).verdict,'PRE-MONEY']);
p=base(); p.commercial_truth.quarantine=true; cases.push(['quarantine',resolve(p).verdict,'QUARANTINE']);
p=base(); p.silo='mtg'; p.description='Amplissa'; cases.push(['silo breach',resolve(p).verdict,'REJECT']);
p=base(); cases.push(['sellable',resolve(p).verdict,'SELLABLE']);
for(const [name,got,want] of cases){assert.strictEqual(got,want,name+': '+got+' != '+want);}
console.log(JSON.stringify({status:'PASS',cases,states:STATES},null,2));
'@
  $vp = Join-Path $RepoRoot "BEC-PRIME\scripts\verify-browning-economic-gate.js"
  [IO.File]::WriteAllText($vp,$verify,(New-Object Text.UTF8Encoding($false)))
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) { throw "node is required for verification" }
  $out = & node $vp 2>&1
  $exit = $LASTEXITCODE
  $proof = [ordered]@{type='dreamledger-browning-economic-gate-bootstrap';timestamp=(Get-Date).ToUniversalTime().ToString('o');repo=$RepoRoot;before_sha=$sha;branch=$branch;backup_branch=$backup;working_tree_dirty=([bool]$dirty);adapter=$adapterPath;route=$route;verification=$out;verification_exit=$exit;economic_status='RA_000001_UNPROVEN'}
  $proofPath = Join-Path $proofRoot "VERIFICATION-$stamp.json"
  $proof | ConvertTo-Json -Depth 10 | Set-Content -Encoding ASCII $proofPath
  if ($exit -ne 0) { throw "Verification failed. Proof: $proofPath" }
  Write-Host "PASS: Browning economic gate bootstrap installed."
  Write-Host "Repo: $RepoRoot"
  Write-Host "Backup branch: $backup"
  Write-Host "Proof: $proofPath"
  Write-Host "Verifier: node BEC-PRIME\scripts\verify-browning-economic-gate.js"
  Pop-Location
} finally { Stop-Transcript | Out-Null }
