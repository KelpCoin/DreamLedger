'use strict';

// Tenant-authenticated Figure Eight review endpoint. LLM output is never a state transition.
const crypto = require('crypto');

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const PUBLIC_KEY = String(process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '');
const MAX_BODY = 24000;

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}
function fail(status, code) { return sendStatus(status, code); }
function sendStatus(status, code) { const e = new Error(code); e.statusCode = status; throw e; }
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])]));
  }
  return value;
}
function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}
function safeCandidate(entityType, row) {
  if (entityType === 'listing') return {
    title: row.title || row.name || '',
    description: row.description || '',
    category: row.category || row.category_id || '',
    price_minor: row.price_minor ?? row.price ?? null,
    currency: row.currency || null,
    status: row.status || null,
    silo_id: row.silo_id || null
  };
  if (entityType === 'rfq') return {
    title: row.title || '',
    description: row.description || '',
    budget_minor: row.budget_minor ?? null,
    currency: row.currency || null,
    status: row.status || null,
    silo_id: row.silo_id || null
  };
  return {
    scope: row.scope || '',
    amount_minor: row.amount_minor ?? null,
    currency: row.currency || null,
    lead_time_days: row.lead_time_days ?? null,
    status: row.status || null
  };
}
async function rest(method, table, query, payload) {
  if (!SUPABASE_URL || !SERVICE_KEY) sendStatus(503, 'MARKETPLACE_STORAGE_NOT_CONFIGURED');
  const response = await fetch(SUPABASE_URL + '/rest/v1/' + table + (query || ''), {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: 'Bearer ' + SERVICE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: payload === undefined ? undefined : JSON.stringify(payload)
  });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
  if (!response.ok) sendStatus(502, 'MARKETPLACE_STORAGE_REQUEST_FAILED:' + response.status);
  return data;
}
async function authenticatedUser(token) {
  if (!SUPABASE_URL || !PUBLIC_KEY) sendStatus(503, 'SUPABASE_AUTH_NOT_CONFIGURED');
  const response = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: PUBLIC_KEY, Authorization: 'Bearer ' + token }
  });
  if (!response.ok) sendStatus(401, 'AUTHENTICATION_REQUIRED');
  const user = await response.json();
  if (!user || !user.id) sendStatus(401, 'AUTHENTICATION_REQUIRED');
  return user;
}
function providersFromEnv() {
  let config;
  try { config = JSON.parse(process.env.BECK_COUNCIL_MODELS || '[]'); }
  catch { sendStatus(503, 'INVALID_COUNCIL_PROVIDER_CONFIGURATION'); }
  if (!Array.isArray(config)) sendStatus(503, 'INVALID_COUNCIL_PROVIDER_CONFIGURATION');
  const rows = config.filter(p => p && p.name && p.model && p.api_key_env &&
    (String(p.base_url || '').startsWith('https://') || String(p.base_url || '').startsWith('http://127.0.0.1')));
  const unique = new Map(rows.map(p => [String(p.name).toLowerCase() + ':' + String(p.model), p]));
  if (unique.size < 2) sendStatus(503, 'AT_LEAST_TWO_DISTINCT_MODELS_REQUIRED');
  return Array.from(unique.values());
}
async function ask(provider, system, payload) {
  const keyName = String(provider.api_key_env);
  const key = keyName === 'NONE' && String(provider.base_url).startsWith('http://127.0.0.1')
    ? '' : String(process.env[keyName] || '');
  if (!key && !(keyName === 'NONE' && String(provider.base_url).startsWith('http://127.0.0.1'))) {
    sendStatus(503, 'MODEL_KEY_MISSING:' + String(provider.name));
  }
  const response = await fetch(String(provider.base_url).replace(/\/$/, '') + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify({
      model: provider.model, temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify(payload) }
      ]
    }),
    signal: AbortSignal.timeout(35000)
  });
  if (!response.ok) sendStatus(502, 'MODEL_PROVIDER_FAILED:' + String(provider.name));
  const data = await response.json();
  const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (typeof content !== 'string' || !content.trim()) sendStatus(502, 'MODEL_PROVIDER_EMPTY_RESPONSE:' + String(provider.name));
  return content.slice(0, 8000);
}
async function readEntity(entityType, entityId, organizationId) {
  const table = entityType === 'listing' ? 'marketplace_listings'
    : entityType === 'rfq' ? 'marketplace_rfq_requests' : 'marketplace_proposals';
  const tenantColumn = entityType === 'proposal' ? 'seller_organization_id' : 'organization_id';
  const rows = await rest('GET', table,
    '?select=*&id=eq.' + encodeURIComponent(entityId) +
    '&' + tenantColumn + '=eq.' + encodeURIComponent(organizationId) + '&limit=1');
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

module.exports = async function marketplaceCouncil(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  try {
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    if (rawBody.length > MAX_BODY) return send(res, 413, { error: 'REQUEST_TOO_LARGE' });
    let body;
    try { body = typeof req.body === 'object' && req.body !== null ? req.body : JSON.parse(rawBody); }
    catch { return send(res, 400, { error: 'INVALID_JSON' }); }

    const authorization = String(req.headers.authorization || '');
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    if (!token) return send(res, 401, { error: 'AUTHENTICATION_REQUIRED' });
    const user = await authenticatedUser(token);
    const organizationId = String(body.organization_id || '');
    const siloId = String(body.silo_id || '');
    const entityType = String(body.entity_type || '');
    const entityId = String(body.entity_id || '');
    if (!organizationId || !siloId || !entityId || !['listing', 'rfq', 'proposal'].includes(entityType)) {
      return send(res, 400, { error: 'ORGANIZATION_SILO_AND_SUPPORTED_ENTITY_REQUIRED' });
    }

    const memberships = await rest('GET', 'marketplace_memberships',
      '?select=role,status&organization_id=eq.' + encodeURIComponent(organizationId) +
      '&user_id=eq.' + encodeURIComponent(user.id) + '&status=eq.active&limit=20');
    if (!Array.isArray(memberships) || !memberships.some(m =>
      ['owner', 'admin', 'buyer', 'seller', 'moderator', 'operator'].includes(m.role))) {
      return send(res, 403, { error: 'ACTIVE_TENANT_MEMBERSHIP_REQUIRED' });
    }
    const silos = await rest('GET', 'marketplace_organization_silos',
      '?select=silo_id,status&organization_id=eq.' + encodeURIComponent(organizationId) +
      '&silo_id=eq.' + encodeURIComponent(siloId) + '&status=eq.active&limit=1');
    if (!Array.isArray(silos) || !silos.length) return send(res, 403, { error: 'TENANT_SILO_NOT_AUTHORIZED' });

    const row = await readEntity(entityType, entityId, organizationId);
    if (!row) return send(res, 404, { error: 'TENANT_ENTITY_NOT_FOUND' });
    if (row.silo_id && row.silo_id !== siloId) return send(res, 403, { error: 'ENTITY_SILO_MISMATCH' });
    const candidate = safeCandidate(entityType, row);
    const input = { tenant_id: organizationId, silo_id: siloId, entity_type: entityType, entity_id: entityId, candidate };
    const inputHash = hash(input);
    const providers = providersFromEnv();
    const receipts = [];
    let current = input;
    let previousHash = inputHash;
    const rounds = Math.max(1, Math.min(3, Number(body.rounds || 2) || 2));

    for (let i = 1; i <= rounds; i++) {
      const refiner = providers[(i - 1) % providers.length];
      const critic = providers[i % providers.length];
      const proposal = await ask(refiner,
        'You are the BECK Figure Eight marketplace refiner. Improve buyer clarity, scope, evidence, deliverability and unit economics. Preserve facts. Never invent buyers, demand, credentials, or proof. Return concise JSON. Proposal only; do not publish.',
        { schema: 'dreamledger/figure-eight-marketplace-council/v1', iteration: i, input: current });
      const critique = await ask(critic,
        'You are the independent adversarial reviewer. Find unsupported claims, tenant leakage, silo leakage, privacy/security risks, licensing risks, missing fulfillment, margin gaps and failure modes. Never authorize publication or claim revenue. Return concise JSON.',
        { schema: 'dreamledger/figure-eight-marketplace-council/v1', iteration: i, tenant_id: organizationId,
          silo_id: siloId, proposal_hash: hash(proposal), proposal });
      current = { tenant_id: organizationId, silo_id: siloId, proposal, critique };
      const outputHash = hash(current);
      receipts.push({ iteration: i, refiner: refiner.name + ':' + refiner.model,
        critic: critic.name + ':' + critic.model, input_hash: previousHash, output_hash: outputHash });
      previousHash = outputHash;
    }

    const record = {
      organization_id: organizationId, silo_id: siloId, entity_type: entityType, entity_id: entityId,
      schema_version: 'dreamledger/figure-eight-marketplace-council/v1',
      status: 'review_proposal', input_hash: inputHash, output_hash: previousHash,
      model_receipts: receipts, unresolved_risks: [current.critique],
      publish_authorized: false, completed_at: new Date().toISOString()
    };
    const saved = await rest('POST', 'marketplace_council_runs', '', record);
    const savedRow = Array.isArray(saved) ? saved[0] : null;
    return send(res, 200, {
      schema: record.schema_version, status: 'REVIEW_PROPOSAL_ONLY',
      run_id: savedRow ? savedRow.id : null, tenant_id: organizationId, silo_id: siloId,
      input_hash: inputHash, output_hash: previousHash, rounds: receipts.length, receipts,
      result: current, authorization: { publish: false, contact_buyer: false, spend: false, checkout: false },
      revenue_claim: 'NONE'
    });
  } catch (error) {
    const status = Number(error && error.statusCode) || 500;
    const code = String(error && error.message || 'COUNCIL_FAILED').slice(0, 160);
    return send(res, status, { error: code });
  }
};
