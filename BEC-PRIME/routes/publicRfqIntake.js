'use strict';

const crypto = require('crypto');
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const ALLOWED_CATEGORIES = new Set([
  'Construction & trade', 'IT & hardware', 'Freight & logistics', 'Manufacturing',
  'Professional services', 'MTG wholesale', 'Retail overstock', 'Marketing & events', 'Other'
]);

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}
function clean(value, max) { return String(value == null ? '' : value).trim().slice(0, max); }
function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254; }
async function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 12000) {
        reject(Object.assign(new Error('REQUEST_TOO_LARGE'), { statusCode: 413 }));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); }
      catch { reject(Object.assign(new Error('INVALID_JSON'), { statusCode: 400 })); }
    });
    req.on('error', reject);
  });
}

async function handle(req, res, pathname) {
  if (pathname !== '/api/marketplace/intake') return false;
  if (req.method !== 'POST') {
    send(res, 405, { error: 'METHOD_NOT_ALLOWED' });
    return true;
  }
  try {
    const input = await readBody(req);
    // Honeypot: quietly absorb obvious bots without saving user data.
    if (clean(input.website, 200)) {
      send(res, 202, { ok: true, reference: 'received' });
      return true;
    }
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      send(res, 503, { error: 'RFQ_INTAKE_TEMPORARILY_UNAVAILABLE' });
      return true;
    }
    const company = clean(input.company, 120);
    const email = clean(input.email, 254).toLowerCase();
    const category = clean(input.category, 80);
    const title = clean(input.title, 160);
    const details = clean(input.details, 2000);
    const budget = clean(input.budget, 120);
    const region = clean(input.region, 120);
    const idempotencyKey = clean(input.idempotency_key, 80);
    if (company.length < 2 || !validEmail(email) || !ALLOWED_CATEGORIES.has(category) ||
        title.length < 5 || details.length < 10 || region.length < 2 ||
        !idempotencyKey || input.contact_consent !== true) {
      send(res, 422, { error: 'CHECK_REQUIRED_FIELDS_AND_CONTACT_CONSENT' });
      return true;
    }
    const record = {
      idempotency_key: idempotencyKey,
      company, contact_email: email, category, title, details, budget_text: budget, region,
      contact_consent: true,
      privacy_notice_version: '2026-10-26',
      source: 'dreamledger-b2b',
      status: 'received'
    };
    const response = await fetch(SUPABASE_URL + '/rest/v1/marketplace_public_rfq_intake?on_conflict=idempotency_key', {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=representation,resolution=ignore-duplicates'
      },
      body: JSON.stringify(record)
    });
    const raw = await response.text();
    let result = null;
    try { result = raw ? JSON.parse(raw) : null; } catch { result = null; }
    if (!response.ok) {
      console.error('B2B RFQ intake persistence failed', response.status);
      send(res, 503, { error: 'RFQ_INTAKE_TEMPORARILY_UNAVAILABLE' });
      return true;
    }
    const row = Array.isArray(result) ? result[0] : null;
    // A repeated idempotency key may return no row. Do not expose contact data.
    send(res, 201, {
      ok: true,
      status: 'received',
      reference: row && row.id ? row.id : crypto.createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 16),
      next: 'Human review required. Supplier matching is not guaranteed.'
    });
    return true;
  } catch (error) {
    send(res, Number(error.statusCode) || 400, { error: String(error.message || 'RFQ_INTAKE_FAILED').slice(0, 120) });
    return true;
  }
}

module.exports = { handle };
