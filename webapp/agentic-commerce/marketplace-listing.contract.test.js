#!/usr/bin/env node
'use strict';

// Contract tests for the versioned marketplace spine.
// Run from BEC-PRIME after npm ci, or directly in CI.
// This validates listing metadata only; it does not claim payment, entitlement, or delivery.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const Ajv2020 = require('../../BEC-PRIME/node_modules/ajv/dist/2020');

const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'marketplace-listing.schema.json'), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

function validListing(overrides = {}) {
  return {
    schema_version: 'dreamledger.marketplace-listing.v1',
    listing_id: 'quote-normalizer.v1',
    kind: 'template',
    title: 'Supplier quote normalization template',
    summary: 'A reusable template for normalizing comparable supplier quotes with explicit tax and currency fields.',
    version: '1.0.0',
    publisher: { publisher_id: 'dreamledger', display_name: 'DreamLedger' },
    licence: { spdx_id: 'MIT', terms_url: 'https://opensource.org/license/mit', redistribution: 'allowed', commercial_use: true, attribution_required: true },
    content: { sha256: 'a'.repeat(64), media_type: 'application/json', size_bytes: 512, source_refs: ['https://dreamledger.org/quote-comparison/'] },
    interface: {
      inputs: [{ name: 'quotes', type: 'array', required: true }],
      outputs: [{ name: 'normalized_quotes', type: 'array' }],
      compatibility: ['JSON', 'CSV']
    },
    commercial_terms: { currency: 'NZD', amount_minor: 0, billing_model: 'free', discovery_price: 'FREE', unit_cost_estimate_minor: 0, margin_floor_bps: 0 },
    acceptance: { test_command_or_uri: 'node --test marketplace-listing.contract.test.js', expected_result: 'Schema accepts the listing and rejects malformed or unsupported fields.', delivery_evidence: 'test_report' },
    truth_status: 'INTERNAL',
    status: 'draft',
    limitations: ['Listing metadata is not proof of a sale, entitlement, fulfillment, or revenue.'],
    ...overrides
  };
}

function errorsFor(value) {
  const ok = validate(value);
  return { ok, errors: validate.errors ? [...validate.errors] : [] };
}

test('accepts a complete internal reusable-asset listing', () => {
  assert.equal(errorsFor(validListing()).ok, true, JSON.stringify(validate.errors));
});

test('accepts VERIFIED only when provenance includes verification evidence', () => {
  const value = validListing({
    truth_status: 'VERIFIED',
    provenance: {
      observed_at: '2026-10-09T00:00:00Z',
      verified_at: '2026-10-09T00:01:00Z',
      evidence_refs: ['https://github.com/KelpCoin/DreamLedger/commit/0000000000000000000000000000000000000000'],
      verification_method: 'Automated contract fixture; this fixture does not verify an economic outcome.'
    }
  });
  assert.equal(errorsFor(value).ok, true, JSON.stringify(validate.errors));
});

test('rejects VERIFIED status without provenance', () => {
  assert.equal(errorsFor(validListing({ truth_status: 'VERIFIED' })).ok, false);
});

test('rejects malformed content hashes', () => {
  const value = validListing();
  value.content.sha256 = 'not-a-sha256';
  assert.equal(errorsFor(value).ok, false);
});

test('rejects paid discovery that violates the free-discovery contract', () => {
  const value = validListing();
  value.commercial_terms.discovery_price = 'NZD 1.00';
  assert.equal(errorsFor(value).ok, false);
});

test('rejects unknown fields instead of silently widening the contract', () => {
  assert.equal(errorsFor(validListing({ checkout_secret: 'must-never-be-listed' })).ok, false);
});

test('rejects unsupported listing kinds', () => {
  assert.equal(errorsFor(validListing({ kind: 'unrestricted_remote_shell' })).ok, false);
});
