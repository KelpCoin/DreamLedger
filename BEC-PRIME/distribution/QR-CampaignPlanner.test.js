'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { compile } = require('./QR-CampaignPlanner');

const ROOT = path.resolve(__dirname, '..', '..');
const PLAN = path.join(__dirname, '..', 'distribution', 'generated', 'QR-CAMPAIGN-PLAN.json');
const ASSETS = path.join(ROOT, 'public', 'qr', 'campaigns');

test('QR campaign planning generates first-party tracked codes without distribution side effects', async () => {
  const result = await compile();
  assert.equal(result.status, 'PASS_PREPARE_ONLY');
  assert.equal(result.external_post_executed, false);
  assert.equal(result.paid_spend_authorized, false);
  const plan = JSON.parse(fs.readFileSync(PLAN, 'utf8'));
  assert.equal(plan.status, 'PREPARED_NOT_DISTRIBUTED');
  assert.equal(plan.canonical.url, 'https://dreamledger.org/go?src=qr-canonical');
  assert.equal(plan.placements.length, plan.placement_count);
  assert.ok(plan.placement_count >= 10);
  for (const row of plan.placements) {
    const url = new URL(row.tracked_url);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.hostname, 'dreamledger.org');
    assert.equal(row.external_post_executed, false);
    assert.equal(row.paid_spend_authorized, false);
    assert.match(row.qr_sha256, /^[a-f0-9]{64}$/);
    const file = path.join(ROOT, 'public', row.qr_asset.replace(/^\//, ''));
    assert.ok(fs.existsSync(file), 'QR image missing for ' + row.placement_id);
    assert.ok(fs.statSync(file).size > 200, 'QR image too small for ' + row.placement_id);
  }
  const protectedRows = plan.placements.filter(x => x.status === 'PERMISSION_REQUIRED');
  assert.ok(protectedRows.length > 0, 'third-party channels must remain permission-gated');
  assert.ok(protectedRows.every(x => x.approval_required));
  const packaging = plan.placements.filter(x => x.status === 'FULFILLMENT_INSERT_READY');
  assert.ok(packaging.length > 0, 'order packaging should receive the canonical QR');
});

test('campaign planner forbids unowned hosts and defaults third-party channels to prepare-only', () => {
  const { policyFor, destinationFor } = require('./QR-CampaignPlanner');
  const partner = { id: 'PARTNER-XYZ', family: 'partnership', source: 'partner', medium: 'web', approval_required: true };
  const policy = policyFor(partner);
  assert.equal(policy.status, 'PERMISSION_REQUIRED');
  assert.equal(policy.may_publish_without_operator, false);
  assert.equal(new URL(destinationFor(partner, 'MTG-COLLECTOR-MARKETPLACE')).hostname, 'dreamledger.org');
});
