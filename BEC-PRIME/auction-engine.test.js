'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dreamledger-auction-gate-'));
const dataPath = path.join(temp, 'auctions.json');
process.env.AUCTION_DATA_PATH = dataPath;
process.env.AUCTION_PROOF_DIR = path.join(temp, 'proofs');

const endedAt = Date.now() - 60_000;
fs.writeFileSync(dataPath, JSON.stringify({
  auctions: [{
    auction_id: 'AUC-EXPIRED-FIXTURE',
    product_id: null,
    silo: 'SILO_MTG',
    title: 'Expired test fixture, not real inventory',
    description: 'Synthetic test only',
    currency: 'NZD',
    start_price: 10,
    reserve_price: 0,
    minimum_increment: 1,
    starts_at: endedAt - 60_000,
    ends_at: endedAt,
    anti_sniping_seconds: 120,
    status: 'live',
    approval_required: false,
    checkout_available: true
  }],
  bids: []
}, null, 2));

const engine = require('./auction-engine');

test('expired auction ends permanently instead of rotating back to live', () => {
  const [auction] = engine.listAuctions('SILO_MTG');
  assert.equal(auction.auction_id, 'AUC-EXPIRED-FIXTURE');
  assert.equal(auction.status, 'ended');
  const persisted = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  assert.equal(persisted.auctions[0].status, 'ended');
  assert.equal(persisted.auctions[0].ends_at, endedAt);
});

test('new auction defaults to held pending explicit approval', () => {
  const startsAt = Date.now() + 60_000;
  const auction = engine.createAuction({
    auction_id: 'AUC-HELD-FIXTURE',
    silo: 'SILO_MTG',
    title: 'Approval gate fixture, not real inventory',
    start_price: 10,
    starts_at: startsAt,
    ends_at: startsAt + 60 * 60 * 1000
  });
  assert.equal(auction.approval_required, true);
  assert.equal(auction.checkout_available, false);
  assert.equal(auction.status, 'scheduled');
});
