'use strict';

const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 30;
const buckets = new Map();

const RULES = [
  ['purchase_intent', /\b(buy|purchase|order|checkout|pay|price|cost|how much|available|in stock|cheapest|looking for|need|want)\b/i],
  ['sale_intent', /\b(sell|selling|list|listing|trade in|cash for|value my)\b/i],
  ['urgency', /\b(urgent|today|tonight|asap|now|quickly)\b/i],
  ['budget', /(?:\$|nzd|usd|budget|under \d|\d+\s*(?:dollars|bucks))/i]
];

function json(res, status, data) {
  if (res.writableEnded) return true;
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(data));
  return true;
}

function stableId(parts) {
  return crypto.createHash('sha256').update(parts.join('|'), 'utf8').digest('hex');
}

function bucketKey(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || 'unknown';
}

function allowed(req) {
  const now = Date.now();
  const key = bucketKey(req);
  const prior = buckets.get(key);
  if (!prior || now - prior.started >= WINDOW_MS) {
    buckets.set(key, { started: now, count: 1 });
    return true;
  }
  if (prior.count >= MAX_PER_WINDOW) return false;
  prior.count += 1;
  return true;
}

function classify(message) {
  const matches = RULES.filter(([, rule]) => rule.test(message)).map(([name]) => name);
  let buyerIntent = 5;
  if (matches.includes('purchase_intent')) buyerIntent += 45;
  if (matches.includes('budget')) buyerIntent += 20;
  if (matches.includes('urgency')) buyerIntent += 10;
  if (matches.includes('sale_intent')) buyerIntent = Math.max(buyerIntent, 35);
  return {
    matched_rules: matches,
    extracted_intent: matches.includes('sale_intent') && !matches.includes('purchase_intent')
      ? 'SELLING'
      : matches.includes('purchase_intent') ? 'BUYING' : 'GENERAL',
    buyer_intent: Math.min(100, buyerIntent)
  };
}

async function insertSignal(signal) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const err = new Error('CUBE signal sink is not configured');
    err.statusCode = 503;
    throw err;
  }
  const response = await fetch(
    SUPABASE_URL + '/rest/v1/economic_demand_signals',
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates,return=representation'
      },
      body: JSON.stringify(signal)
    }
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const err = new Error('CUBE signal sink HTTP ' + response.status + (detail ? ': ' + detail.slice(0, 300) : ''));
    err.statusCode = 502;
    throw err;
  }
  const rows = await response.json().catch(() => []);
  return { inserted: Array.isArray(rows) && rows.length > 0 };
}

async function handle(req, res, requestPath) {
  if (requestPath !== '/api/cube/chat-signal') return false;
  if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' });
  if (!allowed(req)) return json(res, 429, { error: 'rate limit exceeded' });

  let raw = '';
  try {
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 12000) return json(res, 413, { error: 'message too large' });
    }
  } catch {
    return json(res, 400, { error: 'invalid request body' });
  }

  let body;
  try { body = JSON.parse(raw || '{}'); }
  catch { return json(res, 400, { error: 'invalid JSON' }); }

  const message = String(body.message || '').trim().slice(0, 1000);
  if (!message) return json(res, 422, { error: 'message is required' });

  const siloId = String(body.silo_id || body.game_id || 'phinhaven').trim().slice(0, 120);
  const route = String(body.route || '').trim().slice(0, 160);
  const sessionId = String(body.session_id || '').trim().slice(0, 160);
  const now = new Date().toISOString();
  const minute = now.slice(0, 16);
  const classification = classify(message);
  const signalId = 'CHAT-' + stableId([siloId, sessionId, message.toLowerCase(), minute]);

  const signal = {
    signal_id: signalId,
    source: 'phinhaven_chat',
    source_ref: sessionId || null,
    observed_at: now,
    silo_id: siloId,
    domain_id: 'game_chat',
    problem_text: message,
    buyer_intent: classification.buyer_intent,
    freshness_score: 100,
    evidence_score: 20,
    fit_score: 50,
    estimated_value_nzd: null,
    status: 'OBSERVED',
    matched_lattice_id: null,
    approval_required: true,
    created_at: now,
    updated_at: now,
    source_url: route || null,
    title: 'Game chat demand signal',
    body: message,
    raw_data: {
      detector: 'keyword-v1',
      route,
      session_present: Boolean(sessionId),
      matched_rules: classification.matched_rules
    },
    extracted_budget: null,
    extracted_currency: null,
    extracted_intent: classification.extracted_intent
  };

  try {
    const result = await insertSignal(signal);
    return json(res, 202, {
      ok: true,
      accepted: true,
      inserted: result.inserted,
      signal_id: signalId,
      classification,
      economic_truth: 'SIGNAL_ONLY'
    });
  } catch (err) {
    return json(res, err.statusCode || 502, {
      error: err.message || 'CUBE signal intake failed',
      economic_truth: 'NO_SIGNAL_WRITTEN'
    });
  }
}

module.exports = { handle, classify };
