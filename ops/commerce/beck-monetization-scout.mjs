#!/usr/bin/env node
'use strict';

// Read-only asset traversal. Scores monetization readiness, not demand or revenue.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root = process.cwd();
const readJson = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const exists = p => fs.existsSync(path.join(root, p));
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const blockers = [];
const candidates = [];
const addBlocker = (offer, code, detail) => blockers.push({offer, code, detail});
const approvedDoc = readJson('BEC-PRIME/catalog/offers/approved.json');
const feed = readJson('public/agent-products.json');
const commerce = readJson('public/agent-commerce.json');
const aiCatalog = readJson('public/ai-catalog.json');
const approved = Array.isArray(approvedDoc.approved) ? approvedDoc.approved : [];
const feedBySku = new Map(feed.map(x => [String(x.sku || x.item_id || ''), x]));
const primaryById = new Map((commerce.primary_offers || []).map(x => [String(x.product_id || ''), x]));

function scoreCandidate(o) {
  const id = String(o.item_id || o.product_id || o.product_sku || o.sku || o.offer_id || 'unknown');
  const title = String(o.title || o.name || id);
  const priceRaw = o.price_nzd ?? o.price ?? (String(o.price || '').match(/[0-9]+(?:\.[0-9]+)?/) || [])[0];
  const price = Number(priceRaw);
  const url = String(o.checkout_url || o.payment_link_url || '');
  const availability = String(o.availability || o.status || o.payment_link_status || 'unknown').toLowerCase();
  const fulfillment = String(o.fulfillment_mode || o.fulfillment || o.delivery_mechanism || o.fulfillment_route || 'unknown').toLowerCase();
  const blockersForOffer = [];
  let score = 0;
  if (Number.isFinite(price) && price > 0) score += 8;
  if (/^https:\/\/buy\.stripe\.com\//i.test(url)) score += 15;
  if (availability.includes('listed') || availability.includes('active_livemode')) score += 12;
  if (o.enable_checkout === true) score += 10;
  if (/manual/.test(fulfillment)) score += 15; // Can be fulfilled without the unhealthy database, if intake is accessible.
  if (/supabase|database|webhook/.test(fulfillment)) { score -= 12; blockersForOffer.push('fulfillment has a database/webhook dependency that needs live verification'); }
  if (/review_required|held|unverified|mismatch|withdrawn/.test(availability)) { score -= 20; blockersForOffer.push('offer state is held, review-required, or unverified'); }
  if (o.human_authorization_required === true) score += 3;
  if (o.required_input || o.input) score += 5;
  if (o.proof_of_delivery || o.output || o.description) score += 5;
  if (id.includes('DREAMLEDGER-BILLBOARD-FOUNDING-001')) score += 8; // operator-selected first-dollar candidate with an existing NZ$50 Stripe link.
  if (id.includes('TOLL-PROBE')) score -= 8; // useful infrastructure test, not strongest first-dollar service.
  if (id.includes('QUOTE-COMPARE')) score -= 8; // catalog explicitly disables checkout.
  if (id.includes('COMMANDER') || id.includes('CMD-DIAG')) score -= 5; // known contract mismatch remains unresolved.
  return { id, title, price_nzd: Number.isFinite(price) ? price : null, checkout_url: url || null, availability, fulfillment, score, blockers: blockersForOffer };
}

const merged = new Map();
for (const o of feed) merged.set(String(o.sku || o.item_id), {...o});
for (const o of approved) {
  const k = String(o.product_sku || o.offer_id);
  const old = merged.get(k) || {};
  merged.set(k, {...old, ...o});
}
for (const o of (commerce.primary_offers || [])) {
  const k = String(o.product_id || o.name);
  const old = merged.get(k) || {};
  merged.set(k, {...old, ...o});
}
for (const o of merged.values()) candidates.push(scoreCandidate(o));

const billboardId = 'DREAMLEDGER-BILLBOARD-FOUNDING-001';
const billboardFeed = feed.find(x => x.item_id === billboardId);
const billboardPrimary = primaryById.get(billboardId);
const billboardHeld = (commerce.held_offers || []).some(x => x.product_id === billboardId && x.status === 'REVIEW_REQUIRED');
const billboardPriority = aiCatalog.priority_offer?.id === billboardId && aiCatalog.priority_offer?.availability === 'review_required';
if (!billboardFeed || billboardFeed.price !== '50 NZD' || billboardFeed.url !== 'https://dreamledger.org/billboard.html' || billboardFeed.enable_checkout !== false || billboardFeed.availability !== 'review_required' || !billboardPrimary || !billboardHeld || !billboardPriority) {
  addBlocker(billboardId,'BILLBOARD_CATALOG_DRIFT','The selected NZ$50 Billboard offer must agree across the product feed, AI priority, commerce listing and held-offer register. Keep checkout held until fulfillment is proven.');
}
const truthOracleFeed = feed.find(x => x.item_id === 'TRUTH-ORACLE-ACCESS-001');
const retiredStandaloneInFeed = feed.some(x => x.item_id === 'AGENT-PROOF-AUDIT-49') ||
  (commerce.primary_offers || []).some(x => x.product_id === 'AGENT-PROOF-AUDIT-49') ||
  aiCatalog.priority_offer?.id === 'AGENT-PROOF-AUDIT-49';
if (retiredStandaloneInFeed) {
  addBlocker('TRUTH-ORACLE-ACCESS-001','RETIRED_OFFER_REAPPEARED',
    'The retired standalone audit SKU has reappeared in the public product feed. Keep its payment link and price inactive.');
}
if (truthOracleFeed) {
  const heldInCommerce = (commerce.held_offers || []).some(x => x.product_id === 'TRUTH-ORACLE-ACCESS-001' && x.status === 'REVIEW_REQUIRED');
  const truthPriority = aiCatalog.priority_offer?.id === 'TRUTH-ORACLE-ACCESS-001' && aiCatalog.priority_offer?.availability === 'review_required';
  if (!heldInCommerce || !truthPriority) {
    addBlocker('TRUTH-ORACLE-ACCESS-001','TRUTH_ORACLE_CATALOG_DRIFT',
      'Truth Oracle Access must be held consistently in product, commerce, and AI discovery feeds until paid fulfillment is verified.');
  }
  const truthPagePath = 'public/truth-oracle.html';
  const redirectPath = exists('public/agent-delivery-proof-audit.html') ? 'public/agent-delivery-proof-audit.html' : 'agent-delivery-proof-audit.html';
  const truthText = exists(truthPagePath) ? fs.readFileSync(path.join(root, truthPagePath), 'utf8') : '';
  const redirectText = exists(redirectPath) ? fs.readFileSync(path.join(root, redirectPath), 'utf8') : '';
  const publicCheckout = truthOracleFeed.enable_checkout === true || /buy\.stripe\.com/i.test(truthText);
  const redirectCorrect = /truth-oracle\.html/i.test(redirectText) && !/buy\.stripe\.com|NZ\$49|Purchase the audit/i.test(redirectText);
  if (publicCheckout) {
    addBlocker('TRUTH-ORACLE-ACCESS-001','CHECKOUT_ENABLED_BEFORE_FULFILLMENT_PROOF',
      'Truth Oracle paid checkout must remain held until entitlement, evidence persistence, and delivery proof pass end to end.');
  }
  if (!redirectCorrect) {
    addBlocker('TRUTH-ORACLE-ACCESS-001','LEGACY_ROUTE_NOT_REDIRECTED',
      'The retired standalone route must redirect to Truth Oracle and contain no checkout or old offer copy.');
  }
}
const commanderDefPath = 'ops/cube-swarm/silo-definitions/mtg-commander.json';
if (exists(commanderDefPath)) {
  const d = readJson(commanderDefPath);
  if (d.commercial_contract?.checkout_status !== 'VERIFIED') {
    addBlocker('COMMANDER-DECK-DIAGNOSTIC-001','CHECKOUT_CONTRACT_UNVERIFIED',
      'Silo definition still marks checkout_status=' + String(d.commercial_contract?.checkout_status) + ' and provisioning is fail-closed.');
  }
}
const quote = feed.find(x => x.sku === 'QUOTE-COMPARE-49');
if (quote && quote.enable_checkout === false) {
  addBlocker('QUOTE-COMPARE-49','PAID_CHECKOUT_DISABLED',
    'Public product feed disables paid checkout and marks review required; keep the free worksheet as the entry point.');
}
if (aiCatalog.priority_offer?.id === 'TRUTH-ORACLE-ACCESS-001' && !truthOracleFeed) {
  addBlocker('TRUTH-ORACLE-ACCESS-001','FEED_MISMATCH','AI catalogue names Truth Oracle Access as priority, but the product feed does not contain it.');
}

// Traverse the existing monetizable substrate without executing it.
// This inventory is based on repository artifacts only; presence is not live readiness.
const substrateSpecs = [
  {id:'TRUTH-ORACLE-ACCESS-001',name:'Truth Oracle Access',price_nzd:9,files:['public/agent-products.json','public/truth-oracle.html','truth-oracle.html','ops/commerce/reconcile-truth-oracle-access.mjs'],fulfillment:'digital access to bounded evidence-review workflow',database_dependent:true,reason:'The former standalone audit capability is absorbed into the free Truth Oracle. The selected paid candidate is the NZ$50 Founding Billboard.'},
  {id:'QUOTE-COMPARE-49',name:'Supplier Quote Comparison',price_nzd:49,files:['public/quote-intake.html','supabase/functions/quote-intake/index.ts','supabase/functions/quote-fulfillment/index.ts','BEC-PRIME/data/777/QUOTE-COMPARE-49-LIVE-FULFILLMENT-MAP.json'],fulfillment:'automated quote intake and report generation',database_dependent:true,reason:'Strong repeatable B2B problem with existing intake and fulfillment code, but paid checkout is explicitly held and depends on healthy Supabase persistence.'},
  {id:'COMMANDER-DECK-DIAGNOSTIC-001',name:'Commander Deck Diagnostic',price_nzd:29,files:['public/diagnostic-input.html','BEC-PRIME/routes/mtgDiagnostic.js','BEC-PRIME/lib/mtgDiagnosticFulfillment.js','ops/cube-swarm/silo-definitions/mtg-commander.json'],fulfillment:'automated diagnostic report',database_dependent:true,reason:'Existing report capability and low price, but the silo definition records checkout mismatch/unverified state; do not acquire buyers until the canonical route is reconciled.'},
  {id:'SELLER-PROFIT-AUDIT-001',name:'Seller Profit Audit',price_nzd:29,files:['public/agent-commerce.json','BEC-PRIME/fulfillment/PRODUCT-FULFILLMENT-REGISTRY.json','BEC-PRIME/catalog/offers/approved.json'],fulfillment:'audit/calculation service',database_dependent:null,reason:'Existing listed offer and potentially bounded fulfillment; trace its exact live intake and delivery route before ranking it above the selected Billboard path.'},
  {id:'DREAMLEDGER-BILLBOARD-FOUNDING-001',name:'Founding Billboard',price_nzd:50,files:['BEC-PRIME/lib/billboardAutoFulfillment.js','public/agent-products.json','public/agent-commerce.json','BEC-PRIME/catalog/offers/approved.json'],fulfillment:'paid inventory allocation and publication',database_dependent:true,reason:'Operator-selected first-dollar candidate because the exact NZ$50 Stripe path exists; public checkout remains held until signed-webhook allocation and publication are proven.'},
  {id:'AGENT-TOLL-ROAD',name:'Agent Toll Road / Toll Probe',price_nzd:0.5,files:['supabase/functions/agent-toll-road/index.ts','BEC-PRIME/runtime/TollRoad.js','BEC-PRIME/runtime/TollRoadFactory.js','public/api/agent-commerce/toll-probe.json'],fulfillment:'machine capability with attributable receipt',database_dependent:true,reason:'Useful substrate and a low-cost machine-payment experiment, but weak first-dollar yield and durable entitlement dependency make it secondary.'},
  {id:'TRUTH-ORACLE',name:'Truth Oracle Evidence Verification',price_nzd:null,files:['public/truth-oracle.html','BEC-PRIME/routes/truthOracleCommerce.js','supabase/functions/truth-oracle-public/index.ts','supabase/functions/truth-oracle-fuel-ingest-v2/index.ts'],fulfillment:'structured evidence verification',database_dependent:true,reason:'Potential reusable B2B/agent capability, but complete paid analysis-to-delivery and current pricing are not yet proven.'},
  {id:'BECK-WINDOWS-RECOVERY-KIT',name:'Windows Automation Recovery Kit',price_nzd:null,files:['scripts/beck-daily-bootstrap.ps1','scripts/beck-daily-bootstrap.sh','BEC-PRIME/scripts/Bootstrap-LMStudioCouncil.ps1','BEC-PRIME/scripts/Verify-LMStudioThreeRoleReadiness.ps1','docs/BECK-FIRST-DOLLAR-RUNBOOK.md'],fulfillment:'generalized recovery/verifier package',database_dependent:false,reason:'Reusable existing tooling can be packaged as a bounded paid kit, but no canonical public offer/checkout was established by this inventory; package only after the existing first-dollar route is tested.'}
];
const substrateInventory = substrateSpecs.map(s => {
  const present = s.files.filter(exists);
  const missing = s.files.filter(p => !exists(p));
  const readiness = s.id === 'TRUTH-ORACLE-ACCESS-001'
    ? (blockers.some(b => b.offer === s.id) ? 'BLOCKED_TRUTH_ORACLE_FULFILLMENT' : 'HELD_CHECKOUT_PENDING_PROOF')
    : s.id === 'QUOTE-COMPARE-49'
      ? 'HELD_CHECKOUT_SUPABASE_DEPENDENCY'
      : s.id === 'COMMANDER-DECK-DIAGNOSTIC-001'
        ? 'BLOCKED_CHECKOUT_CONTRACT'
        : s.id === 'DREAMLEDGER-BILLBOARD-FOUNDING-001'
          ? 'HELD_INVENTORY_FULFILLMENT'
          : s.id === 'AGENT-TOLL-ROAD'
            ? 'SECONDARY_LOW_TICKET_EXPERIMENT'
            : s.id === 'TRUTH-ORACLE'
              ? 'UNPROVEN_PAID_DELIVERY'
              : s.id === 'BECK-WINDOWS-RECOVERY-KIT'
                ? 'PACKAGE_CANDIDATE_NO_CANONICAL_OFFER'
                : 'TRACE_REQUIRED';
  return {...s, present_files:present, missing_files:missing, readiness, repository_coverage: s.files.length ? Math.round(100*present.length/s.files.length) : 0};
});

candidates.sort((a,b) => b.score - a.score || (a.price_nzd || 0) - (b.price_nzd || 0));
const proof = {
  schema: 'BECK-MONETIZATION-SCOUT/v1',
  generated_at: new Date().toISOString(),
  mode: 'READ_ONLY_REPOSITORY_TRAVERSAL',
  sources: [
    'public/agent-products.json',
    'public/agent-commerce.json',
    'public/ai-catalog.json',
    'BEC-PRIME/catalog/offers/approved.json',
    'ops/cube-swarm/silo-definitions/mtg-commander.json',
    'truth-oracle.html',
    'public/truth-oracle.html',
    'public/agent-delivery-proof-audit.html'
  ],
  selection_rule: 'Candidate scores are readiness heuristics, not demand estimates. The operator-selected first-dollar path is the existing NZ$50 Founding Billboard offer; its live/catalog parity and fulfillment still require proof.',
  ranked_candidates: candidates.slice(0,12),
  substrate_inventory: substrateInventory,
  monetization_decision: {
    first_path: 'DREAMLEDGER-BILLBOARD-FOUNDING-001',
    why: 'Founding Billboard is the nearest existing NZ$50 Stripe path. Keep public checkout held until payment attribution, signed-webhook inventory allocation, human approval and publication evidence are proven.',
    must_pass_before_acquisition: [
      'Root, public, and production Truth Oracle pages agree; the retired standalone route redirects and contains no separate offer.',
      'The Billboard placement is allocated from a settled, attributable payment through the signed webhook, with human approval and a published-canvas receipt.',
      'The live Billboard checkout, inventory reservation, webhook idempotency and publication receipt are verified end to end.',
      'Do not claim revenue until external settlement, independent buyer, attribution, and delivery evidence exist.'
    ],
    fallback_after_first_path_is_proven: 'Re-enable QUOTE-COMPARE-49 only after Supabase persistence, idempotency and signed delivery are proven end-to-end.',
    later_candidates: ['QUOTE-COMPARE-49','COMMANDER-DECK-DIAGNOSTIC-001','SELLER-PROFIT-AUDIT-001','AGENT-TOLL-ROAD','TRUTH-ORACLE','BECK-WINDOWS-RECOVERY-KIT']
  },
  blockers,
  recommended_first_dollar_path: {
    offer: 'DREAMLEDGER-BILLBOARD-FOUNDING-001',
    reason: 'Founding Billboard is the selected NZ$50 first-dollar candidate because an exact live Stripe Payment Link already exists; public checkout remains held until fulfillment is verified.',
    condition_before_distribution: 'Verify exact live Stripe price/link, signed webhook idempotency, atomic inventory allocation, human approval and published-canvas delivery evidence. Keep public checkout held until the chain passes.',
    fulfillment_contract: 'After a verified paid order, allocate one 100x100 placement, preserve payment/order correlation, obtain human approval, publish the tile and record a stable delivery receipt.',
    status: blockers.some(x => x.offer === 'DREAMLEDGER-BILLBOARD-FOUNDING-001') ? 'BLOCKED_PENDING_BILLBOARD_FULFILLMENT' : 'HELD_CHECKOUT_PENDING_PROOF'
  },
  economic_truth: {
    verified_revenue_nzd: 0,
    independent_buyers_verified: 0,
    fulfillment_verified: false,
    note: 'No repository artifact can establish a real buyer, settled external payment, or delivered outcome by itself.'
  },
  artifact_hashes: Object.fromEntries(
    ['public/agent-products.json','public/agent-commerce.json','public/ai-catalog.json','BEC-PRIME/catalog/offers/approved.json']
      .filter(exists).map(p => [p, sha(p)])
  )
};
const outDir = path.join(root, 'proof', 'commerce');
fs.mkdirSync(outDir, {recursive:true});
const outPath = path.join(outDir, 'latest-monetization-scout.json');
fs.writeFileSync(outPath, JSON.stringify(proof,null,2)+'\n', 'utf8');
console.log(JSON.stringify(proof,null,2));
