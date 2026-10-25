'use strict';

// Deterministic, no-network marketplace fan-out compiler.
// It prepares per-channel draft payloads only. It never logs in, publishes,
// creates checkout links, changes prices, or moves money.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const CONFIG_PATH = path.join(__dirname, 'channel-syndication-v1.json');
const FORBIDDEN_CROSS_SILO = ['amplissa', 'adult_silo', 'adult-only', 'adult only'];
function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
}
function fail(code) { const e = new Error(code); e.code = code; throw e; }
function validateProduct(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) fail('PRODUCT_OBJECT_REQUIRED');
  for (const k of ['product_id', 'silo_id', 'title', 'description', 'product_type', 'price', 'source_url', 'delivery_spec']) {
    if (typeof p[k] !== 'string' || !p[k].trim()) fail('REQUIRED_FIELD:' + k);
  }
  if (!['physical_goods', 'digital_download', 'digital_diagnostic', 'custom_service'].includes(p.product_type)) fail('INVALID_PRODUCT_TYPE');
  if (!/^https?:\/\//i.test(p.source_url)) fail('SOURCE_URL_MUST_BE_HTTP');
  if (!p.price.trim()) fail('PRICE_REQUIRED');
  if (p.product_type === 'physical_goods' && (!Number.isInteger(p.inventory_count) || p.inventory_count < 1)) fail('PHYSICAL_STOCK_PROOF_REQUIRED');
  const serialized = JSON.stringify(p).toLowerCase();
  if (FORBIDDEN_CROSS_SILO.some(x => serialized.includes(x))) fail('CROSS_SILO_CONTENT_BLOCKED');
  return p;
}
function compile(product, config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')), observedAt = new Date().toISOString()) {
  validateProduct(product);
  const productHash = sha256(product);
  const channels = config.channels.map(channel => {
    const compatible = channel.product_types.includes(product.product_type);
    const payload = {
      product_id: product.product_id,
      silo_id: product.silo_id,
      channel_id: channel.id,
      channel_label: channel.label,
      title: product.title,
      description: product.description,
      product_type: product.product_type,
      price_display: product.price,
      source_url: product.source_url,
      delivery_spec: product.delivery_spec,
      inventory_count: product.product_type === 'physical_goods' ? product.inventory_count : null,
      native_checkout_rule: channel.checkout_rule,
      required_prerequisites: channel.requires,
      adapter_state: channel.adapter_state,
      publication_state: 'DRAFT_ONLY',
      public_action_allowed: false,
      approval_required: true,
      provenance: { source_url: product.source_url, observed_at: observedAt, truth_label: 'SOURCE_BACKED_INPUT_REQUIRED' }
    };
    // The evidence timestamp changes each run; exclude it from content identity
    // so re-compiling identical product/channel content remains deduplicable.
    const dedupePayload = JSON.parse(JSON.stringify(payload));
    delete dedupePayload.provenance.observed_at;
    const payloadHash = sha256(dedupePayload);
    return {
      channel_id: channel.id,
      channel_label: channel.label,
      compatible,
      status: compatible ? 'STAGED_DRAFT' : 'SKIPPED_INCOMPATIBLE',
      reason: compatible ? 'DRAFT_PREPARED_PUBLICATION_NOT_AUTHORIZED' : 'PRODUCT_TYPE_NOT_SUPPORTED_BY_CHANNEL',
      content_sha256: payloadHash,
      dedupe_key: sha256([product.product_id, channel.id, payloadHash].join('|')),
      payload: compatible ? payload : null
    };
  });
  return {
    schema_version: 'DL-SYNDICATION-BATCH-1.0',
    artifact_id: 'DL-SYNDICATION-001',
    batch_id: 'SYN-' + sha256(product.product_id + '|' + productHash).slice(0, 16),
    generated_at: observedAt,
    truth_label: 'DRAFT_ONLY_NOT_PUBLISHED_NOT_REVENUE',
    source: { source_url: product.source_url, product_sha256: productHash },
    policy: { public_action_allowed: false, money_movement_allowed: false, price_change_allowed: false, credential_access_attempted: false },
    counts: {
      channels_considered: channels.length,
      compatible_drafts: channels.filter(x => x.compatible).length,
      incompatible_skips: channels.filter(x => !x.compatible).length,
      published: 0
    },
    channels
  };
}
if (require.main === module) {
  try {
    const input = process.argv[2];
    if (!input) fail('USAGE: node BEC-PRIME/distribution/CompileChannelSyndication.js <product.json> [output.json]');
    const product = JSON.parse(fs.readFileSync(path.resolve(input), 'utf8'));
    const result = compile(product);
    const output = process.argv[3];
    if (output) {
      const target = path.resolve(output);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
    }
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } catch (e) {
    process.stderr.write(String(e.code || e.message) + '\n');
    process.exitCode = 1;
  }
}
module.exports = { compile, validateProduct, sha256 };
