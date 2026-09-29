'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'compiled', 'opportunities', 'ECONOMIC_GAUNTLET.json');
const APPROVED = path.join(ROOT, 'catalog', 'offers', 'approved.json');
const OUT_DIR = path.join(ROOT, 'data', '777');
const OUT = path.join(OUT_DIR, '777-LATEST.json');

const sha = v => crypto.createHash('sha256').update(v, 'utf8').digest('hex');

const LENSES = [
  'BUYER','PROBLEM','OFFER','CHANNEL','PRICE','FULFILLMENT','PROOF'
];

const TRANSFORMS = [
  'NARROW','BUNDLE','SPLIT','REPEAT','MONITOR','VERIFY','BROKER'
];

const GATES = [
  'DEMAND','CAPABILITY','ZERO_COST','FULFILLMENT','PAYMENT','REPEAT','CONTRADICTION'
];

function loadJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function candidates() {
  const source = loadJson(SOURCE, { results: [] });
  const approved = loadJson(APPROVED, { approved: [] });
  const base = [
    ...(Array.isArray(source.results) ? source.results.filter(x => x && x.verdict === 'PASS') : []),
    ...(Array.isArray(approved.approved) ? approved.approved.map(x => ({
      opportunity_id: 'APPROVED-OFFER:' + (x.offer_id || x.product_sku || 'UNKNOWN'),
      title: x.name || x.product_sku,
      buyer: x.target_buyer || null,
      offer: x.deliverable || x.name || null,
      price_nzd: Number(x.price || 0),
      channels: [x.acquisition_surface || 'configured'],
      hypothesis: x.problem || null,
      source_type: 'APPROVED_OFFER'
    })) : [])
  ];
  return base;
}

function build() {
  const base = candidates();
  const top = base.slice(0, 49);
  const rows = [];
  let sequence = 0;

  for (const seed of top) {
    for (const lens of LENSES) {
      for (const transform of TRANSFORMS) {
        const gate = GATES[sequence % GATES.length];
        sequence += 1;

        const candidate = {
          candidate_id: '777-' + sha(JSON.stringify({
            seed: seed.opportunity_id,
            lens, transform, gate
          })).slice(0, 20).toUpperCase(),
          seed_opportunity_id: seed.opportunity_id || null,
          seed_title: seed.title || null,
          search_mode: '777_HYPOTHESIS_GENERATION',
          lens,
          transform,
          gate,
          hypothesis: {
            buyer: seed.buyer || null,
            problem: seed.hypothesis || null,
            offer: seed.offer || null,
            price_nzd: Number(seed.price_nzd || 0),
            channels: Array.isArray(seed.channels) ? seed.channels : [],
            transformation: transform
          },
          evidence_boundary: {
            source_seed_only: true,
            buyer_invented: false,
            payment_invented: false,
            revenue_claim: false,
            fulfillment_claim: false
          },
          status: 'HYPOTHESIS_UNVERIFIED',
          next_test: gate,
          external_action: 'APPROVAL_REQUIRED'
        };

        candidate.integrity_sha256 = sha(JSON.stringify(candidate));
        rows.push(candidate);
      }
    }
  }

  rows.sort((a,b) => {
    const av = Number(a.hypothesis.price_nzd || 0);
    const bv = Number(b.hypothesis.price_nzd || 0);
    return bv - av;
  });

  const out = {
    schema_version: 'DREAMLEDGER/777/v1',
    generated_at_utc: new Date().toISOString(),
    objective: 'continuously search combinations of already-observed economic primitives without inventing buyers, payments, fulfillment, evidence, or revenue',
    search_space: {
      lenses: LENSES,
      transforms: TRANSFORMS,
      gates: GATES,
      theoretical_modes_per_seed: LENSES.length * TRANSFORMS.length * GATES.length
    },
    seed_count: top.length,
    candidate_count: rows.length,
    candidates: rows.slice(0, 777),
    truth: {
      verified_external_revenue_nzd: 0,
      settled_external_payments: 0,
      independent_external_buyers: 0,
      verified_economic_outcomes: 0,
      status: 'UNCHANGED'
    }
  };

  out.integrity_sha256 = sha(JSON.stringify(out));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');

  return out;
}

if (require.main === module) {
  const r = build();
  console.log(JSON.stringify({
    status: 'PASS',
    mode: r.schema_version,
    seed_count: r.seed_count,
    candidate_count: r.candidate_count,
    truth: r.truth,
    output: OUT
  }, null, 2));
}

module.exports = { build, LENSES, TRANSFORMS, GATES };
