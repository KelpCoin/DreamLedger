#!/usr/bin/env node
'use strict';

// Read-only asset traversal. Scores monetization readiness, not demand or revenue.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
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
  if (id.includes('AGENT-PROOF-AUDIT-49')) score += 8;
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

const proofAuditFeed = feed.find(x => x.item_id === 'AGENT-PROOF-AUDIT-49');
const proofAuditPublic = 'public/agent-delivery-proof-audit.html';
const proofAuditRoot = 'agent-delivery-proof-audit.html';
if (proofAuditFeed && exists(proofAuditPublic) && exists(proofAuditRoot)) {
  const publicText = fs.readFileSync(path.join(root, proofAuditPublic), 'utf8');
  const rootText = fs.readFileSync(path.join(root, proofAuditRoot), 'utf8');
  const publicActive = /Purchase the audit|buy\.stripe\.com/i.test(publicText);
  const rootWithdrawn = /Offer withdrawn|not available for purchase/i.test(rootText);
  if (publicActive && rootWithdrawn) {
    addBlocker('AGENT-PROOF-AUDIT-49','CONTRADICTORY_PUBLIC_ARTIFACTS',
      'public/agent-delivery-proof-audit.html advertises checkout while root agent-delivery-proof-audit.html says offer withdrawn. Production serves compiled website artifacts, so the actually deployed artifact must be checked before acquisition.');
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
if (aiCatalog.priority_offer?.id === 'AGENT-PROOF-AUDIT-49' && !proofAuditFeed) {
  addBlocker('AGENT-PROOF-AUDIT-49','FEED_MISMATCH','AI catalogue names Proof Audit as priority, but the product feed does not contain it.');
}

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
    'agent-delivery-proof-audit.html',
    'public/agent-delivery-proof-audit.html'
  ],
  selection_rule: 'Score is an explicit readiness heuristic based on existing checkout metadata and fulfillability. It is not a demand estimate, conversion forecast, or revenue claim.',
  ranked_candidates: candidates.slice(0,12),
  blockers,
  recommended_first_dollar_path: {
    offer: 'AGENT-PROOF-AUDIT-49',
    reason: 'Existing NZ$49 manual digital service has a defined input, bounded scope, report deliverable, and Stripe URL; manual fulfillment avoids making Supabase recovery a prerequisite.',
    condition_before_distribution: 'Resolve the contradictory root/public offer artifacts and confirm the actual production page and checkout destination match the approved offer.',
    fulfillment_contract: 'After verified paid order and complete accessible intake, manually produce the bounded evidence report, deliver it to the buyer, and retain payment attribution plus delivery evidence.',
    status: blockers.some(x => x.offer === 'AGENT-PROOF-AUDIT-49') ? 'BLOCKED_PENDING_PUBLIC_ARTIFACT_PARITY' : 'CANDIDATE_NOT_YET_ECONOMICALLY_VERIFIED'
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
