'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const sniper = require('../brain/SniperLoop');
const firstSaleGate = require('../gauntlet/FirstSaleGate');
const elohim = require('../council/Elohim');
const builder = require('../factory/BuilderBoss');
const verifier = require('../ledger/Verifier');

const product = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'catalog', 'products', 'EDH_0001.json'), 'utf8'));
const opp = sniper.scoreOpportunity(product);
assert.strictEqual(opp.status, 'CANDIDATE');
const gate = firstSaleGate.check(product);
assert.strictEqual(gate.verdict, 'PASS');
const council = elohim.run(product);
assert.strictEqual(council.verdict, 'SHIP_TO_BUYER_GATE');
const pack = builder.build(opp);
assert.ok(pack.action_pack_id);
const tmp = path.join(__dirname, '..', 'data', 'autonomy', 'smoke-proof');
const written = verifier.writeFossil({ asset_id: 'SMOKE', transaction_id: 'SMOKE-TRANSACTION', amount: 1, currency: 'nzd' }, tmp);
const proof = verifier.verifyFossil(written.file);
assert.strictEqual(proof.status, 'PASS');
fs.unlinkSync(written.file);
fs.rmdirSync(tmp);
console.log(JSON.stringify({ status: 'PASS', atoms: ['sniper', 'first-sale-gate', 'elohim', 'builder-boss', 'fossil-verifier'] }, null, 2));
