'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { trendScore, rankOffers } = require('../trends/TrendFlywheel');

const ROOT = path.join(__dirname, '..');
const APPROVED = path.join(ROOT, 'catalog', 'offers', 'approved.json');
const OUT_DIR = path.join(ROOT, 'compiled', 'website', 'portfolio');
const CATALOG_DIR = path.join(ROOT, 'catalog', 'compiled');
const CATALOG = path.join(CATALOG_DIR, 'silo-portfolio.json');
const PROOF = path.join(ROOT, 'PROOF-SILO-PORTFOLIO-COMPILATION.json');
const SILO_REGISTRY = path.join(ROOT, 'catalog', 'silos', 'CUBE-SILO-REGISTRY.json');
const CAROUSEL_OUT = path.join(ROOT, '..', 'public', 'portfolio', 'carousel-manifest.json');
const PUBLIC_PORTFOLIO_INDEX = path.join(ROOT, '..', 'public', 'portfolio', 'index.html');
const DEMAND_RADAR = path.join(ROOT, '..', 'ops', 'demand', 'latest.json');

function must(file) {
  if (!fs.existsSync(file)) throw new Error(`Portfolio compiler input missing: ${path.relative(ROOT, file)}`);
}

function readJson(file) {
  must(file);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>\"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;'
  }[c]));
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function digest(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

const source = readJson(APPROVED);
const offers = Array.isArray(source.approved) ? source.approved : [];

function demandEvidenceForOffer(offer, radar) {
  if (!radar || !Array.isArray(radar.active)) return null;
  const target = slug(offer.name);
  const hit = radar.active.find(x => slug(x.slug || x.name || '') === target);
  if (!hit) return null;

  const signals = Array.isArray(hit.signals) ? hit.signals : [];
  const total = signals.reduce((sum, s) => sum + Math.max(0, Number(s.count) || 0), 0);
  const sources = new Set(signals.map(s => String(s.source || '').trim()).filter(Boolean));
  const maxComparable = Math.max(
    1,
    ...radar.active.map(x => (Array.isArray(x.signals) ? x.signals : [])
      .reduce((sum, s) => sum + Math.max(0, Number(s.count) || 0), 0))
  );

  return {
    demand_signal_volume: Number((Math.log1p(total) / Math.log1p(maxComparable)).toFixed(4)),
    signal_count: signals.length,
    source_count: sources.size,
    observed_score: Number(hit.score) || null,
    observed_at: radar.generated_at || null,
    provenance: 'ops/demand/latest.json'
  };
}

const demandRadar = fs.existsSync(DEMAND_RADAR) ? readJson(DEMAND_RADAR) : null;
if (!offers.length) throw new Error('No explicitly approved offers found. Refusing to publish an empty commercial portfolio.');

const eligible = offers.filter(o =>
  o &&
  o.approved_by === 'operator' &&
  o.payment_link_status === 'ACTIVE_LIVEMODE' &&
  typeof o.payment_link_url === 'string' &&
  o.payment_link_url.startsWith('https://buy.stripe.com/') &&
  typeof o.price === 'number' &&
  o.price > 0 &&
  o.currency === 'NZD'
);

if (!eligible.length) {
  throw new Error('No approved livemode Stripe offers available. Refusing to publish a non-purchasable portfolio.');
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(CATALOG_DIR, { recursive: true });

const compiled = eligible.map((offer, index) => {
  const demandEvidence = demandEvidenceForOffer(offer, demandRadar);
  const trendInput = {
    ...(offer.trend || {}),
    ...(demandEvidence ? {
      demand_signal_volume: demandEvidence.demand_signal_volume,
      age_days: demandEvidence.observed_at
        ? Math.max(0, (Date.now() - Date.parse(demandEvidence.observed_at)) / 86400000)
        : undefined
    } : {})
  };

  return {
  portfolio_id: `PORTFOLIO-${String(index + 1).padStart(3, '0')}`,
  offer_id: offer.offer_id,
  product_id: offer.product_id || null,
  sku: offer.product_sku || null,
  silo: offer.silo,
  name: offer.name,
  problem: offer.problem,
  buyer: offer.target_buyer,
  input: offer.input,
  output: offer.output,
  deliverable: offer.deliverable,
  price: offer.price,
  currency: offer.currency,
  canonical_url: `/portfolio/${slug(offer.name)}.html`,
  checkout_url: offer.payment_link_url,
  checkout: 'STRIPE_LIVEMODE',
  fulfillment_route: offer.fulfillment_route,
  proof_of_delivery: offer.proof_of_delivery,
  activation_state: 'ACTIVE_CHECKOUT',
  trend: trendScore(trendInput),
  signal_evidence: demandEvidence,
  source: 'BEC-PRIME/catalog/offers/approved.json'
  };
});

const catalog = {
  schema: 'BEC-PRIME/SLEEPING-COMMERCE-PORTFOLIO/v1',
  status: 'COMPILED',
  compiler: 'SiloPortfolioCompiler',
  compiled_at: new Date().toISOString(),
  source_hash: digest(fs.readFileSync(APPROVED, 'utf8')),
  activation_policy: {
    source_of_truth: 'catalog/offers/approved.json',
    approval_required_for_activation: true,
    only_operator_approved_offers: true,
    only_active_livemode_stripe_links: true,
    payment_claims_allowed: false,
    external_actions_allowed: false,
    private_material_excluded: true
  },
  offer_count: compiled.length,
  offers: compiled
};

fs.writeFileSync(CATALOG, JSON.stringify(catalog, null, 2) + '\n', 'utf8');

const registry = readJson(SILO_REGISTRY);
const silos = Array.isArray(registry.silos) ? registry.silos : [];
const bySilo = new Map();
for (const silo of silos) bySilo.set(silo.id, []);
for (const offer of compiled) {
  if (!bySilo.has(offer.silo)) bySilo.set(offer.silo, []);
  bySilo.get(offer.silo).push(offer);
}

const carouselManifest = {
  schema: 'BEC-PRIME/SILO-CAROUSEL-MANIFEST/v1',
  status: 'COMPILED',
  compiler: 'SiloPortfolioCompiler',
  trend_engine: 'BEC-PRIME/trends/TrendFlywheel.js',
  compiled_at: catalog.compiled_at,
  source_hash: catalog.source_hash,
  rules: {
    approved_offers_only: true,
    unknown_is_not_zero: true,
    stale_evidence_decays: true,
    trend_changes_do_not_create_revenue: true,
    no_new_external_action: true
  },
  silos: silos.map(silo => {
    const offersForSilo = rankOffers(bySilo.get(silo.id) || []);
    return {
      silo_id: silo.id,
      route: silo.route,
      status: silo.status,
      offer_count: offersForSilo.length,
      carousel: offersForSilo.map((offer, position) => ({
        position: position + 1,
        offer_id: offer.offer_id,
        name: offer.name,
        canonical_url: offer.canonical_url,
        price: offer.price,
        currency: offer.currency,
        trend_state: offer.trend.trend_state,
        trend_score: offer.trend.trend_score,
        confidence: offer.trend.confidence,
        momentum: offer.trend.momentum,
        crowding: offer.trend.crowding,
        freshness: offer.trend.freshness,
        recommended_action: offer.trend.recommended_action
      }))
    };
  })
};

fs.mkdirSync(path.dirname(CAROUSEL_OUT), { recursive: true });
fs.writeFileSync(CAROUSEL_OUT, JSON.stringify(carouselManifest, null, 2) + '\n', 'utf8');

const publicCards = rankOffers(compiled).map(offer => `
<article class="card">
<div class="eyebrow">${esc(offer.silo)} · ${esc(offer.trend.trend_state)}</div>
<h2>${esc(offer.name)}</h2>
<p>${esc(offer.problem)}</p>
<div class="price">${esc(offer.currency)} ${Number(offer.price).toFixed(2)}</div>
<p><span class="state">${esc(offer.trend.recommended_action)}</span></p>
<a class="buy" href="${esc(offer.canonical_url)}">View offer</a>
</article>`).join('\\n');

const publicIndex = `<!doctype html>
<html lang="en-NZ"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="index,follow"><link rel="canonical" href="https://dreamledger.org/portfolio/">
<title>DreamLedger Commercial Portfolio</title>
<meta name="description" content="Current DreamLedger commercial inventory ranked by the trend-aware portfolio compiler.">
<style>
body{margin:0;background:#080a0d;color:#f5f3eb;font:16px/1.55 system-ui}.wrap{max-width:1100px;margin:auto;padding:32px 20px 70px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:16px}.card{border:1px solid #303541;background:#151820;border-radius:18px;padding:22px}
.eyebrow{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#a8adb8}.price{font-size:28px;font-weight:900}.state{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#d8b66b}
a{color:#d8b56b}.buy{display:inline-block;padding:12px 18px;border-radius:10px;background:#d8b66b;color:#111;text-decoration:none;font-weight:900}
</style></head><body><main class="wrap"><p class="eyebrow">ONE COMMERCE SUBSTRATE · TREND-AWARE INVENTORY</p>
<h1>DreamLedger Commercial Portfolio</h1>
<p>Approved, live-checkout offers ranked by the existing trend flywheel. Unknown market evidence remains unknown. Trend state does not imply revenue.</p>
<section class="grid">${publicCards}</section>
<p style="color:#a8adb8">Settlement, fulfillment and economic verification remain governed by the existing commerce and Truth machinery.</p>
</main></body></html>`;

fs.writeFileSync(PUBLIC_PORTFOLIO_INDEX, publicIndex, 'utf8');


function page(offer) {
  const title = esc(offer.name);
  const price = `${esc(offer.currency)} ${Number(offer.price).toFixed(2)}`;
  const checkout = esc(offer.checkout_url);

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: offer.name,
    description: offer.problem,
    brand: { '@type': 'Brand', name: 'DreamLedger' },
    offers: {
      '@type': 'Offer',
      priceCurrency: offer.currency,
      price: offer.price,
      availability: 'https://schema.org/InStock',
      url: offer.checkout_url
    }
  }).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="index,follow">
<link rel="canonical" href="/portfolio/${slug(offer.name)}.html">
<title>${title} | DreamLedger</title>
<meta name="description" content="${esc(offer.problem)}">
<script type="application/ld+json">${jsonLd}</script>
<style>
body{margin:0;background:#090a0d;color:#f4f1eb;font:16px/1.55 system-ui}
.wrap{max-width:900px;margin:auto;padding:32px 20px 70px}
a{color:#d8b66b}.panel{border:1px solid #303541;background:#151820;border-radius:18px;padding:22px;margin:18px 0}
.eyebrow{letter-spacing:.12em;text-transform:uppercase;font-size:12px;color:#a8adb8}
h1{font-size:42px;line-height:1.05;margin:.3em 0}.muted{color:#a8adb8}
.price{font-size:30px;font-weight:900;margin:12px 0}
.buy{display:inline-block;padding:15px 22px;border-radius:11px;background:#d8b66b;color:#111;text-decoration:none;font-weight:900}
ul{padding-left:22px}
</style>
</head>
<body>
<main class="wrap">
<p class="eyebrow">DreamLedger commercial portfolio</p>
<h1>${title}</h1>
<p class="muted">${esc(offer.problem)}</p>
<div class="panel">
<div class="eyebrow">Price</div>
<div class="price">${price}</div>
<p>${esc(offer.output)}</p>
<a class="buy" href="${checkout}">Buy now</a>
</div>
<div class="panel">
<div class="eyebrow">What you provide</div>
<p>${esc(offer.input)}</p>
<div class="eyebrow">What you receive</div>
<p>${esc(offer.deliverable)}</p>
</div>
<div class="panel">
<div class="eyebrow">Delivery</div>
<p>Payment is processed through Stripe. Fulfillment follows the configured route. DreamLedger does not claim a completed transaction until payment and fulfillment evidence exist.</p>
</div>
<p><a href="/portfolio/">Back to DreamLedger portfolio</a></p>
</main>
</body>
</html>`;
}

for (const offer of compiled) {
  fs.writeFileSync(path.join(OUT_DIR, `${slug(offer.name)}.html`), page(offer), 'utf8');
}

const cards = compiled.map(offer => `
<article class="card">
<div class="eyebrow">${esc(offer.silo)} · ${esc(offer.sku || offer.product_id || '')}</div>
<h2>${esc(offer.name)}</h2>
<p>${esc(offer.problem)}</p>
<strong>${esc(offer.currency)} ${Number(offer.price).toFixed(2)}</strong>
<p><a class="buy" href="${esc(offer.canonical_url)}">View offer</a></p>
</article>`).join('\n');

const index = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="index,follow">
<link rel="canonical" href="/portfolio/">
<title>DreamLedger Commercial Portfolio</title>
<meta name="description" content="Decision products and commercial services compiled from explicitly approved DreamLedger offers.">
<style>
body{margin:0;background:#090a0d;color:#f4f1eb;font:16px/1.55 system-ui}
.wrap{max-width:1100px;margin:auto;padding:32px 20px 70px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px}
.card{border:1px solid #303541;background:#151820;border-radius:18px;padding:22px}
.eyebrow{letter-spacing:.12em;text-transform:uppercase;font-size:12px;color:#a8adb8}
a{color:#d8b66b}.buy{display:inline-block;padding:10px 15px;border-radius:10px;background:#d8b66b;color:#111;text-decoration:none;font-weight:900}
h1{font-size:44px;line-height:1.05}
</style>
</head>
<body>
<main class="wrap">
<p class="eyebrow">ONE COMMERCE SUBSTRATE · MULTIPLE OFFERS</p>
<h1>DreamLedger Commercial Portfolio</h1>
<p>Live commercial offers compiled from the existing approved-offer catalog. Each offer resolves to its canonical page and existing Stripe livemode checkout.</p>
<div class="grid">${cards}</div>
<p class="eyebrow">The portfolio compiler does not create economic claims. Settlement, fulfillment and verification remain governed by the existing commerce and evidence machinery.</p>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(OUT_DIR, 'index.html'), index, 'utf8');

const proof = {
  schema: 'BEC-PRIME/SLEEPING-COMMERCE-PORTFOLIO/v1',
  status: 'PASS',
  compiled_at: catalog.compiled_at,
  source_hash: catalog.source_hash,
  offer_count: compiled.length,
  offers: compiled.map(o => ({
    offer_id: o.offer_id,
    name: o.name,
    price: o.price,
    currency: o.currency,
    canonical_url: o.canonical_url,
    checkout: o.checkout,
    activation_state: o.activation_state,
    trend_state: o.trend.trend_state,
    trend_score: o.trend.trend_score,
    recommended_action: o.trend.recommended_action,
    signal_evidence: o.signal_evidence
  })),
  guarantees: {
    existing_approval_gate_reused: true,
    existing_stripe_rail_reused: true,
    existing_fulfillment_routes_reused: true,
    new_ledger_created: false,
    new_payment_rail_created: false,
    fake_revenue_claimed: false,
    private_ip_exposed: false
  }
};

fs.writeFileSync(PROOF, JSON.stringify(proof, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(proof, null, 2));
