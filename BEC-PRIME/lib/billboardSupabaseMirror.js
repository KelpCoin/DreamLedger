'use strict';

const fs = require('fs');
const path = require('path');
const billboard = require('../routes/billboard-v2');

const BASE = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const TABLE = 'molt_beach_campaigns';
const ROOT = process.env.BILLBOARD_DATA_DIR || '/var/data/billboard';
const MARKETS = ['GLOBAL','NZ','AU','ZA','AMERICAS','EUROPE'];

function localFile(market) { return path.join(ROOT, 'markets', market, 'billboard.json'); }
function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } }
function mapStatus(ad) {
  if (ad.status === 'REJECTED') return 'REJECTED';
  if (ad.payment_status !== 'paid') return null;
  return ad.status === 'PUBLISHED' ? 'PUBLISHED' : 'PAID_PENDING_REVIEW';
}
async function upsert(ad, market) {
  if (!BASE || !KEY || !ad || !ad.session_id) return;
  const status = mapStatus(ad);
  if (!status) return;
  const payload = {
    campaign_id: ad.id,
    market,
    x: Number(ad.x),
    y: Number(ad.y),
    width: Number(ad.w),
    height: Number(ad.h),
    price_nzd: Number(ad.amount_total_minor || ad.price || 0) / 100,
    owner_email: ad.email || null,
    image_url: ad.status === 'PUBLISHED' ? `${String(process.env.PUBLIC_BASE_URL || 'https://dreamledger.org').replace(/\/$/,'')}/billboard/media/${ad.id}` : null,
    destination_url: ad.link || null,
    stripe_session_id: ad.session_id,
    status,
    title: ad.title || null,
    purchased_at: ad.paid_at || ad.created_at || new Date().toISOString(),
    published_at: ad.status === 'PUBLISHED' ? (ad.fulfilled_at || new Date().toISOString()) : null,
    updated_at: new Date().toISOString()
  };
  const r = await fetch(`${BASE}/rest/v1/${TABLE}?on_conflict=stripe_session_id`, {
    method: 'POST',
    headers: { apikey: KEY, authorization: `Bearer ${KEY}`, 'content-type': 'application/json', prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error(`Supabase mirror failed: ${r.status}`);
}
async function syncAll() {
  if (!BASE || !KEY) return;
  const jobs = [];
  for (const market of MARKETS) {
    const data = readJson(localFile(market));
    for (const ad of Array.isArray(data?.ads) ? data.ads : []) jobs.push(upsert(ad, market));
  }
  await Promise.all(jobs);
}

const originalHandle = billboard.handle;
if (!originalHandle.__supabaseMirrorWrapped) {
  const wrapped = async function(...args) {
    const result = await originalHandle.apply(this, args);
    syncAll().catch(err => console.error('BILLBOARD_SUPABASE_MIRROR', err.message));
    return result;
  };
  wrapped.__supabaseMirrorWrapped = true;
  billboard.handle = wrapped;
}

const originalPaid = billboard.handlePaidSession;
if (typeof originalPaid === 'function' && !originalPaid.__supabaseMirrorWrapped) {
  const wrappedPaid = function(...args) {
    const result = originalPaid.apply(this, args);
    syncAll().catch(err => console.error('BILLBOARD_SUPABASE_MIRROR', err.message));
    return result;
  };
  wrappedPaid.__supabaseMirrorWrapped = true;
  billboard.handlePaidSession = wrappedPaid;
}

module.exports = { syncAll };
