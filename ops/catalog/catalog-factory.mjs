#!/usr/bin/env node
'use strict';

// Streaming, fail-closed catalogue compiler. Input is one JSON object per line.
// A candidate only becomes a seed or product when its Gauntlet proof matches the
// exact canonical candidate digest. This compiler never calls Stripe or publishes.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { run: runCanonicalCandidateGauntlet } = require('../../BEC-PRIME/gauntlet/CandidateGauntlet.js');

const DEFAULT_REGISTRY = 'ops/catalog/silos/registry.json';
const DEFAULT_MAX_RECORDS = 250000;
const SHA256_RE = /^[a-f0-9]{64}$/i;
const SKU_RE = /^[A-Z0-9][A-Z0-9_-]{2,127}$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SEED_CHECKS = [
  'schema_valid', 'source_provenance', 'buyer_hypothesis', 'silo_boundary',
  'rights_and_privacy', 'duplicate_sku', 'truth_boundary'
];
const PRODUCT_CHECKS = [
  'demand_evidence', 'price_integrity', 'unit_economics', 'fulfillment_test', 'delivery_receipt'
];

export function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
}
export function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : canonical(value), 'utf8').digest('hex');
}
export function candidateDigest(record) {
  return sha256(record?.candidate ?? null);
}
function isIsoDate(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}
function lineObject(text, lineNumber) {
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('record must be a JSON object');
    return { value };
  } catch (error) {
    return { error: 'INVALID_JSON:' + String(error.message || error), line_number: lineNumber };
  }
}
function toCanonicalGauntletOffer(record) {
  const c = record?.candidate || {};
  const paid = c.price && Number.isSafeInteger(c.price.unit_amount_minor) && c.price.unit_amount_minor > 0;
  return {
    offer_id: String(c.sku || ''),
    name: String(c.name || ''),
    problem: String(c.problem || c.description || ''),
    input: String(c.input_contract || 'Candidate contract and source evidence supplied by the registered silo.'),
    output: String(c.description || ''),
    target_buyer: String(c.demand?.buyer_segment || ''),
    deliverable: String(c.description || ''),
    delivery_mechanism: String(c.fulfillment?.delivery_mode || 'blocked_until_fulfillment_ready'),
    price: paid ? Number(c.price.unit_amount_minor) / 100 : 0,
    currency: String(c.price?.currency || 'NZD').toUpperCase(),
    commercial_mode: paid ? 'PAID_CANDIDATE' : 'FREE_DISCOVERY',
    payment_adapter: 'stripe',
    checkout_route: '/api/offer-checkout/create',
    approval_required: true,
    checkout_available: false,
    status: 'candidate',
    proof_of_delivery: String(c.fulfillment?.test_ref || 'delivery_proof_required_before_product_release'),
    verification_rules: [
      'registered_silo',
      'source_provenance',
      'buyer_demand_evidence',
      'fulfillment_contract',
      'settlement_attribution',
      'delivery_receipt'
    ],
    provenance: { source_ref: c.source?.ref || null, source_sha256: c.source?.sha256 || null, private_material: 'excluded' },
    silo: String(c.silo || ''),
    kill_condition: 'No source provenance, no buyer evidence, failed fulfillment, or contradictory evidence.'
  };
}
export function verifyGauntlet(record) {
  const failures = [];
  const g = record?.gauntlet;
  const c = record?.candidate;
  if (record?.schema_version !== 'dreamledger/catalog-candidate/v1') failures.push('UNSUPPORTED_SCHEMA');
  if (!c || typeof c !== 'object' || Array.isArray(c)) failures.push('CANDIDATE_REQUIRED');
  if (g?.status !== 'PASS') failures.push('GAUNTLET_NOT_PASS');
  if (!g?.run_id || !isIsoDate(g?.completed_at)) failures.push('GAUNTLET_RUN_PROVENANCE_MISSING');
  const digest = candidateDigest(record);
  if (!SHA256_RE.test(String(g?.candidate_sha256 || '')) || String(g.candidate_sha256).toLowerCase() !== digest) {
    failures.push('GAUNTLET_CANDIDATE_DIGEST_MISMATCH');
  }
  const checks = Array.isArray(g?.checks) ? g.checks : [];
  if (!checks.length || checks.some(x => !x?.id || x.status !== 'PASS')) failures.push('GAUNTLET_CHECKS_NOT_ALL_PASS');
  const seen = new Set();
  for (const check of checks) {
    if (seen.has(check.id)) failures.push('DUPLICATE_GAUNTLET_CHECK:' + check.id);
    seen.add(check.id);
  }
  for (const id of SEED_CHECKS) if (!seen.has(id)) failures.push('GAUNTLET_REQUIRED_CHECK_MISSING:' + id);
  let canonicalProof = null;
  try {
    canonicalProof = runCanonicalCandidateGauntlet(toCanonicalGauntletOffer(record));
    if (canonicalProof.status !== 'PASS') {
      const failed = (canonicalProof.checks || []).filter(x => x.status !== 'PASS').map(x => x.id);
      failures.push('CANONICAL_GAUNTLET_FAIL:' + failed.join(','));
    }
  } catch (error) {
    failures.push('CANONICAL_GAUNTLET_ERROR:' + String(error.message || error));
  }
  return {
    passed: failures.length === 0,
    failures,
    candidate_sha256: digest,
    check_ids: [...seen].sort(),
    canonical_gauntlet: canonicalProof ? {status: canonicalProof.status, candidate_hash: canonicalProof.candidate_hash, checks: canonicalProof.checks} : null
  };
}
export function validateCandidate(record, siloMap) {
  const failures = [];
  const c = record?.candidate;
  if (!c || typeof c !== 'object' || Array.isArray(c)) return { valid: false, failures: ['CANDIDATE_REQUIRED'] };
  if (!SKU_RE.test(String(c.sku || ''))) failures.push('SKU_FORMAT_INVALID');
  if (!SLUG_RE.test(String(c.silo || ''))) failures.push('SILO_SLUG_INVALID');
  if (!siloMap.has(c.silo)) failures.push('SILO_NOT_REGISTERED:' + String(c.silo || ''));
  if (!['digital_product','software_service','subscription','physical_product','data_product','creative_asset'].includes(c.kind)) failures.push('PRODUCT_KIND_INVALID');
  if (!String(c.name || '').trim() || String(c.name).length > 180) failures.push('PRODUCT_NAME_INVALID');
  if (!String(c.description || '').trim() || String(c.description).length > 2000) failures.push('PRODUCT_DESCRIPTION_INVALID');
  if (!c.source || !String(c.source.ref || '').trim() || !SHA256_RE.test(String(c.source.sha256 || ''))) failures.push('SOURCE_PROVENANCE_INVALID');
  if (!c.demand || !String(c.demand.buyer_segment || '').trim()) {
    failures.push('BUYER_HYPOTHESIS_INVALID');
  } else if (!['HYPOTHESIS','SUPPORTED'].includes(c.demand.status)) {
    failures.push('DEMAND_STATUS_INVALID');
  } else if (c.demand.status === 'SUPPORTED' && !String(c.demand.evidence_ref || '').trim()) {
    failures.push('DEMAND_EVIDENCE_INVALID');
  }
  if (c.price !== null && c.price !== undefined) {
    if (!/^[a-z]{3}$/i.test(String(c.price.currency || ''))) failures.push('PRICE_CURRENCY_INVALID');
    if (!Number.isSafeInteger(c.price.unit_amount_minor) || c.price.unit_amount_minor <= 0) failures.push('PRICE_MINOR_AMOUNT_INVALID');
    const mode = c.price.billing_mode || 'one_time';
    if (!['one_time','subscription'].includes(mode)) failures.push('PRICE_BILLING_MODE_INVALID');
    if (mode === 'subscription' && !['day','week','month','year'].includes(c.price.interval)) failures.push('PRICE_INTERVAL_INVALID');
  }
  if (c.fulfillment !== null && c.fulfillment !== undefined) {
    if (!['PASS','UNVERIFIED','HOLD','NOT_APPLICABLE'].includes(c.fulfillment.status)) failures.push('FULFILLMENT_STATUS_INVALID');
    if (c.fulfillment.status === 'PASS') {
      if (!c.fulfillment.contract_id || !c.fulfillment.delivery_mode || !c.fulfillment.test_ref ||
          !SHA256_RE.test(String(c.fulfillment.test_sha256 || ''))) failures.push('FULFILLMENT_PROOF_INCOMPLETE');
    }
  }
  const g = verifyGauntlet(record);
  if (!g.passed) failures.push(...g.failures);
  if (record.elohim?.candidate_sha256 && String(record.elohim.candidate_sha256).toLowerCase() !== g.candidate_sha256) {
    failures.push('ELOHIM_REFINEMENT_CANDIDATE_STALE');
  }
  return { valid: failures.length === 0, failures, gauntlet: g };
}
function productReady(record, siloManifest, validation) {
  const c = record.candidate;
  const checkIds = new Set(validation.gauntlet.check_ids);
  const missingProductChecks = PRODUCT_CHECKS.filter(id => !checkIds.has(id));
  const demandEvidencePass = c.demand?.status === 'SUPPORTED' && Boolean(String(c.demand?.evidence_ref || '').trim());
  const fulfillmentPass = c.fulfillment?.status === 'PASS' &&
    c.fulfillment?.contract_id && c.fulfillment?.test_ref && SHA256_RE.test(String(c.fulfillment?.test_sha256 || ''));
  const pricePass = c.price && /^[a-z]{3}$/i.test(String(c.price.currency || '')) &&
    Number.isSafeInteger(c.price.unit_amount_minor) && c.price.unit_amount_minor > 0;
  const unitEconomicsPass = c.unit_economics?.status === 'PASS' &&
    Number.isSafeInteger(c.unit_economics.estimated_cost_minor) &&
    c.unit_economics.estimated_cost_minor >= 0 &&
    c.unit_economics.estimated_cost_minor < c.price?.unit_amount_minor;
  const review = record.commercial_review;
  const checkout = record.checkout;
  const reviewPass = review?.status === 'APPROVED' && review.approved_by &&
    isIsoDate(review.approved_at);
  const checkoutApprovalPass = checkout?.live_activation_approved === true &&
    checkout.approved_by && isIsoDate(checkout.approved_at);
  const siloLive = siloManifest?.live_checkout_enabled === true;
  return {
    ready: missingProductChecks.length === 0 && demandEvidencePass && fulfillmentPass && pricePass && unitEconomicsPass &&
      reviewPass && checkoutApprovalPass && siloLive,
    blockers: [
      ...missingProductChecks.map(x => 'GAUNTLET_CHECK_MISSING:' + x),
      ...(demandEvidencePass ? [] : ['DEMAND_EVIDENCE_NOT_PROVEN']),
      ...(fulfillmentPass ? [] : ['FULFILLMENT_NOT_PROVEN']),
      ...(pricePass ? [] : ['PRICE_NOT_VALID']),
      ...(unitEconomicsPass ? [] : ['UNIT_ECONOMICS_NOT_PROVEN']),
      ...(reviewPass ? [] : ['COMMERCIAL_REVIEW_NOT_APPROVED']),
      ...(checkoutApprovalPass ? [] : ['LIVE_CHECKOUT_APPROVAL_MISSING']),
      ...(siloLive ? [] : ['SILO_LIVE_CHECKOUT_DISABLED'])
    ]
  };
}
async function readLines(file) {
  const input = fs.createReadStream(file, { encoding: 'utf8' });
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  const lines = [];
  let count = 0;
  for await (const line of rl) {
    count++;
    if (line.trim()) lines.push({ line, line_number: count });
  }
  return lines;
}
async function streamLines(file, callback) {
  const input = fs.createReadStream(file, { encoding: 'utf8' });
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  let lineNumber = 0;
  for await (const line of rl) {
    lineNumber++;
    if (line.trim()) await callback(line, lineNumber);
  }
}
async function writeLine(stream, value) {
  if (!stream.write(JSON.stringify(value) + '\n')) await once(stream, 'drain');
}
function finishStream(stream) {
  return new Promise((resolve, reject) => {
    stream.once('finish', resolve);
    stream.once('error', reject);
    stream.end();
  });
}
function loadRegistry(file) {
  const registry = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (registry.schema_version !== 'dreamledger/silo-registry/v1' || !Array.isArray(registry.silos)) {
    throw new Error('Invalid silo registry schema');
  }
  const map = new Map();
  for (const silo of registry.silos) {
    if (!SLUG_RE.test(String(silo.slug || '')) || map.has(silo.slug)) throw new Error('Invalid/duplicate silo slug: ' + String(silo.slug));
    map.set(silo.slug, silo);
  }
  return { registry, map };
}
export async function compileCatalogue({ input, registryPath = DEFAULT_REGISTRY, outdir = 'ops/catalog/build', maxRecords = DEFAULT_MAX_RECORDS }) {
  if (!input) throw new Error('Input NDJSON path is required');
  if (!Number.isSafeInteger(maxRecords) || maxRecords < 1) throw new Error('maxRecords must be a positive integer');
  const inputPath = path.resolve(input);
  if (!fs.existsSync(inputPath) || !fs.statSync(inputPath).isFile()) throw new Error('Input file not found: ' + inputPath);
  const { registry, map: siloMap } = loadRegistry(path.resolve(registryPath));
  const occurrences = new Map();
  let sourceRecordCount = 0;
  await streamLines(inputPath, (line, lineNumber) => {
    sourceRecordCount++;
    if (sourceRecordCount > maxRecords) throw new Error('MAX_RECORDS_EXCEEDED:' + maxRecords);
    const parsed = lineObject(line, lineNumber);
    const sku = parsed.value?.candidate?.sku;
    if (typeof sku === 'string' && SKU_RE.test(sku)) {
      const prior = occurrences.get(sku);
      if (prior) prior.count++;
      else occurrences.set(sku, { count: 1 });
    }
  });
  const duplicateSkus = new Set([...occurrences].filter(([, v]) => v.count > 1).map(([sku]) => sku));
  const outputDir = path.resolve(outdir);
  fs.mkdirSync(outputDir, { recursive: true });
  // Remove prior success marker before overwriting any outputs. A failed run
  // must never leave a stale manifest that appears to certify partial files.
  fs.rmSync(path.join(outputDir, 'manifest.json'), { force: true });
  const streams = {
    products: fs.createWriteStream(path.join(outputDir, 'products.ndjson'), { flags: 'w', encoding: 'utf8' }),
    seeds: fs.createWriteStream(path.join(outputDir, 'seeds.ndjson'), { flags: 'w', encoding: 'utf8' }),
    rejected: fs.createWriteStream(path.join(outputDir, 'rejected.ndjson'), { flags: 'w', encoding: 'utf8' })
  };
  const counts = { products: 0, seeds: 0, rejected: 0, duplicates: duplicateSkus.size, source_records: sourceRecordCount };
  const bySilo = new Map([...siloMap.keys()].map(slug => [slug, { product_count: 0, seed_count: 0, rejected_count: 0 }]));
  try {
    await streamLines(inputPath, async (line, lineNumber) => {
      const parsed = lineObject(line, lineNumber);
      if (parsed.error) {
        counts.rejected++;
        await writeLine(streams.rejected, { line_number: lineNumber, reason: parsed.error });
        return;
      }
      const record = parsed.value;
      const sku = record?.candidate?.sku;
      if (typeof sku === 'string' && duplicateSkus.has(sku)) {
        counts.rejected++;
        if (bySilo.has(record.candidate.silo)) bySilo.get(record.candidate.silo).rejected_count++;
        await writeLine(streams.rejected, { line_number: lineNumber, sku, reason: 'DUPLICATE_SKU_ALL_OCCURRENCES_REJECTED' });
        return;
      }
      const result = validateCandidate(record, siloMap);
      if (!result.valid) {
        counts.rejected++;
        if (bySilo.has(record?.candidate?.silo)) bySilo.get(record.candidate.silo).rejected_count++;
        await writeLine(streams.rejected, { line_number: lineNumber, sku: sku || null, reason: result.failures });
        return;
      }
      const silo = siloMap.get(record.candidate.silo);
      const ready = productReady(record, silo, result);
      const refinements = record.elohim || {};
      const output = {
        ...record,
        factory: {
          state: ready.ready ? 'PRODUCT_READY' : 'GAUNTLET_PASSED_SEED',
          candidate_sha256: result.gauntlet.candidate_sha256,
          gauntlet_run_id: record.gauntlet.run_id,
          gauntlet_completed_at: record.gauntlet.completed_at,
          source_line_number: lineNumber,
          generated_at: new Date().toISOString(),
          canonical_gauntlet_execution: result.gauntlet.canonical_gauntlet,
          product_blockers: ready.blockers,
          elohim_refinement_state: refinements.candidate_sha256 === result.gauntlet.candidate_sha256
            ? 'REFINEMENT_CURRENT'
            : (refinements.iteration ? 'REFINEMENT_REVIEW_DUE' : 'AWAITING_ELOHIM_REFINEMENT'),
          live_checkout_enabled_for_silo: silo.live_checkout_enabled === true,
          public_listing: false
        }
      };
      if (ready.ready) {
        counts.products++;
        bySilo.get(record.candidate.silo).product_count++;
        await writeLine(streams.products, output);
      } else {
        counts.seeds++;
        bySilo.get(record.candidate.silo).seed_count++;
        await writeLine(streams.seeds, output);
      }
    });
  } finally {
    await Promise.all(Object.values(streams).map(finishStream));
  }
  const manifest = {
    schema_version: 'dreamledger/catalog-build-manifest/v1',
    generated_at: new Date().toISOString(),
    input_path: inputPath,
    input_record_count: sourceRecordCount,
    maximum_records_enforced: maxRecords,
    silo_registry_sha256: sha256(fs.readFileSync(path.resolve(registryPath), 'utf8')),
    totals: counts,
    silos: Object.fromEntries(bySilo),
    outputs: {
      products: 'products.ndjson',
      seeds: 'seeds.ndjson',
      rejected: 'rejected.ndjson',
      live_checkout_created: false
    },
    elohim_policy: 'Refinement is iterative and non-mutating by default. Any accepted candidate change invalidates the Gauntlet digest and requires a fresh Gauntlet run.',
    business_truth: 'NOT_CLAIMED'
  };
  fs.writeFileSync(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}
function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const input = argValue('--input');
  const registryPath = argValue('--registry', DEFAULT_REGISTRY);
  const outdir = argValue('--outdir', 'ops/catalog/build');
  const maxRecords = Number(argValue('--max-records', String(DEFAULT_MAX_RECORDS)));
  compileCatalogue({ input, registryPath, outdir, maxRecords })
    .then(result => console.log(JSON.stringify({ status: 'PASS', ...result }, null, 2)))
    .catch(error => { console.error(JSON.stringify({ status: 'HOLD', error: String(error.message || error) }, null, 2)); process.exitCode = 1; });
}
