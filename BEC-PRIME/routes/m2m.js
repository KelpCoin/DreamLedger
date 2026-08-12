'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PRODUCT_DIR = path.join(ROOT, 'catalog', 'products');
const PROOF_DIR = path.resolve(process.env.PROOF_DATA_DIR || path.join(ROOT, 'data', 'proofs'));
const M2M_API_KEY = process.env.M2M_API_KEY || '';

function send(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); }
function products() { if (!fs.existsSync(PRODUCT_DIR)) return []; return fs.readdirSync(PRODUCT_DIR).filter(x => x.endsWith('.json')).map(x => JSON.parse(fs.readFileSync(path.join(PRODUCT_DIR, x), 'utf8'))).filter(p => p.status === 'published' && p.commercial_truth?.approval_required === false && Number(p.inventory || 0) > 0); }
function machineProduct(p) { return { id: p.id, name: p.name, agentDescription: p.description, price: Number(p.price), currency: String(p.currency || 'nzd').toLowerCase(), inventory: Number(p.inventory), status: 'published', checkout_available: true, attributes: { type: 'physical_or_defined_delivery', silo: p.silo, shipping_zone: 'NZ' }, verification_hash: require('crypto').createHash('sha256').update(JSON.stringify(p)).digest('hex'), checkout_route: '/m2m/v1/checkout' }; }
function authorized(req) { if (!M2M_API_KEY) return true; const header = String(req.headers.authorization || ''); return header === `Bearer ${M2M_API_KEY}`; }
async function body(req) { let data = ''; for await (const chunk of req) data += chunk; return JSON.parse(data || '{}'); }
async function handle(req, res, url) {
  if (!url.startsWith('/m2m/v1')) return false;
  if (req.method === 'GET' && url === '/m2m/v1/catalog/products') return send(res, 200, { products: products().map(machineProduct), pagination: { total: products().length, limit: 100, offset: 0 } });
  if (req.method === 'GET' && url === '/m2m/v1/catalog/auctions') return send(res, 200, { auctions: [] });
  if (req.method === 'POST' && url === '/m2m/v1/catalog/search') { const b = await body(req); const q = String(b.query || '').toLowerCase(); const max = Number(b.filters?.max_price || Infinity); const list = products().map(machineProduct).filter(p => (!q || `${p.name} ${p.agentDescription}`.toLowerCase().includes(q)) && p.price <= max && (!b.filters?.in_stock || p.inventory > 0)); return send(res, 200, { products: list, pagination: { total: list.length, limit: 100, offset: 0 } }); }
  if (req.method === 'POST' && url === '/m2m/v1/checkout') { if (!authorized(req)) return send(res, 403, { error: { code: 'FORBIDDEN', message: 'M2M authentication required' } }); const b = await body(req); if (!b.product_id) return send(res, 422, { error: { code: 'VALIDATION_ERROR', message: 'product_id is required' } }); const target = products().find(p => p.id === b.product_id); if (!target) return send(res, 404, { error: { code: 'NOT_FOUND', message: 'Product not available' } }); return send(res, 200, { checkout_route: '/api/checkout/create', product_id: target.id, status: 'READY', requires_payment: true, human_approval_required: false, next: 'POST /api/checkout/create with product_id and silo' }); }
  if (req.method === 'GET' && url.startsWith('/m2m/v1/proof/')) { const ref = path.basename(url); const file = path.join(PROOF_DIR, ref.endsWith('.json') ? ref : `${ref}.json`); if (!fs.existsSync(file)) return send(res, 404, { error: { code: 'NOT_FOUND', message: 'Proof not found' } }); return send(res, 200, JSON.parse(fs.readFileSync(file, 'utf8'))); }
  return send(res, 404, { error: { code: 'NOT_FOUND', message: 'M2M endpoint not found' } });
}
module.exports = { handle };
