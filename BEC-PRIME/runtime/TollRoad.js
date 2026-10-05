'use strict';

/**
 * DreamLedger Toll Road v2
 * Supports thousands → 200,000 paid API roads.
 * Model: settled payment → entitlement → signed key → API wall.
 * CUBE owns isolation; this module owns keys + quotas.
 */

const crypto = require('crypto');

const KEY_SCHEMA = 'DREAMLEDGER-TOLL-KEY-2.0';
const DEFAULT_TTL_DAYS = 30;
const MAX_CALLS = 1000000;
const MAX_ROADS_SOFT = 200000;

function config() {
  return {
    secret: String(process.env.DREAMLEDGER_TOLL_KEY_SECRET || ''),
    gauntletPriceId: String(process.env.DREAMLEDGER_GAUNTLET_PRICE_ID || 'NZD_19'),
    truthPriceId: String(process.env.DREAMLEDGER_TRUTH_ORACLE_PRICE_ID || 'NZD_9'),
    gauntletPriceNzd: Number(process.env.DREAMLEDGER_GAUNTLET_PRICE_NZD || 19),
    truthPriceNzd: Number(process.env.DREAMLEDGER_TRUTH_ORACLE_PRICE_NZD || 9),
    bridgeEventsPriceNzd: Number(process.env.DREAMLEDGER_BRIDGE_EVENTS_PRICE_NZD || 19),
    routeLeasePriceNzd: Number(process.env.DREAMLEDGER_ROUTE_LEASE_PRICE_NZD || 29),
    gauntletPackPriceNzd: Number(process.env.DREAMLEDGER_GAUNTLET_PACK_PRICE_NZD || 15),
    defaultPackPriceNzd: Number(process.env.DREAMLEDGER_TOLL_DEFAULT_PACK_NZD || 19),
    defaultPackCalls: Number(process.env.DREAMLEDGER_TOLL_DEFAULT_PACK_CALLS || 100)
  };
}

function configured() {
  return Boolean(config().secret);
}

function b64(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decode(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

function sign(body) {
  return crypto.createHmac('sha256', config().secret).update(body).digest('base64url');
}

function issueKey({
  keyId,
  tier = 'gauntlet',
  roadId = null,
  ownerPassportId = null,
  entitlementId = null,
  expiresAt,
  callsRemaining = 1,
  reference = ''
} = {}) {
  if (!configured()) throw new Error('Toll key secret is not configured');
  const now = new Date();
  const exp = expiresAt || new Date(now.getTime() + DEFAULT_TTL_DAYS * 86400000).toISOString();
  const payload = {
    schema: KEY_SCHEMA,
    key_id: String(keyId || crypto.randomUUID()),
    tier: String(tier),
    road_id: roadId ? String(roadId).slice(0, 64) : null,
    owner_passport_id: ownerPassportId ? String(ownerPassportId).slice(0, 64) : null,
    entitlement_id: entitlementId ? String(entitlementId).slice(0, 64) : null,
    issued_at: now.toISOString(),
    expires_at: exp,
    calls_remaining: Math.min(Math.max(Number(callsRemaining) || 1, 1), MAX_CALLS),
    reference: String(reference || '').slice(0, 256)
  };
  const body = b64(payload);
  return 'dlk_' + body + '.' + sign(body);
}

function verifyKey(token, opts) {
  const options = (typeof opts === 'string') ? { requiredTier: opts } : (opts || {});
  const requiredTier = options.requiredTier || null;
  const requiredRoadId = options.requiredRoadId || null;

  if (!configured()) return { ok: false, error: 'toll_wall_not_configured' };
  const raw = String(token || '').trim();
  const parts = raw.split('.');
  if (parts.length !== 2 || !parts[0].startsWith('dlk_')) return { ok: false, error: 'invalid_toll_key' };
  const body = parts[0].slice(4);
  const signature = parts[1];
  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, error: 'invalid_toll_key' };
  let payload;
  try { payload = decode(body); } catch { return { ok: false, error: 'invalid_toll_key' }; }
  if (payload.schema !== KEY_SCHEMA && payload.schema !== 'DREAMLEDGER-TOLL-KEY-1.0') {
    return { ok: false, error: 'unsupported_key_schema' };
  }
  if (payload.expires_at && Date.parse(payload.expires_at) <= Date.now()) {
    return { ok: false, error: 'toll_key_expired' };
  }
  if (Number(payload.calls_remaining) <= 0) return { ok: false, error: 'toll_key_exhausted' };
  if (requiredTier && payload.tier !== requiredTier && payload.tier !== 'all') {
    return { ok: false, error: 'toll_key_scope_denied' };
  }
  if (requiredRoadId && payload.road_id && payload.road_id !== requiredRoadId) {
    return { ok: false, error: 'toll_key_road_denied' };
  }
  return { ok: true, payload };
}

function headerKey(req) {
  return String(req.headers['x-dreamledger-toll-key'] || '').trim();
}

function createRoadDescriptor({
  roadId,
  ownerPassportId,
  slug,
  title,
  description = '',
  priceNzd = 19,
  callsPerPack = 100,
  ttlDays = 30,
  siloId = 'api-access',
  status = 'draft'
} = {}) {
  if (!ownerPassportId) throw new Error('owner_passport_id required');
  if (!slug) throw new Error('slug required');
  const id = roadId || ('ROAD-' + crypto.randomUUID().slice(0, 8).toUpperCase());
  return {
    road_id: id,
    owner_passport_id: String(ownerPassportId).slice(0, 64),
    silo_id: String(siloId).slice(0, 64),
    slug: String(slug).toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 64),
    title: String(title || slug).slice(0, 240),
    description: String(description).slice(0, 2000),
    price_nzd: Math.max(1, Number(priceNzd) || 19),
    calls_per_pack: Math.min(Math.max(Number(callsPerPack) || 100, 1), MAX_CALLS),
    ttl_days: Math.min(Math.max(Number(ttlDays) || 30, 1), 365),
    status: ['draft', 'published', 'paused', 'archived'].includes(status) ? status : 'draft',
    public_route: null,
    created_at: new Date().toISOString(),
    schema: 'dreamledger/toll-road-descriptor/v1'
  };
}

function issueEntitlementForRoad(road, paymentReference, buyerRef = null) {
  if (!road || !road.road_id) throw new Error('road required');
  const entitlementId = 'ENT-' + crypto.randomUUID().slice(0, 12).toUpperCase();
  const key = issueKey({
    keyId: 'KEY-' + crypto.randomUUID().slice(0, 8).toUpperCase(),
    tier: 'road',
    roadId: road.road_id,
    ownerPassportId: road.owner_passport_id,
    entitlementId,
    callsRemaining: road.calls_per_pack,
    expiresAt: new Date(Date.now() + (road.ttl_days || DEFAULT_TTL_DAYS) * 86400000).toISOString(),
    reference: String(paymentReference || '')
  });
  return {
    entitlement_id: entitlementId,
    road_id: road.road_id,
    buyer_ref: buyerRef,
    payment_reference: paymentReference,
    calls_remaining: road.calls_per_pack,
    expires_at: new Date(Date.now() + (road.ttl_days || DEFAULT_TTL_DAYS) * 86400000).toISOString(),
    key,
    issued_at: new Date().toISOString(),
    economic_status: 'UNVERIFIED_UNTIL_STRIPE_SETTLED'
  };
}

function publicManifest(extraServices = []) {
  const c = config();
  const base = [
    { id: 'GAUNTLET-RUN', route: '/api/toll/v1/gauntlet', scope: 'gauntlet', price_nzd: c.gauntletPriceNzd, checkout_configured: c.gauntletPriceNzd > 0, description: 'Single automated decision / approval run' },
    { id: 'TRUTH-ORACLE-ACCESS', route: '/api/toll/v1/truth', scope: 'truth', price_nzd: c.truthPriceNzd, checkout_configured: c.truthPriceNzd > 0, description: 'Evidence classification wall access' },
    { id: 'AGENT-BRIDGE-EVENTS-100', route: '/api/toll/v1/bridge-events', scope: 'bridge-events', price_nzd: c.bridgeEventsPriceNzd, checkout_configured: c.bridgeEventsPriceNzd > 0, description: '100 metered Agent Bridge events / notes (30-day pack)' },
    { id: 'ROUTE-LEASE-BASIC', route: '/api/toll/v1/route-lease', scope: 'route-lease', price_nzd: c.routeLeasePriceNzd, checkout_configured: c.routeLeasePriceNzd > 0, description: 'Named pipeline / route lease (shared capacity, 30 days)' },
    { id: 'GAUNTLET-PACK-20', route: '/api/toll/v1/gauntlet-pack', scope: 'gauntlet-pack', price_nzd: c.gauntletPackPriceNzd, checkout_configured: c.gauntletPackPriceNzd > 0, description: '20 automated gauntlet approvals pack' },
    { id: 'MICRO-EVENT-INGEST', route: '/api/toll/v1/micro-ingest', scope: 'micro-ingest', price_nzd: 5, checkout_configured: true, description: '500 authenticated bridge event ingests' },
    { id: 'MICRO-JOB-CLAIM', route: '/api/toll/v1/job-claim', scope: 'job-claim', price_nzd: 9, checkout_configured: true, description: '200 agent job claims / lease starts' },
    { id: 'MICRO-HEARTBEAT', route: '/api/toll/v1/heartbeat', scope: 'heartbeat', price_nzd: 4, checkout_configured: true, description: '1000 job heartbeat renewals' },
    { id: 'ROUTE-LEASE-EXCLUSIVE', route: '/api/toll/v1/route-exclusive', scope: 'route-exclusive', price_nzd: 99, checkout_configured: true, description: 'Exclusive named route lease 30 days' },
    { id: 'ROUTE-LEASE-SHARED', route: '/api/toll/v1/route-shared', scope: 'route-shared', price_nzd: 9, checkout_configured: true, description: 'Shared contended route lease' },
    { id: 'GAUNTLET-RUSH', route: '/api/toll/v1/gauntlet-rush', scope: 'gauntlet-rush', price_nzd: 5, checkout_configured: true, description: '5 rush (15-min SLA) gauntlet tickets' },
    { id: 'GAUNTLET-ASYNC', route: '/api/toll/v1/gauntlet-async', scope: 'gauntlet-async', price_nzd: 8, checkout_configured: true, description: '20 async 24h SLA gauntlet tickets' },
    { id: 'BRIDGE-NOTE-WRITE', route: '/api/toll/v1/note-write', scope: 'note-write', price_nzd: 7, checkout_configured: true, description: '200 durable control ledger note writes' }
  ];
  return {
    schema: 'dreamledger/toll-road/v2',
    status: configured() ? 'ARMED' : 'NOT_CONFIGURED',
    model: 'customer pays -> settled payment -> entitlement -> signed key -> API wall -> automated fulfillment',
    human_gate: 'CUBE approval required before a road is published',
    internal_authority: 'never delegated to customer keys',
    truth_boundary: 'payment and economic truth remain external-evidence governed',
    design_target_roads: MAX_ROADS_SOFT,
    key_schema: KEY_SCHEMA,
    services: base.concat(extraServices),
    header: 'x-dreamledger-toll-key',
    next_batch_registry: 'AGENT_BUS/TOLL-ROADS-NEXT-BATCH.json'
  };
}

module.exports = {
  config,
  configured,
  issueKey,
  verifyKey,
  headerKey,
  publicManifest,
  createRoadDescriptor,
  issueEntitlementForRoad,
  KEY_SCHEMA,
  MAX_ROADS_SOFT,
  MAX_CALLS
};
