'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const security = require('../security/McpSecurity');
const court = require('../runtime/EconomicCourtV2');

const ROOT = path.join(__dirname, '..');
const PRODUCTS = path.join(ROOT, 'catalog', 'products');
const PROOFS = path.join(ROOT, 'data', 'proofs');
const LEDGER = path.join(ROOT, 'data', 'mcp-ledger', 'events.jsonl');
const MANIFEST = security.loadManifest();
const TOOLS = [...MANIFEST.tools].sort((a, b) => a.name.localeCompare(b.name));

function now() { return new Date().toISOString(); }
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
function sha256(value) { return crypto.createHash('sha256').update(value, 'utf8').digest('hex'); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function ledgerLastHash() {
  if (!fs.existsSync(LEDGER)) return '0'.repeat(64);
  let last = '0'.repeat(64);
  for (const line of fs.readFileSync(LEDGER, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const e = JSON.parse(line);
    last = e.event_hash;
  }
  return last;
}
function appendLedger(type, payload) {
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
  const event = { schema_version: 'MCP-LEDGER-1.1', event_type: type, timestamp: now(), payload, previous_hash: ledgerLastHash() };
  event.event_hash = sha256(stable(event));
  fs.appendFileSync(LEDGER, JSON.stringify(event) + '\n', 'utf8');
  return event;
}
function verifyLedger() {
  let previous = '0'.repeat(64);
  if (!fs.existsSync(LEDGER)) return { status: 'PASS', count: 0, last_hash: previous };
  let count = 0;
  for (const line of fs.readFileSync(LEDGER, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const event = JSON.parse(line);
    if (event.previous_hash !== previous) throw new Error(`Ledger chain break at event ${count + 1}`);
    const supplied = event.event_hash;
    const copy = { ...event };
    delete copy.event_hash;
    if (sha256(stable(copy)) !== supplied) throw new Error(`Ledger hash mismatch at event ${count + 1}`);
    previous = supplied;
    count += 1;
  }
  return { status: 'PASS', count, last_hash: previous };
}
function product(sku) {
  security.assertNoShellMeta(sku);
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(String(sku || ''))) throw new Error('Invalid SKU');
  const file = path.join(PRODUCTS, `${sku}.json`);
  const safe = security.safePath(PRODUCTS, `${sku}.json`);
  if (file !== safe || !fs.existsSync(safe)) throw new Error('SKU not found');
  return readJson(safe);
}
function siloAllows(requestSilo, productSilo) {
  const r = security.validateSilo(requestSilo);
  const p = String(productSilo || '').toUpperCase();
  return r === 'CORE' || r === p;
}
function result(req, value, isError = false) {
  const modern = String(req?.params?._meta?.['io.modelcontextprotocol/protocolVersion'] || '') === '2026-07-28';
  const body = { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }], isError };
  if (modern) body.resultType = 'complete';
  return { jsonrpc: '2.0', id: req.id ?? null, result: body };
}
function error(req, code, message) { return { jsonrpc: '2.0', id: req.id ?? null, error: { code, message } }; }
function toolsResult(req) {
  const modern = String(req?.params?._meta?.['io.modelcontextprotocol/protocolVersion'] || '') === '2026-07-28';
  const out = { tools: TOOLS, ttlMs: 60000, cacheScope: 'private' };
  if (modern) out.resultType = 'complete';
  return { jsonrpc: '2.0', id: req.id ?? null, result: out };
}
function cartridge(args) {
  const silo = security.validateSilo(args.silo);
  const p = product(args.sku);
  if (!siloAllows(silo, p.silo)) throw new Error('Silo access denied');
  const copy = JSON.parse(JSON.stringify(p));
  delete copy.internal_notes;
  delete copy.secret;
  appendLedger('READ_CARTRIDGE', { silo, sku: p.id });
  return { sku: p.id, silo, cartridge: copy, read_only: true };
}
function inventory(args) {
  const silo = security.validateSilo(args.silo);
  const files = fs.readdirSync(PRODUCTS).filter(x => x.endsWith('.json')).sort();
  const items = {};
  for (const file of files) {
    const p = readJson(path.join(PRODUCTS, file));
    if (!siloAllows(silo, p.silo)) continue;
    if (!args.sku || String(args.sku) === p.id) items[p.id] = { inventory: Number(p.inventory || 0), status: p.status, silo: p.silo };
  }
  appendLedger('READ_INVENTORY', { silo, sku: args.sku || null });
  return { inventory: items, read_only: true };
}
function ledger(args) {
  const silo = security.validateSilo(args.silo);
  const limit = Math.min(200, Math.max(1, Number(args.limit || 100)));
  verifyLedger();
  const entries = [];
  if (fs.existsSync(LEDGER)) {
    for (const line of fs.readFileSync(LEDGER, 'utf8').split(/\r?\n/)) {
      if (!line.trim()) continue;
      const e = JSON.parse(line);
      if (args.event_type && e.event_type !== args.event_type) continue;
      if (e.payload && e.payload.silo && e.payload.silo !== silo && silo !== 'CORE') continue;
      entries.push(e);
    }
  }
  return { entries: entries.slice(-limit), count: Math.min(entries.length, limit), read_only: true, chain: verifyLedger() };
}
function proposeOffer(args) {
  const silo = security.validateSilo(args.silo);
  const proposal = court.propose({ action: 'offer', silo, payload: args.offer });
  appendLedger('OFFER_PROPOSED', { silo, proposal_id: proposal.proposal_id, state: proposal.state });
  return { proposal_id: proposal.proposal_id, state: proposal.state, court: proposal.court, approval_required: true, execution: 'BLOCKED_UNTIL_HUMAN_APPROVAL' };
}
function verifyProof(args) {
  const silo = security.validateSilo(args.silo);
  security.assertNoShellMeta(args.proof_id);
  const safe = security.safePath(PROOFS, `${args.proof_id}.json`);
  if (!fs.existsSync(safe)) return { proof_id: args.proof_id, verified: false, reason: 'Proof not found' };
  const proof = readJson(safe);
  const verification = security.verifyProofShape(proof);
  appendLedger('VERIFY_PROOF', { silo, proof_id: args.proof_id, verified: verification.verified });
  return { proof_id: args.proof_id, ...verification, read_only: true };
}
function proposeCheckout(args) {
  const silo = security.validateSilo(args.silo);
  const checkout = args.checkout || {};
  security.validateCustomerRef(checkout.customer_ref);
  const p = product(checkout.sku);
  if (!siloAllows(silo, p.silo)) throw new Error('Silo access denied');
  const expectedMinor = Number(p.price || 0);
  const providedMinor = court.amountMinor(checkout.amount);
  if (providedMinor !== expectedMinor) throw new Error(`Price mismatch: expected ${expectedMinor / 100} ${String(p.currency || 'nzd').toUpperCase()}`);
  if (Number(p.inventory || 0) < 1) throw new Error('Inventory unavailable');
  const proposal = court.propose({ action: 'checkout', silo, payload: { sku: p.id, amount: providedMinor / 100, currency: String(p.currency || 'nzd').toUpperCase(), customer_ref: checkout.customer_ref } });
  appendLedger('CHECKOUT_PROPOSED', { silo, proposal_id: proposal.proposal_id, sku: p.id, amount_minor: providedMinor, state: proposal.state });
  return { checkout_id: proposal.proposal_id, state: proposal.state, court: proposal.court, capital_authority: 'ZERO', execution: 'BLOCKED_UNTIL_HUMAN_APPROVAL', stripe_session_created: false };
}
const handlers = { dl_read_cartridge: cartridge, dl_read_inventory: inventory, dl_read_ledger: ledger, dl_propose_offer: proposeOffer, dl_verify_proof: verifyProof, dl_propose_checkout: proposeCheckout };

function handle(req) {
  if (!req || req.jsonrpc !== '2.0' || typeof req.method !== 'string') return error(req || {}, -32600, 'Invalid Request');
  if (req.method === 'initialize') return { jsonrpc: '2.0', id: req.id, result: { protocolVersion: '2025-11-25', capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'DreamLedger Gateway', version: '2.0.0-hardened' } } };
  if (req.method === 'initialized' || req.method === 'notifications/initialized') return null;
  if (req.method === 'server/discover') return { jsonrpc: '2.0', id: req.id, result: { resultType: 'complete', capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'DreamLedger Gateway', version: '2.0.0-hardened' }, ttlMs: 60000, cacheScope: 'private' } };
  if (req.method === 'tools/list') return toolsResult(req);
  if (req.method !== 'tools/call') return error(req, -32601, `Method not found: ${req.method}`);
  const name = String(req.params?.name || '');
  const fn = handlers[name];
  if (!fn) return error(req, -32602, `Unknown tool: ${name}`);
  try { return result(req, fn(req.params?.arguments || {}), false); }
  catch (err) { appendLedger('TOOL_ERROR', { tool: name, message: err.message }); return result(req, { error: err.message }, true); }
}

if (require.main === module) {
  security.verifyToolManifest();
  appendLedger('GATEWAY_START', { tools: TOOLS.map(t => t.name), manifest_sha256: security.manifestHash(MANIFEST) });
  process.stdin.setEncoding('utf8');
  let buffer = '';
  process.stdin.on('data', chunk => {
    buffer += chunk;
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim(); buffer = buffer.slice(idx + 1);
      if (!line) continue;
      let response;
      try { response = handle(JSON.parse(line)); }
      catch (err) { response = error({}, -32603, err.message); }
      if (response) process.stdout.write(JSON.stringify(response) + '\n');
    }
  });
}

module.exports = { handle, verifyLedger, TOOLS, appendLedger };
