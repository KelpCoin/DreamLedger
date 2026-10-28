'use strict';

// Public read-only marketplace surface for BECK's Vercel + Neon commerce exhaust.
// No session cookies, seller identity, private addresses, unpublished stock,
// credentials, Checkout creation or inferred revenue are returned by this route.
const QUERY = [
  "SELECT id::text AS id, silo_id, sku, slug, title, description, category,",
  "listing_type, price_minor, currency, quantity, published_at",
  "FROM marketplace.listings",
  "WHERE status = 'published' AND quantity > 0",
  "AND (silo_id <> 'mtg' OR (evidence ? 'physical_verification_receipt_sha256'",
  "AND evidence->>'physical_verification_receipt_sha256' ~ '^[0-9a-f]{64}$'))",
  "AND ($1::text IS NULL OR silo_id = $1)",
  "ORDER BY published_at DESC NULLS LAST, id DESC",
  "LIMIT $2::integer OFFSET $3::integer"
].join(' ');

function respond(res, status, data) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'public, max-age=0, s-maxage=30');
  res.setHeader('x-content-type-options', 'nosniff');
  res.end(JSON.stringify(data));
}
function readInteger(value, fallback, maximum) {
  if (value === null || value === '') return fallback;
  if (!/^(0|[1-9][0-9]*)$/.test(String(value))) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n <= maximum ? n : null;
}
function safePublic(row) {
  const price = Number(row.price_minor);
  if (!Number.isSafeInteger(price) || price < 0) throw new Error('INVALID_PRICE_IN_STORAGE');
  return {
    id: String(row.id),
    silo_id: String(row.silo_id),
    sku: String(row.sku),
    slug: String(row.slug),
    title: String(row.title),
    description: String(row.description || ''),
    category: String(row.category),
    listing_type: String(row.listing_type),
    price_minor: price,
    currency: String(row.currency),
    quantity: Number(row.quantity),
    status: 'published',
  };
}
// Query dependency injection exists only for deterministic tests.
// Production uses a parameterized driver and an exact table and column allowlist.
function createHandler(deps = {}) {
  const getEnv = deps.getEnv || (() => process.env.NEON_DATABASE_URL);
  const getQuery = deps.getQuery || (() => {
    const { neon } = require('@neondatabase/serverless');
    const connection = getEnv();
    const client = neon(connection);
    return (statement, params) => client.query(statement, params);
  });
  return async function handler(req, res) {
    if (req.method !== 'GET') return respond(res, 405, { error: 'METHOD_NOT_ALLOWED' });
    let u;
    try { u = new URL(String(req.url || '/'), 'https://dreamledger.org'); }
    catch { return respond(res, 400, { error: 'INVALID_REQUEST' }); }
    const p = u.searchParams;
    const allowed = new Set(['silo', 'limit', 'offset']);
    if ([...p.keys()].some(k => !allowed.has(k))) return respond(res, 400, { error: 'UNKNOWN_QUERY_PARAMETER' });
    const silo = p.get('silo');
    if (silo !== null && !/^[a-z0-9-]{1,48}$/.test(silo)) {
      return respond(res, 400, { error: 'INVALID_SILO' });
    }
    const limit = readInteger(p.get('limit'), 20, 100);
    const offset = readInteger(p.get('offset'), 0, 5000);
    if (limit === null || limit < 1 || offset === null) {
      return respond(res, 400, { error: 'INVALID_PAGINATION' });
    }
    if (!getEnv()) {
      return respond(res, 503, { error: 'NEON_DATABASE_NOT_CONFIGURED', configured: false });
    }
    try {
      const result = await getQuery()(QUERY, [silo, limit, offset]);
      if (!Array.isArray(result)) throw new Error('INVALID_DATABASE_RESPONSE');
      // Defensive duplicate filtering: only deliberately selected PUBLIC columns
      // can leave the API, even if the driver response includes extra fields.
      const items = result.map(safePublic);
      return respond(res, 200, {
        schema: 'CUBE/B2B-MARKETPLACE/v2',
        source: 'neon',
        items,
        count: items.length,
        next_offset: items.length === limit && offset + limit <= 5000 ? offset + limit : null,
        independent_revenue_evidence: false
      });
    } catch {
      return respond(res, 503, { error: 'MARKETPLACE_DATA_UNAVAILABLE' });
    }
  };
}
const handler = createHandler();
module.exports = handler;
module.exports.createHandler = createHandler;
module.exports.QUERY = QUERY;
