'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const { spawnSync } = require('child_process');
const gauntlet = require('../gauntlet/GauntletV6');
const elohim = require('../elohim/ElohimV6');
const proxy = require('../proxy/DigitalProxy');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data', 'autonomy');
const PROOF = path.join(DATA, 'proofs');
const STATE_FILE = path.join(DATA, 'state.json');
const LOG_FILE = path.join(DATA, 'autonomy.jsonl');
const PRODUCT_DIR = path.join(ROOT, 'catalog', 'products');
const LM_URL = (process.env.LM_STUDIO_BASE_URL || 'http://127.0.0.1:1234').replace(/\/$/, '');
const MODEL = process.env.LM_STUDIO_MODEL || 'local-model';
const MIN_PAID_EVENTS = Number(process.env.RABBIT_MIN_PAID_EVENTS || 3);

function ensure() {
  fs.mkdirSync(PROOF, { recursive: true });
  if (!fs.existsSync(STATE_FILE)) fs.writeFileSync(STATE_FILE, JSON.stringify({ paid_events: [], last_cycle: null, rabbit_mode: 'LOCKED' }, null, 2) + '\n');
  if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, '', 'utf8');
}
function readState() { ensure(); return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
function writeState(s) { fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2) + '\n', 'utf8'); }
function log(event, data = {}) { ensure(); fs.appendFileSync(LOG_FILE, JSON.stringify({ at: new Date().toISOString(), event, ...data }) + '\n', 'utf8'); }
function hash(v) { return crypto.createHash('sha256').update(v, 'utf8').digest('hex'); }
function writeProof(name, payload) { const file = path.join(PROOF, name); fs.writeFileSync(file, JSON.stringify(payload, null, 2) + '\n', 'utf8'); return file; }

function requestJson(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const client = target.protocol === 'https:' ? https : http;
    const req = client.request(target, { method: options.method || 'GET', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } }, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', c => { data += c; });
      res.on('end', () => {
        let parsed = {};
        try { parsed = JSON.parse(data || '{}'); } catch (err) { return reject(new Error(`Invalid JSON from ${url}: ${err.message}`)); }
        if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
        resolve(parsed);
      });
    });
    req.on('error', reject);
    if (body !== null) req.write(JSON.stringify(body));
    req.end();
  });
}

async function lmAnalyze(products, gauntletResult) {
  try {
    const response = await requestJson(`${LM_URL}/v1/chat/completions`, { method: 'POST' }, {
      model: MODEL,
      temperature: 0.1,
      max_tokens: 700,
      messages: [
        { role: 'system', content: 'You are the BEC local revenue analyst. Return JSON only. Propose, never execute. Never invent payments, customers, credentials, or inventory. Rank only verified products.' },
        { role: 'user', content: JSON.stringify({ products, gauntlet: { status: gauntletResult.status, checks: gauntletResult.checks } }) }
      ]
    });
    const text = response?.choices?.[0]?.message?.content || '{}';
    return JSON.parse(text.replace(/^```json\s*/i, '').replace(/\s*```$/i, ''));
  } catch (err) {
    return { status: 'LM_UNAVAILABLE', reason: err.message };
  }
}

function loadProducts() {
  if (!fs.existsSync(PRODUCT_DIR)) return [];
  return fs.readdirSync(PRODUCT_DIR).filter(x => x.endsWith('.json')).map(x => {
    try { return JSON.parse(fs.readFileSync(path.join(PRODUCT_DIR, x), 'utf8')); } catch { return null; }
  }).filter(Boolean).filter(p => p.status === 'published' && p.commercial_truth?.approval_required === false && Number(p.inventory || 0) > 0);
}

function discoverPaymentProofs() {
  const proofDir = path.join(ROOT, 'data', 'proofs');
  if (!fs.existsSync(proofDir)) return [];
  return fs.readdirSync(proofDir).filter(x => /FIRST_PAYMENT_PROOF|payment/i.test(x) && x.endsWith('.json')).map(x => {
    try { return JSON.parse(fs.readFileSync(path.join(proofDir, x), 'utf8)); } catch { return null; }
  }).filter(x => x && (x.status === 'PASS' || x.event === 'checkout.session.completed' || x.transaction_id));
}

async function cycle() {
  ensure();
  const started = new Date().toISOString();
  log('cycle.start');
  const compile = spawnSync(process.execPath, [path.join(ROOT, 'compiler', 'OfferCompiler.js')], { cwd: ROOT, encoding: 'utf8' });
  const gauntletResult = gauntlet.run();
  const products = loadProducts();
  const localAnalysis = await lmAnalyze(products, gauntletResult);
  const input = { products, gauntlet_status: gauntletResult.status, analysis: localAnalysis, cycle_started: started };
  const proposal = await elohim.propose(input);
  const proxyAction = proxy.queue('elohim.propose', input, 'BEC-AUTONOMY');
  const paymentProofs = discoverPaymentProofs();
  const state = readState();
  for (const proof of paymentProofs) {
    const id = String(proof.transaction_id || proof.idempotency_key || hash(JSON.stringify(proof)).slice(0, 24));
    if (!state.paid_events.some(x => x.id === id)) state.paid_events.push({ id, amount: proof.amount || null, currency: proof.currency || null, asset_id: proof.asset_id || null, observed_at: new Date().toISOString() });
  }
  state.last_cycle = new Date().toISOString();
  state.rabbit_mode = state.paid_events.length >= MIN_PAID_EVENTS ? 'ARMED' : 'LOCKED';
  state.rabbit_trigger = state.rabbit_mode === 'ARMED' ? 'PROVEN_REPEATABLE_PAID_EVENT_THRESHOLD' : 'WAITING_FOR_PAID_EVENTS';
  writeState(state);
  const proof = {
    schema_version: 'BEC-AUTONOMY-1.0',
    status: compile.status === 0 && gauntletResult.status === 'PASS' ? 'PASS' : 'FAIL',
    cycle_started: started,
    cycle_finished: new Date().toISOString(),
    compiler: compile.status === 0 ? 'PASS' : 'FAIL',
    gauntlet: gauntletResult.status,
    verified_products: products.map(p => p.id),
    lm_studio: localAnalysis.status === 'LM_UNAVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE',
    elohim_proposal_id: proposal.proposal_id,
    digital_proxy_action_id: proxyAction.action_id,
    paid_events_observed: state.paid_events.length,
    rabbit_mode: state.rabbit_mode,
    public_actions_executed: false,
    approval_boundary: 'REQUIRED',
    next_action: state.rabbit_mode === 'ARMED' ? 'Create clone proposals only; human approval remains required for public execution.' : 'Observe for first verified paid events.'
  };
  const file = writeProof('AUTONOMY-LATEST.json', proof);
  log('cycle.complete', { proof: file, rabbit_mode: state.rabbit_mode, paid_events: state.paid_events.length });
  return proof;
}

async function main() {
  const proof = await cycle();
  console.log(JSON.stringify(proof, null, 2));
  process.exit(proof.status === 'PASS' ? 0 : 1);
}

if (require.main === module) main().catch(err => { log('cycle.error', { error: err.message }); console.error(err.stack || err.message); process.exit(1); });
module.exports = { cycle };
