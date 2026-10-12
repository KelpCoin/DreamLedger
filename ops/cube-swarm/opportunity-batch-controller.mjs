#!/usr/bin/env node
'use strict';

/**
 * CUBE × SWARM opportunity batch controller.
 *
 * Ingests existing catalog/source records into one bounded, deduplicated pipeline.
 * It does not fabricate demand, contact buyers, publish offers, spend money, or write
 * to Supabase. Candidate counts are inventory counts, never revenue or buyer counts.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const args = process.argv.slice(2);
const valueAfter = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const outPath = path.resolve(root, valueAfter('--out', '.runtime/cube-swarm/opportunity-batch-latest.json'));
const maxCandidates = Math.max(1, Math.min(500000, Number(valueAfter('--max-candidates', '100000')) || 100000));
const inputPaths = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--input' && args[i + 1]) inputPaths.push(path.resolve(root, args[++i]));
}
if (!inputPaths.length) {
  for (const p of [
    'public/agent-products.json',
    'public/agent-commerce.json',
    'public/ai-catalog.json',
    'BEC-PRIME/catalog/offers/approved.json'
  ]) inputPaths.push(path.resolve(root, p));
}
const now = new Date().toISOString();
const digest = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const asArray = x => Array.isArray(x) ? x : (x && typeof x === 'object' ? [x] : []);
const safeRead = file => {
  try {
    const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
    if (file.endsWith('.jsonl') || file.endsWith('.ndjson')) {
      return raw.split(/\r?\n/).filter(Boolean).flatMap(line => {
        try { return [JSON.parse(line)]; } catch { return []; }
      });
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    for (const key of ['candidates', 'opportunities', 'approved', 'products', 'primary_offers', 'held_offers', 'items', 'signals', 'mechanisms']) {
      if (Array.isArray(parsed?.[key])) return parsed[key];
    }
    return [parsed];
  } catch (error) {
    return [{ __input_error: String(error.message), __input_path: file }];
  }
};
const normalize = (raw, sourcePath) => {
  const x = raw && typeof raw === 'object' ? raw : { value: raw };
  const id = String(x.opportunity_id || x.candidate_id || x.offer_id || x.product_id || x.product_sku || x.item_id || x.sku || x.id || '');
  const title = String(x.title || x.name || x.label || x.description || id || 'Untitled candidate').trim().slice(0, 240);
  const source = String(x.source || x.provenance?.source || sourcePath);
  const url = String(x.url || x.source_url || x.evidence_ref || x.checkout_url || x.payment_link_url || '');
  const text = [title, x.description, x.problem, x.buyer, x.buyer_segment, x.category, x.lane_definition].filter(Boolean).join(' ').slice(0, 2000);
  const paymentStatus = String(x.payment_intent_status || x.demand_evidence_status || x.evidence_status || '').toUpperCase();
  const hasExplicitDemand = ['VERIFIED', 'CONFIRMED'].includes(paymentStatus) ||
    x.buyer_request_verified === true || x.paid_order_verified === true;
  const hasSource = /^https?:\/\//i.test(url) || /^https?:\/\//i.test(source);
  const hasOffer = Boolean(x.checkout_url || x.payment_link_url || x.offer_id || x.product_id || x.sku);
  const hasFulfillment = Boolean(x.fulfillment || x.fulfillment_mode || x.fulfillment_method || x.delivery_mechanism);
  const hasPrice = Number.isFinite(Number(x.price_nzd ?? x.price)) && Number(x.price_nzd ?? x.price) > 0;
  const blockers = [];
  if (!hasSource) blockers.push('SOURCE_EVIDENCE_MISSING');
  if (!hasExplicitDemand) blockers.push('EXTERNAL_DEMAND_UNVERIFIED');
  if (!hasOffer) blockers.push('CANONICAL_OFFER_UNLINKED');
  if (!hasPrice) blockers.push('PRICE_UNVERIFIED');
  if (!hasFulfillment) blockers.push('FULFILLMENT_UNVERIFIED');
  const score = (hasExplicitDemand ? 50 : 0) + (hasSource ? 10 : 0) + (hasOffer ? 10 : 0) + (hasPrice ? 10 : 0) + (hasFulfillment ? 10 : 0) + (x.independent_buyer === true ? 10 : 0);
  const canonical = id ? id.toLowerCase() : digest(source + '|' + url + '|' + title.toLowerCase());
  return {
    opportunity_id: 'cube-' + digest(canonical).slice(0, 20),
    dedupe_key: digest(canonical),
    title,
    source,
    evidence_url: /^https?:\/\//i.test(url) ? url : null,
    candidate_text: text,
    source_file: path.relative(root, sourcePath).replaceAll('\\', '/'),
    score,
    route: score >= 80 && blockers.length === 0 ? 'GAUNTLET_READY' : (hasSource ? 'RESEARCH' : 'QUARANTINE'),
    evidence_status: hasExplicitDemand ? 'DEMAND_EVIDENCE_CLAIMED_REQUIRES_VERIFICATION' : 'UNVERIFIED',
    blockers,
    commercial_fields: {
      offer_linked: hasOffer,
      price_present: hasPrice,
      fulfillment_declared: hasFulfillment,
      independent_buyer_claimed: x.independent_buyer === true
    },
    observed_at_utc: now,
    raw_record_sha256: digest(JSON.stringify(x))
  };
};

const all = [];
const inputReport = [];
for (const file of inputPaths) {
  const rows = safeRead(file);
  inputReport.push({ path: path.relative(root, file).replaceAll('\\', '/'), records_read: rows.length, exists: fs.existsSync(file) });
  for (const row of rows) {
    if (all.length >= maxCandidates) break;
    if (row?.__input_error) {
      all.push({
        opportunity_id: 'input-error-' + digest(file).slice(0, 16),
        dedupe_key: digest('input-error|' + file),
        title: 'Input could not be parsed',
        source: file,
        route: 'QUARANTINE',
        evidence_status: 'UNVERIFIED',
        blockers: ['INPUT_PARSE_ERROR'],
        error: row.__input_error,
        observed_at_utc: now
      });
    } else {
      all.push(normalize(row, file));
    }
  }
}
const unique = new Map();
for (const row of all) {
  const prior = unique.get(row.dedupe_key);
  if (!prior || row.score > prior.score) unique.set(row.dedupe_key, row);
}
const candidates = [...unique.values()].sort((a, b) => b.score - a.score || a.opportunity_id.localeCompare(b.opportunity_id));
const counts = {
  records_seen: all.length,
  unique_candidates: candidates.length,
  gauntlet_ready: candidates.filter(x => x.route === 'GAUNTLET_READY').length,
  research: candidates.filter(x => x.route === 'RESEARCH').length,
  quarantine: candidates.filter(x => x.route === 'QUARANTINE').length,
  claimed_demand_unverified: candidates.filter(x => x.evidence_status === 'DEMAND_EVIDENCE_CLAIMED_REQUIRES_VERIFICATION').length
};
const report = {
  schema: 'DREAMLEDGER-CUBE-SWARM-BATCH/v1',
  generated_at_utc: now,
  status: 'BATCH_COMPILED_NOT_COMMERCIALLY_VALIDATED',
  pipeline: ['WORLD', 'OBSERVATION', 'IDEA', 'HYPOTHESIS', 'PROPOSITION', 'TEST', 'EXTERNAL_EFFECT', 'RESPONSE', 'PAYMENT', 'FULFILLMENT', 'TRUTH', 'LEARNING', 'MUTATION', 'REPEAT'],
  operating_contract: {
    one_shared_pipeline: true,
    max_candidates,
    source_records_are_not_buyer_demand: true,
    no_external_actions: true,
    no_supabase_writes: true,
    no_revenue_claimed: true,
    verified_revenue_nzd: 0,
    independent_buyers: 0,
    settled_external_payments: 0,
    fulfilled_paid_orders: 0,
    note: 'The controller inventories and routes existing records. It does not create artificial demand or claim that candidates are buyers.'
  },
  inputs: inputReport,
  counts,
  candidates
};
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify({ status: report.status, output: path.relative(root, outPath), ...counts, verified_revenue_nzd: 0 }, null, 2));
if (inputReport.every(x => !x.exists)) process.exitCode = 2;
