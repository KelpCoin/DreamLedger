[CmdletBinding()]
param([string]$RepoRoot = "")
$ErrorActionPreference = "Stop"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$proofRoot = "D:\BrownEyeCortex\DreamLedger\EconomicGate"
New-Item -ItemType Directory -Force -Path $proofRoot | Out-Null
$log = Join-Path $proofRoot "bootstrap-$stamp.log"
$transcriptStarted = $false
$locationPushed = $false
try {
  Start-Transcript -Path $log -Force | Out-Null
  $transcriptStarted = $true

  if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $RepoRoot = (Get-Location).Path
    if (-not (Test-Path (Join-Path $RepoRoot "BEC-PRIME\package.json"))) {
      $candidates = @("C:\DreamLedger","C:\KelpCoin\DreamLedger","$env:USERPROFILE\DreamLedger")
      foreach ($c in $candidates) {
        if (Test-Path (Join-Path $c "BEC-PRIME\package.json")) { $RepoRoot=$c; break }
      }
    }
  }
  if ([string]::IsNullOrWhiteSpace($RepoRoot) -or -not (Test-Path (Join-Path $RepoRoot "BEC-PRIME\package.json"))) {
    throw "DreamLedger repository not found. Run from repo root or pass -RepoRoot C:\path\to\DreamLedger."
  }
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw "git is required" }
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "node is required" }

  Push-Location $RepoRoot
  $locationPushed = $true
  $shaRaw = @(git rev-parse HEAD 2>$null)
  if ($shaRaw.Count -lt 1 -or [string]::IsNullOrWhiteSpace([string]$shaRaw[0])) { throw "Unable to resolve git HEAD." }
  $sha = ([string]$shaRaw[0]).Trim()

  $branchRaw = @(git branch --show-current 2>$null)
  $branch = if ($branchRaw.Count -gt 0) { ([string]$branchRaw[0]).Trim() } else { "" }
  if ([string]::IsNullOrWhiteSpace($branch)) { $branch = "DETACHED-HEAD" }

  $dirty = @(git status --porcelain)
  $backup = "bec-pre-browning-$stamp"
  $existingBackup = @(git branch --list $backup)
  if ($existingBackup.Count -eq 0) { git branch $backup $sha | Out-Null }

  $route = Join-Path $RepoRoot "BEC-PRIME\routes\mvpRoutes.js"
  if (-not (Test-Path -LiteralPath $route -PathType Leaf)) { throw "Required route file missing: $route" }
  $routeBackup = Join-Path $proofRoot "mvpRoutes-before-$stamp.js"
  Copy-Item $route $routeBackup -Force

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
  if (!product || !p.id) return result('REJECT','PRODUCT_MISSING',p,specialist);
  if (p.silo === 'mtg' && /amplissa|adult/i.test(JSON.stringify(p))) return result('REJECT','SILO_BOUNDARY',p,specialist);
  if (p.commercial_truth && (p.commercial_truth.quarantine === true || String(p.commercial_truth.verdict || '').toUpperCase() === 'QUARANTINE')) return result('QUARANTINE','EXPLICIT_QUARANTINE',p,specialist);
  if (Array.isArray(specialist)) for (const g of specialist) if (String(g?.verdict || g?.status || '').toUpperCase() === 'FAIL') return result('REJECT',g.reason || g.message || 'SPECIALIST_GATE_FAIL',p,specialist);
  const fsr = firstSaleGate.check(p);
  if (fsr.verdict !== 'PASS') return result('PRE-MONEY','FIRST_SALE_GATE_FAIL',p,{firstSaleGate:fsr});
  const ready = p.status === 'published' && p.commercial_truth?.approval_required === false && Number(p.inventory || 0) > 0 && Number(p.price) > 0;
  if (!ready) return result('PRE-MONEY','COMMERCIAL_READINESS_INCOMPLETE',p,{firstSaleGate:fsr});
  return result('SELLABLE','ALL_CANONICAL_CHECKS_PASS',p,{firstSaleGate:fsr});
}
function result(verdict,reason,product,specialist){ return { verdict, reason, product_id: product?.id || null, specialist, evaluated_at:new Date().toISOString(), evidence_hash:hash({verdict,reason,product,specialist}) }; }
module.exports={STATES,resolve};
'@
  $adapterPath = Join-Path $gauntletDir "BrowningVerdictAdapter.js"
  [IO.File]::WriteAllText($adapterPath,$adapter,(New-Object Text.UTF8Encoding($false)))

  $text = [IO.File]::ReadAllText($route)
  if ($text -notmatch "BrowningVerdictAdapter") {
    $import = "const stripeProof = require('../lib/stripeWebhookProof');"
    if ($text -notmatch [regex]::Escape($import)) { throw "Expected stripeProof import anchor not found; no route patch applied." }
    $text = $text.Replace($import,$import + "`r`nconst browning = require('../gauntlet/BrowningVerdictAdapter');")
  }
  if ($text -notmatch "Browning Gauntlet blocked checkout") {
    $pattern = "(?ms)^  const p = checkoutableProduct\(requested\);\r?\n  if \(!p\) return json\(res, 403, \{ error: 'Product is not approved and checkoutable' \}\);"
    $replacement = "  const candidate = product(requested);`r`n  const gate = browning.resolve(candidate);`r`n  if (gate.verdict !== 'SELLABLE') return json(res, 403, { error: 'Browning Gauntlet blocked checkout', verdict: gate.verdict, reason: gate.reason, product_id: gate.product_id });`r`n  const p = checkoutableProduct(requested);`r`n  if (!p) return json(res, 403, { error: 'Product is not approved and checkoutable' });"
    $patched = [regex]::Replace($text,$pattern,$replacement,1)
    if ($patched -eq $text) { throw "Expected createCheckout anchor not found; no route patch applied." }
    $text = $patched
  }
  [IO.File]::WriteAllText($route,$text,(New-Object Text.UTF8Encoding($false)))

  $verify = @'
'use strict';
const assert=require('assert');
const {resolve,STATES}=require('../gauntlet/BrowningVerdictAdapter');
function base(){return {id:'TEST',silo:'mtg',status:'published',inventory:1,price:29,currency:'nzd',checkout:{mode:'payment'},commercial_truth:{approval_required:false,payment_surface:'engine-generated-stripe-checkout',sellable:true}};}
const cases=[];
let p=base(); p.status='draft'; cases.push(['not published',resolve(p).verdict,'PRE-MONEY']);
p=base(); p.commercial_truth.approval_required=true; cases.push(['approval locked',resolve(p).verdict,'PRE-MONEY']);
p=base(); p.inventory=0; cases.push(['no inventory',resolve(p).verdict,'PRE-MONEY']);
p=base(); p.commercial_truth.quarantine=true; cases.push(['quarantine',resolve(p).verdict,'QUARANTINE']);
p=base(); p.description='Amplissa'; cases.push(['silo breach',resolve(p).verdict,'REJECT']);
p=base(); cases.push(['sellable',resolve(p).verdict,'SELLABLE']);
for(const [name,got,want] of cases) assert.strictEqual(got,want,name+': '+got+' != '+want);
console.log(JSON.stringify({status:'PASS',cases,states:STATES},null,2));
'@
  $vp = Join-Path $RepoRoot "BEC-PRIME\scripts\verify-browning-economic-gate.js"
  [IO.File]::WriteAllText($vp,$verify,(New-Object Text.UTF8Encoding($false)))
  $out = & node $vp 2>&1
  $exit = $LASTEXITCODE
  $proof = [ordered]@{type='dreamledger-browning-economic-gate-bootstrap';timestamp=(Get-Date).ToUniversalTime().ToString('o');repo=$RepoRoot;before_sha=$sha;branch=$branch;backup_branch=$backup;working_tree_dirty=([bool]$dirty);dirty_files=$dirty;route_backup=$routeBackup;adapter=$adapterPath;route=$route;verification=$out;verification_exit=$exit;economic_status='RA_000001_UNPROVEN'}
  $proofPath = Join-Path $proofRoot "VERIFICATION-$stamp.json"
  $proof | ConvertTo-Json -Depth 10 | Set-Content -Encoding ASCII $proofPath
  if ($exit -ne 0) { throw "Verification failed. Proof: $proofPath" }
  Write-Host "PASS: Browning economic gate bootstrap installed."
  Write-Host "Repo: $RepoRoot"
  Write-Host "Backup branch: $backup"
  Write-Host "Route backup: $routeBackup"
  Write-Host "Proof: $proofPath"
  Write-Host "Verifier: node BEC-PRIME\scripts\verify-browning-economic-gate.js"
} finally {
  if ($locationPushed) { Pop-Location -ErrorAction SilentlyContinue }
  if ($transcriptStarted) { Stop-Transcript | Out-Null }
}
