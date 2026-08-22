'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ledger = require('./Ledger');

const ROOT = path.join(__dirname, '..');
const DATA_ROOT = process.env.DREAMIEZ_DATA_DIR || ((fs.existsSync('/var/data') && fs.statSync('/var/data').isDirectory()) ? '/var/data/dreamiez' : path.join(ROOT, 'data', 'dreamiez'));
const USERS = path.join(DATA_ROOT, 'users.json');
const AUTHORITY_DIR = path.resolve(process.env.BEC_AUTHORITY_DIR || path.join(ROOT, 'data', 'authority'));
const AUTHORITIES = path.join(AUTHORITY_DIR, 'authorities.json');
const MAX_CEILING_CENTS = 100000000;

fs.mkdirSync(AUTHORITY_DIR, { recursive: true });

function readUsers() {
  try { return JSON.parse(fs.readFileSync(USERS, 'utf8')); } catch { return []; }
}

function readAuthorities() {
  try { return JSON.parse(fs.readFileSync(AUTHORITIES, 'utf8')); } catch { return {}; }
}

function writeAuthorities(authorities) {
  fs.mkdirSync(AUTHORITY_DIR, { recursive: true });
  const tmp = `${AUTHORITIES}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(authorities, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, AUTHORITIES);
}

function getCookie(req, name) {
  const raw = String(req.headers.cookie || '');
  const match = raw.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function sessionAccount(req) {
  const sessionId = getCookie(req, 'dreamiez_session');
  if (!sessionId) return null;
  const user = readUsers().find(item => item.id === sessionId && item.email);
  return user ? user.id : null;
}

function publicAuthority(accountId, authorities) {
  const record = authorities[accountId];
  if (!record) return { configured: false, authority_ceiling_cents: null, currency: 'NZD' };
  return {
    configured: true,
    authority_id: record.authority_id,
    authority_ceiling_cents: record.authority_ceiling_cents,
    currency: record.currency,
    updated_at: record.updated_at
  };
}

function setCeiling(accountId, amountCents, currency = 'NZD') {
  if (!accountId) throw new Error('Authentication required');
  const cents = Number(amountCents);
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > MAX_CEILING_CENTS) throw new Error('authority_ceiling_cents must be a safe integer between 0 and 100000000');
  const authorities = readAuthorities();
  const authorityId = authorities[accountId]?.authority_id || `auth_${crypto.randomBytes(12).toString('hex')}`;
  authorities[accountId] = {
    authority_id: authorityId,
    authority_ceiling_cents: cents,
    currency: String(currency || 'NZD').toUpperCase(),
    updated_at: new Date().toISOString()
  };
  writeAuthorities(authorities);
  ledger.appendEvent({
    event_type: 'AGENT_AUTHORITY_CEILING_SET',
    actor: { type: 'human', id: 'authenticated-account' },
    silo: 'AGENTIC-COMMERCE',
    payload: { public: false, authority_id: authorityId, authority_ceiling_cents: cents, currency: authorities[accountId].currency },
    claims: { payment_claim: false, sale_claim: false, fulfillment_claim: false },
    result: 'PASS'
  });
  return publicAuthority(accountId, authorities);
}

function evaluateAgentBid(accountId, bid) {
  if (!accountId) throw new Error('Authentication required');
  const amountCents = Number(bid && bid.amount_cents);
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) throw new Error('amount_cents must be a non-negative safe integer');
  const authorities = readAuthorities();
  const authority = authorities[accountId];
  if (!authority) throw new Error('Authority ceiling is not configured');
  const bidId = String((bid && bid.bid_id) || `bid_${crypto.randomBytes(10).toString('hex')}`);
  const allowed = amountCents <= authority.authority_ceiling_cents;
  const event = ledger.appendEvent({
    event_id: `agent_authority_${bidId}`,
    event_type: allowed ? 'AGENT_AUTHORITY_BID_ACCEPTED' : 'AGENT_AUTHORITY_BID_REJECTED',
    actor: { type: 'agent', id: 'agent-authority-demo' },
    silo: 'AGENTIC-COMMERCE',
    payload: {
      public: true,
      bid_id: bidId,
      authority_id: authority.authority_id,
      amount_cents: amountCents,
      authority_ceiling_cents: authority.authority_ceiling_cents,
      currency: authority.currency,
      rejection_reason: allowed ? null : 'AUTHORITY_CEILING_EXCEEDED'
    },
    claims: { payment_claim: false, sale_claim: false, fulfillment_claim: false },
    result: allowed ? 'ACCEPTED' : 'REJECTED'
  });
  return {
    accepted: allowed,
    status: allowed ? 'ACCEPTED' : 'REJECTED',
    bid_id: bidId,
    authority_ceiling_cents: authority.authority_ceiling_cents,
    amount_cents: amountCents,
    currency: authority.currency,
    evidence: {
      event_id: event.event_id,
      event_hash: event.event_hash,
      previous_event_hash: event.previous_event_hash,
      result: event.result
    },
    economic_truth: { SALE_SETTLED: false, ECONOMIC_PROOF: false, REVENUE: false }
  };
}

function findEvidence(eventId) {
  return ledger.readEvents().find(event => event.event_id === eventId) || null;
}

async function readJsonBody(req) {
  let value = '';
  for await (const chunk of req) {
    value += chunk;
    if (value.length > 200000) throw new Error('Request too large');
  }
  try { return JSON.parse(value || '{}'); } catch { throw new Error('Invalid JSON'); }
}

function send(res, status, data) {
  if (res.writableEnded) return true;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
  return true;
}

async function handle(req, res) {
  const url = String(req.url || '').split('?')[0];
  if (!url.startsWith('/api/agent-authority')) return false;
  const accountId = sessionAccount(req);
  if (!accountId) return send(res, 401, { error: 'Please log in first.' });

  if (req.method === 'GET' && url === '/api/agent-authority') {
    return send(res, 200, publicAuthority(accountId, readAuthorities()));
  }
  if (req.method === 'POST' && url === '/api/agent-authority/ceiling') {
    try {
      const input = await readJsonBody(req);
      return send(res, 200, { ok: true, authority: setCeiling(accountId, input.authority_ceiling_cents, input.currency) });
    } catch (err) { return send(res, 422, { error: err.message }); }
  }
  if (req.method === 'POST' && url === '/api/agent-authority/bid') {
    try { return send(res, 200, evaluateAgentBid(accountId, await readJsonBody(req))); }
    catch (err) { return send(res, 422, { error: err.message }); }
  }
  if (req.method === 'GET' && url.startsWith('/api/agent-authority/evidence/')) {
    const eventId = url.slice('/api/agent-authority/evidence/'.length);
    const event = findEvidence(eventId);
    if (!event || !event.payload || event.payload.public !== true) return send(res, 404, { error: 'Evidence not found' });
    return send(res, 200, { event });
  }
  return send(res, 404, { error: 'Agent authority route not found' });
}

module.exports = { setCeiling, evaluateAgentBid, findEvidence, handle, publicAuthority, AUTHORITIES };
