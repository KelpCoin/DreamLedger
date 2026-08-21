'use strict';

const crypto = require('crypto');

function authorityReason({ authority, auction, amount, acceptedSpend = 0, now = Date.now() }) {
  if (!authority || !authority.authority_id) return 'AUTHORITY_NOT_FOUND';
  if (authority.revoked_at) return 'AUTHORITY_REVOKED';
  if (new Date(authority.expires_at).getTime() <= now) return 'AUTHORITY_EXPIRED';
  if (authority.human_approval_required) return 'HUMAN_APPROVAL_REQUIRED';
  if (!Number.isFinite(amount) || amount <= 0) return 'INVALID_BID_AMOUNT';
  if (amount > Number(authority.max_bid)) return 'MAX_BID_EXCEEDED';
  if (Array.isArray(authority.allowed_auction_ids) && authority.allowed_auction_ids.length && !authority.allowed_auction_ids.includes(auction.id)) return 'AUCTION_NOT_AUTHORIZED';
  if (!auction) return 'AUCTION_NOT_FOUND';
  if (auction.status !== 'open') return 'AUCTION_CLOSED';
  if (new Date(auction.ends_at).getTime() <= now) return 'AUCTION_EXPIRED';
  if (Array.isArray(authority.allowed_categories) && authority.allowed_categories.length && !authority.allowed_categories.includes(auction.category)) return 'CATEGORY_NOT_AUTHORIZED';
  if (amount <= Number(auction.current_bid)) return 'BID_BELOW_CURRENT';
  if (acceptedSpend + amount > Number(authority.max_total_spend)) return 'MAX_TOTAL_SPEND_EXCEEDED';
  return null;
}

function canonicalEvidencePayload(event) {
  const sort = value => {
    if (Array.isArray(value)) return value.map(sort);
    if (value && typeof value === 'object') return Object.keys(value).sort().reduce((out, key) => { out[key] = sort(value[key]); return out; }, {});
    return value;
  };
  return JSON.stringify(sort(event));
}

function hashEvidence(event) {
  return crypto.createHash('sha256').update(canonicalEvidencePayload(event), 'utf8').digest('hex');
}

function verifyEvidenceChain(events) {
  let previous = '0'.repeat(64);
  for (const event of events) {
    if (!event || event.previous_hash !== previous) return { ok: false, reason: 'BROKEN_PREVIOUS_HASH', event_id: event?.event_id || null };
    const payload = { event_id: event.event_id, timestamp: event.timestamp, principal_id: event.principal_id, agent_id: event.agent_id, action: event.action, authority: event.authority, outcome: event.outcome, previous_hash: event.previous_hash };
    const expected = hashEvidence(payload);
    if (event.event_hash !== expected) return { ok: false, reason: 'EVENT_HASH_MISMATCH', event_id: event.event_id };
    previous = event.event_hash;
  }
  return { ok: true, count: events.length, last_hash: previous };
}

module.exports = { authorityReason, canonicalEvidencePayload, hashEvidence, verifyEvidenceChain };
