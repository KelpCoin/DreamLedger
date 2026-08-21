'use strict';

const assert = require('node:assert/strict');
const { authorityReason, hashEvidence, verifyEvidenceChain } = require('../lib/mvpPolicy');

const baseAuthority = { authority_id: 'authz_test', max_bid: 5000, max_total_spend: 8000, allowed_auction_ids: ['A1'], allowed_categories: ['vehicle'], expires_at: new Date(Date.now() + 3600000).toISOString(), human_approval_required: false };
const baseAuction = { id: 'A1', category: 'vehicle', status: 'open', current_bid: 1000, ends_at: new Date(Date.now() + 3600000).toISOString() };

assert.equal(authorityReason({ authority: baseAuthority, auction: baseAuction, amount: 1500, acceptedSpend: 0 }), null);
assert.equal(authorityReason({ authority: baseAuthority, auction: baseAuction, amount: 6000, acceptedSpend: 0 }), 'MAX_BID_EXCEEDED');
assert.equal(authorityReason({ authority: baseAuthority, auction: baseAuction, amount: 1500, acceptedSpend: 7000 }), 'MAX_TOTAL_SPEND_EXCEEDED');
assert.equal(authorityReason({ authority: { ...baseAuthority, expires_at: new Date(Date.now() - 1000).toISOString() }, auction: baseAuction, amount: 1500 }), 'AUTHORITY_EXPIRED');
assert.equal(authorityReason({ authority: baseAuthority, auction: { ...baseAuction, id: 'A2' }, amount: 1500 }), 'AUCTION_NOT_AUTHORIZED');
assert.equal(authorityReason({ authority: baseAuthority, auction: { ...baseAuction, current_bid: 2000 }, amount: 1500 }), 'BID_BELOW_CURRENT');
assert.equal(authorityReason({ authority: baseAuthority, auction: { ...baseAuction, category: 'boat' }, amount: 2500 }), 'CATEGORY_NOT_AUTHORIZED');
assert.equal(authorityReason({ authority: { ...baseAuthority, human_approval_required: true }, auction: baseAuction, amount: 1500 }), 'HUMAN_APPROVAL_REQUIRED');

const first = { event_id: 'e1', timestamp: '2026-08-21T00:00:00.000Z', principal_id: 'u1', agent_id: null, action: 'TEST', authority: null, outcome: { allowed: true }, previous_hash: '0'.repeat(64) };
first.event_hash = hashEvidence(first);
const second = { event_id: 'e2', timestamp: '2026-08-21T00:00:01.000Z', principal_id: 'u1', agent_id: 'a1', action: 'TEST', authority: { authority_id: 'x' }, outcome: { allowed: false, reason: 'MAX_BID_EXCEEDED' }, previous_hash: first.event_hash };
second.event_hash = hashEvidence(second);
assert.deepEqual(verifyEvidenceChain([first, second]).ok, true);
const tampered = { ...second, outcome: { allowed: true } };
assert.equal(verifyEvidenceChain([first, tampered]).reason, 'EVENT_HASH_MISMATCH');
const broken = { ...second, previous_hash: '1'.repeat(64), event_hash: hashEvidence({ ...second, previous_hash: '1'.repeat(64) }) };
assert.equal(verifyEvidenceChain([first, broken]).reason, 'BROKEN_PREVIOUS_HASH');
console.log('PASS: DreamLedger MVP authority and evidence policy tests');
