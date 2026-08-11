'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'PROOF-2026-08-11-MONETIZATION-WEDGE-PORTFOLIO.json');
const OUT_DIR = path.join(ROOT, 'compiled', 'website', 'portfolio');
const CATALOG_DIR = path.join(ROOT, 'catalog', 'compiled');
const CATALOG = path.join(CATALOG_DIR, 'silo-portfolio.json');
const PROOF = path.join(ROOT, 'PROOF-SILO-PORTFOLIO-COMPILATION.json');

function must(file) {
  if (!fs.existsSync(file)) throw new Error(`Silo portfolio input missing: ${path.relative(ROOT, file)}`);
}
function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]));
}
function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}
function digest(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}
function readJson(file) {
  must(file);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const source = readJson(SOURCE);
const wedges = Array.isArray(source.ranked_wedges) ? source.ranked_wedges : [];
if (!wedges.length) throw new Error('No monetization wedges found. Refusing to compile an empty sales surface.');

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(CATALOG_DIR, { recursive: true });

const compiled = wedges.map((wedge, index) => {
  const id = `WEDGE-${String(wedge.rank || index + 1).padStart(2, '0')}-${slug(wedge.name).toUpperCase()}`;
  const route = `/portfolio/${slug(wedge.name)}.html`;
  return {
    id,
    rank: Number(wedge.rank || index + 1),
    name: wedge.name,
    priority: wedge.priority || 'P2',
    buyer: wedge.buyer || 'Qualified operator',
    monetization: wedge.monetization || 'Quote after discovery',
    wedge: wedge.wedge || '',
    route,
    activation_state: 'APPROVAL_GATED',
    checkout_available: false,
    payment_claimed: false,
    source: 'BEC-PRIME/PROOF-2026-08-11-MONETIZATION-WEDGE-PORTFOLIO.json',
    cta: { label: 'Request this wedge', action: 'proposal_only', target: route },
    tunnel: { entry: route, next: 'proposal', then: 'human_review', then_after_approval: 'canonical_offer' },
    sku_family: ['SERVICE_PAGE','DIAGNOSTIC','IMPLEMENTATION','RECURRING_OPERATION','BILLBOARD']
  };
});

const activationPolicy = {
  approval_required: true,
  checkout_available: false,
  private_ip_doctrine_exposed: false,
  public_ip_doctrine_exposed: false,
  private_material_excluded: true,
  payment_claims_allowed: false,
  external_actions_allowed: false
};

const catalog = {
  schema: 'BEC-PRIME/SILO-PORTFOLIO/v1',
  status: 'COMPILED',
  compiler: 'SiloPortfolioCompiler',
  compiled_at: new Date().toISOString(),
  source_hash: digest(fs.readFileSync(SOURCE, 'utf8')),
  activation_policy: activationPolicy,
  wedge_count: compiled.length,
  wedges: compiled
};
fs.writeFileSync(CATALOG, JSON.stringify(catalog, null, 2) + '\n', 'utf8');

function page(wedge) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="index,follow"><title>${esc(wedge.name)} | DreamLedger</title><style>body{margin:0;background:#090a0d;color:#f4f1eb;font:16px/1.55 system-ui}.wrap{max-width:900px;margin:auto;padding:28px 20px 60px}p{color:#a8adb8}.panel{border:1px solid #303541;background:#151820;border-radius:18px;padding:22px;margin:18px 0}.cta{display:inline-block;padding:13px 18px;border-radius:11px;background:#d8b66b;color:#111;text-decoration:none;font-weight:900}</style></head><body><main class="wrap"><a href="/portfolio/">Back to portfolio</a><h1>${esc(wedge.name)}</h1><p>${esc(wedge.wedge)}</p><div class="panel"><strong>Buyer</strong><p>${esc(wedge.buyer)}</p><strong>Monetization</strong><p>${esc(wedge.monetization)}</p></div><div class="panel"><strong>Compiled tunnel</strong><p>CTA -> proposal -> human review -> canonical offer. No checkout is implied by this page.</p><a class="cta" href="mailto:hello@dreamledger.org?subject=${encodeURIComponent('DreamLedger: '+wedge.name)}">Request this wedge</a></div></main></body></html>`;
}
for (const wedge of compiled) fs.writeFileSync(path.join(OUT_DIR, `${slug(wedge.name)}.html`), page(wedge), 'utf8');

const indexCards = compiled.map(wedge => `<article><small>#${wedge.rank} / ${esc(wedge.priority)}</small><h2>${esc(wedge.name)}</h2><p>${esc(wedge.wedge)}</p><a href="${wedge.route}">Open service tunnel</a></article>`).join('\n');
const index = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DreamLedger | Monetization Portfolio</title></head><body><main><h1>More doors. One compiler.</h1><p>${compiled.length} monetization wedges compiled from the canonical portfolio. Activation remains approval-gated.</p>${indexCards}<hr><p>Activation remains approval-gated. No sale, checkout unlock, private IP exposure, or external action is implied.</p></main></body></html>`;
fs.writeFileSync(path.join(OUT_DIR, 'index.html'), index, 'utf8');

const proof = {
  schema: 'BEC-PRIME/SILO-PORTFOLIO-COMPILATION/v1',
  status: 'PASS',
  compiled_at: catalog.compiled_at,
  source_hash: catalog.source_hash,
  wedge_count: compiled.length,
  generated: { catalog: path.relative(ROOT, CATALOG), index: path.relative(ROOT, path.join(OUT_DIR, 'index.html')), service_pages: compiled.map(w => path.relative(ROOT, path.join(OUT_DIR, `${slug(w.name)}.html`))) },
  guarantees: { approval_required: true, checkout_available: false, payment_claimed: false, private_ip_exposed: false, private_ip_doctrine_exposed: false, silo_isolation_required: true, external_actions_allowed: false }
};
fs.writeFileSync(PROOF, JSON.stringify(proof, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(proof, null, 2));
