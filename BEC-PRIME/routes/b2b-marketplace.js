'use strict';

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';

function send(res, status, value) {
  if (!res.writableEnded) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(value));
  }
  return true;
}

async function readBody(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1_000_000) throw Object.assign(new Error('Request too large'), { status: 413 });
  }
  try { return JSON.parse(raw || '{}'); }
  catch { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
}

async function auth(req) {
  const match = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
  if (!match) return { error: 'Supabase sign-in required', status: 401 };
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
    return { error: 'B2B database/auth service is not configured', status: 503 };
  }
  try {
    const response = await fetch(SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + match[1] }
    });
    if (!response.ok) return { error: 'Supabase session is invalid or expired', status: 401 };
    const user = await response.json();
    if (!user.id || !user.email || !user.email_confirmed_at) return { error: 'Verified email is required', status: 403 };
    return { user };
  } catch { return { error: 'B2B identity service is unavailable', status: 503 }; }
}

async function db(table, method = 'GET', query = '', payload = null, prefer = '') {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('B2B database is not configured');
  const response = await fetch(SUPABASE_URL + '/rest/v1/' + table + (query ? '?' + query : ''), {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(prefer ? { Prefer: prefer } : {})
    },
    body: payload === null ? undefined : JSON.stringify(payload)
  });
  const raw = await response.text();
  if (!response.ok) throw new Error('B2B database request failed (' + response.status + ')');
  return raw ? JSON.parse(raw) : null;
}

function unavailable(res, err) {
  if (err?.status) return send(res, err.status, { error: err.message });
  return send(res, 503, { error: 'B2B data service is unavailable; no transaction was recorded', code: 'B2B_DATA_UNAVAILABLE' });
}

async function handle(req, res, url) {
  if (!String(url).startsWith('/api/b2b/')) return false;
  const query = new URL(req.url, 'http://localhost').searchParams;

  if (req.method === 'GET' && url === '/api/b2b/config') {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return send(res, 503, { error: 'B2B sign-in is not configured' });
    return send(res, 200, { supabase_url: SUPABASE_URL, supabase_anon_key: SUPABASE_ANON_KEY });
  }

  if (req.method === 'GET' && url === '/api/b2b/search') {
    try {
      const rows = await db('marketplace_listings', 'GET', 'status=eq.published&select=*&order=created_at.desc&limit=100');
      const term = String(query.get('q') || '').trim().toLowerCase();
      const category = String(query.get('category') || '').trim().toLowerCase();
      const items = (Array.isArray(rows) ? rows : []).filter(x => {
        const hay = [x.title, x.description, x.category, x.location, x.slug].join(' ').toLowerCase();
        return (!term || hay.includes(term)) && (!category || String(x.category || '').toLowerCase() === category);
      }).map(x => ({
        id: x.id, slug: x.slug || null, title: x.title, description: x.description,
        category: x.category || 'General', price: x.price ?? x.price_nzd ?? null,
        currency: x.currency || 'NZD', seller_id: x.seller_id, location: x.location || null,
        status: 'published', created_at: x.created_at || null, agent_purchasable: x.agent_purchasable === true
      }));
      return send(res, 200, { schema: 'DREAMLEDGER/B2B-SEARCH/v2', items, total: items.length, source: 'marketplace_listings' });
    } catch (err) { return unavailable(res, err); }
  }

  if (!['GET', 'POST'].includes(req.method)) return send(res, 405, { error: 'method not allowed' });
  const identity = await auth(req);
  if (identity.error) return send(res, identity.status, { error: identity.error, code: identity.status === 503 ? 'B2B_AUTH_UNAVAILABLE' : 'AUTH_REQUIRED' });
  const uid = identity.user.id;

  try {
    if (req.method === 'GET' && url === '/api/b2b/rfqs') {
      const rows = await db('marketplace_b2b_rfqs', 'GET', 'status=eq.open&select=*&order=created_at.desc&limit=100');
      return send(res, 200, {
        schema: 'DREAMLEDGER/B2B-RFQ/v2',
        items: (rows || []).map(x => ({ id:x.id,title:x.title,description:x.description,category:x.category,budget_minor:x.budget_minor,budget_nzd:x.budget_minor === null ? null : Number(x.budget_minor) / 100,currency:x.currency,deadline:x.deadline,status:x.status,created_at:x.created_at,buyer_name:'Verified buyer' }))
      });
    }

    if (req.method === 'POST' && url === '/api/b2b/rfqs') {
      const b = await readBody(req);
      const title = String(b.title || '').trim().slice(0, 120);
      const description = String(b.description || '').trim().slice(0, 4000);
      const category = String(b.category || 'General').trim().slice(0, 80);
      const budget = Number(b.budget_nzd || 0);
      const deadlineRaw = String(b.deadline || '').trim();
      const key = String(req.headers['idempotency-key'] || b.idempotency_key || '').trim();
      if (!title || !description) return send(res, 422, { error: 'title and description are required' });
      if (!key || key.length > 200) return send(res, 422, { error: 'Idempotency-Key header is required' });
      if (!Number.isFinite(budget) || budget < 0 || budget > Number.MAX_SAFE_INTEGER / 100) return send(res, 422, { error: 'budget must be a safe non-negative NZD amount' });
      let deadline = null;
      if (deadlineRaw) {
        const parsed = new Date(deadlineRaw);
        if (!Number.isFinite(parsed.getTime()) || parsed.getTime() <= Date.now()) return send(res, 422, { error: 'deadline must be a future date' });
        deadline = parsed.toISOString();
      }
      const payload = {
        buyer_user_id: uid, title, description, category,
        budget_minor: budget > 0 ? Math.round(budget * 100) : null,
        currency: 'nzd', deadline, status: 'open', idempotency_key: key
      };
      const rows = await db('marketplace_b2b_rfqs', 'POST', 'on_conflict=buyer_user_id,idempotency_key', payload, 'resolution=ignore-duplicates,return=representation');
      let item = Array.isArray(rows) ? rows[0] : null;
      if (!item) {
        const found = await db('marketplace_b2b_rfqs', 'GET', 'buyer_user_id=eq.' + encodeURIComponent(uid) + '&idempotency_key=eq.' + encodeURIComponent(key) + '&select=*&limit=1');
        item = found?.[0];
      }
      if (!item) return send(res, 503, { error: 'RFQ persistence could not be confirmed', code: 'PERSISTENCE_UNCONFIRMED' });
      if (item.title !== title || item.description !== description || item.category !== category || item.budget_minor !== payload.budget_minor || (item.deadline || null) !== (payload.deadline || null)) return send(res, 409, { error: 'Idempotency-Key was already used for a different RFQ payload', code: 'IDEMPOTENCY_CONFLICT' });
      return send(res, 201, { ok: true, item: { id:item.id,title:item.title,description:item.description,category:item.category,budget_minor:item.budget_minor,budget_nzd:item.budget_minor === null ? null : Number(item.budget_minor) / 100,currency:item.currency,deadline:item.deadline,status:item.status,created_at:item.created_at }, commercial_truth: 'RFQ_RECORDED_NOT_ORDER_OR_REVENUE' });
    }

    if (req.method === 'GET' && url === '/api/b2b/my-rfqs') {
      const rows = await db('marketplace_b2b_rfqs', 'GET', 'buyer_user_id=eq.' + encodeURIComponent(uid) + '&select=*&order=created_at.desc&limit=100');
      return send(res, 200, { items: (rows || []).map(x => ({ id:x.id,title:x.title,description:x.description,category:x.category,budget_minor:x.budget_minor,budget_nzd:x.budget_minor === null ? null : Number(x.budget_minor) / 100,currency:x.currency,deadline:x.deadline,status:x.status,created_at:x.created_at })) });
    }

    if (req.method === 'GET' && url.startsWith('/api/b2b/rfqs/') && url.endsWith('/offers')) {
      const rid = url.slice('/api/b2b/rfqs/'.length, -'/offers'.length);
      const rfqs = await db('marketplace_b2b_rfqs', 'GET', 'id=eq.' + encodeURIComponent(rid) + '&select=id,buyer_user_id,status&limit=1');
      if (!rfqs?.length) return send(res, 404, { error: 'RFQ not found' });
      const allRows = await db('marketplace_b2b_offers', 'GET', 'rfq_id=eq.' + encodeURIComponent(rid) + '&status=eq.submitted&select=*&order=created_at.asc&limit=100');
      const isBuyer = rfqs[0].buyer_user_id === uid;
      const ownRows = (allRows || []).filter(x => x.supplier_user_id === uid);
      if (!isBuyer && ownRows.length === 0) return send(res, 403, { error: 'Only the RFQ buyer and participating suppliers can view these offers' });
      const rows = isBuyer ? (allRows || []) : ownRows;
      return send(res, 200, { items: rows.map(x => ({ id:x.id,rfq_id:x.rfq_id,title:x.title,description:x.description,amount_minor:x.amount_minor,price_nzd:Number(x.amount_minor)/100,currency:x.currency,lead_time:x.lead_time,terms:x.terms,status:x.status,created_at:x.created_at })) });
    }

    if (req.method === 'GET' && url.startsWith('/api/b2b/rfqs/')) {
      const rid = url.slice('/api/b2b/rfqs/'.length);
      const rows = await db('marketplace_b2b_rfqs', 'GET', 'id=eq.' + encodeURIComponent(rid) + '&select=*&limit=1');
      if (!rows?.length) return send(res, 404, { error: 'RFQ not found' });
      const x = rows[0];
      if (x.status !== 'open' && x.buyer_user_id !== uid) {
        const own = await db('marketplace_b2b_offers', 'GET', 'rfq_id=eq.' + encodeURIComponent(rid) + '&supplier_user_id=eq.' + encodeURIComponent(uid) + '&select=id&limit=1');
        if (!own?.length) return send(res, 404, { error: 'RFQ not found' });
      }
      return send(res, 200, { item: { id:x.id,title:x.title,description:x.description,category:x.category,budget_minor:x.budget_minor,budget_nzd:x.budget_minor === null ? null : Number(x.budget_minor) / 100,currency:x.currency,deadline:x.deadline,status:x.status,created_at:x.created_at } });
    }

    if (req.method === 'POST' && url === '/api/b2b/offers') {
      const b = await readBody(req);
      const rfqId = String(b.rfq_id || '');
      const title = String(b.title || '').trim().slice(0, 120);
      const description = String(b.description || '').trim().slice(0, 4000);
      const amount = Number(b.price_nzd);
      const lead = String(b.lead_time || '').trim().slice(0, 80);
      const terms = String(b.terms || '').trim().slice(0, 1000);
      const key = String(req.headers['idempotency-key'] || b.idempotency_key || '').trim();
      if (!rfqId || !title || !description || !Number.isFinite(amount) || amount <= 0 || amount > Number.MAX_SAFE_INTEGER / 100) return send(res, 422, { error: 'RFQ, title, description and safe positive NZD price are required' });
      if (!key || key.length > 200) return send(res, 422, { error: 'Idempotency-Key header is required' });
      const rfqs = await db('marketplace_b2b_rfqs', 'GET', 'id=eq.' + encodeURIComponent(rfqId) + '&select=id,buyer_user_id,status&limit=1');
      const rfq = rfqs?.[0];
      if (!rfq || rfq.status !== 'open') return send(res, 404, { error: 'Open RFQ not found' });
      if (rfq.buyer_user_id === uid) return send(res, 403, { error: 'buyer cannot submit an offer to their own RFQ' });
      const sellerAccounts = await db('marketplace_seller_accounts', 'GET', 'owner_user_id=eq.' + encodeURIComponent(uid) + '&select=id,onboarding_status,charges_enabled,payouts_enabled&limit=1');
      if (!sellerAccounts?.length || sellerAccounts[0].onboarding_status !== 'complete' || sellerAccounts[0].charges_enabled !== true || sellerAccounts[0].payouts_enabled !== true) {
        return send(res, 403, { error: 'verified supplier account with enabled payouts is required' });
      }
      const payload = {
        rfq_id: rfqId, supplier_user_id: uid, title, description,
        amount_minor: Math.round(amount * 100), currency: 'nzd', lead_time: lead,
        terms, status: 'submitted', idempotency_key: key
      };
      const rows = await db('marketplace_b2b_offers', 'POST', 'on_conflict=supplier_user_id,idempotency_key', payload, 'resolution=ignore-duplicates,return=representation');
      let item = Array.isArray(rows) ? rows[0] : null;
      if (!item) {
        const found = await db('marketplace_b2b_offers', 'GET', 'supplier_user_id=eq.' + encodeURIComponent(uid) + '&idempotency_key=eq.' + encodeURIComponent(key) + '&select=*&limit=1');
        item = found?.[0];
      }
      if (!item) return send(res, 503, { error: 'Offer persistence could not be confirmed', code: 'PERSISTENCE_UNCONFIRMED' });
      if (item.rfq_id !== rfqId || item.title !== title || item.description !== description || Number(item.amount_minor) !== payload.amount_minor || item.lead_time !== lead || item.terms !== terms) return send(res, 409, { error: 'Idempotency-Key was already used for a different offer payload', code: 'IDEMPOTENCY_CONFLICT' });
      return send(res, 201, { ok: true, item: { id:item.id,rfq_id:item.rfq_id,title:item.title,description:item.description,amount_minor:item.amount_minor,price_nzd:Number(item.amount_minor)/100,currency:item.currency,lead_time:item.lead_time,terms:item.terms,status:item.status,created_at:item.created_at }, commercial_truth: 'SUPPLIER_OFFER_NOT_ORDER_OR_REVENUE' });
    }

    if (url === '/api/b2b/orders' || url.startsWith('/api/b2b/orders/')) {
      return send(res, 503, { error: 'Order checkout is deliberately disabled until canonical marketplace order creation, Stripe settlement and fulfillment are connected and verified', code: 'B2B_CHECKOUT_NOT_RELEASED' });
    }
    return send(res, 404, { error: 'B2B route not found' });
  } catch (err) { return unavailable(res, err); }
}

module.exports = { handle };
