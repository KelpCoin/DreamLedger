'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const PRODUCT_DIR = path.join(ROOT, 'catalog', 'products');
const PROOF_DIR = path.resolve(process.env.PROOF_DATA_DIR || path.join(ROOT, 'data', 'proofs'));
const M2M_API_KEY = process.env.M2M_API_KEY || '';
const M2M_QUOTE_SIGNING_SECRET = process.env.M2M_QUOTE_SIGNING_SECRET || '';

const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
const RAG_API_KEY = process.env.RAG_API_KEY || '';
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const settlementVerify = require('./settlementVerify');
const consultDecision = require('./consultDecision');

function send(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); }
function products() { if (!fs.existsSync(PRODUCT_DIR)) return []; return fs.readdirSync(PRODUCT_DIR).filter(x => x.endsWith('.json')).map(x => JSON.parse(fs.readFileSync(path.join(PRODUCT_DIR, x), 'utf8'))).filter(p => p.status === 'published' && p.commercial_truth?.approval_required === false && Number(p.inventory || 0) > 0); }
function machineProduct(p) { return { id: p.id, name: p.name, agentDescription: p.description, price: Number(p.price), currency: String(p.currency || 'nzd').toLowerCase(), inventory: Number(p.inventory), status: 'published', checkout_available: true, attributes: { type: 'physical_or_defined_delivery', silo: p.silo, shipping_zone: 'NZ' }, verification_hash: require('crypto').createHash('sha256').update(JSON.stringify(p)).digest('hex'), checkout_route: '/m2m/v1/checkout' }; }
function authorized(req) { if (!M2M_API_KEY) return true; const header = String(req.headers.authorization || ''); return header === `Bearer ${M2M_API_KEY}`; }
function ragAuthorized(req) { if (!RAG_API_KEY) return false; return String(req.headers.authorization || '') === `Bearer ${RAG_API_KEY}`; }
async function authorizedHuman(req) { const match=String(req.headers.authorization||'').match(/^Bearer\\s+(.+)$/i); if(!match||!SUPABASE_URL||!SUPABASE_ANON_KEY)return null; try{const r=await fetch(SUPABASE_URL+'/auth/v1/user',{headers:{apikey:SUPABASE_ANON_KEY,Authorization:'Bearer '+match[1]}});if(!r.ok)return null;const user=await r.json();return user?.id&&user?.email_confirmed_at?user:null;}catch{return null;} }
async function body(req) { let data = ''; for await (const chunk of req) { data += chunk; if (data.length > 1000000) throw new Error('Request too large'); } return JSON.parse(data || '{}'); }
async function ragQuery(payload, caller) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('RAG Supabase service is not configured');
  const headers = { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };
  const request = { query_text: String(payload.query || '').trim(), match_count: Math.min(Math.max(Number(payload.match_count || 8), 1), 30), rrf_k: 50 };
  if (Array.isArray(payload.embedding) && payload.embedding.length === 384) request.query_embedding = payload.embedding;
  if (!request.query_text) throw new Error('query is required');
  const started = Date.now();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/rag_hybrid_search`, { method: 'POST', headers, body: JSON.stringify(request) });
  if (!response.ok) throw new Error(`RAG retrieval failed (${response.status})`);
  const results = await response.json();
  const event = { query_text: request.query_text, retrieved_chunk_ids: results.map(x => x.id), retrieval_method: request.query_embedding ? 'hybrid' : 'keyword', result_count: results.length, latency_ms: Date.now() - started, caller };
  await fetch(`${SUPABASE_URL}/rest/v1/rpc/rag_record_retrieval_event`, { method: 'POST', headers, body: JSON.stringify(event) }).catch(() => {});
  return { query: request.query_text, retrieval_method: event.retrieval_method, result_count: results.length, results };
}
async function handle(req, res, url) {
  if (!url.startsWith('/m2m/v1')) return false;
  if (await consultDecision.handle(req, res, url)) return true;
  if (await settlementVerify.handle(req, res, url)) return true;
  if (req.method === 'GET' && url === '/m2m/v1/catalog/products') return send(res, 200, { products: products().map(machineProduct), pagination: { total: products().length, limit: 100, offset: 0 } });
  if (req.method === 'GET' && url === '/m2m/v1/catalog/auctions') return send(res, 200, { auctions: [] });
  if (req.method === 'POST' && url === '/m2m/v1/catalog/search') { const b = await body(req); const q = String(b.query || '').toLowerCase(); const max = Number(b.filters?.max_price || Infinity); const list = products().map(machineProduct).filter(p => (!q || `${p.name} ${p.agentDescription}`.toLowerCase().includes(q)) && p.price <= max && (!b.filters?.in_stock || p.inventory > 0)); return send(res, 200, { products: list, pagination: { total: list.length, limit: 100, offset: 0 } }); }
  if (req.method === 'POST' && url === '/m2m/v1/rag/query') {
    if (!ragAuthorized(req)) return send(res, RAG_API_KEY ? 403 : 503, { error: { code: RAG_API_KEY ? 'FORBIDDEN' : 'NOT_CONFIGURED', message: RAG_API_KEY ? 'RAG authentication required' : 'RAG is not configured' } });
    try { const b = await body(req); return send(res, 200, await ragQuery(b, 'm2m-rag')); } catch (err) { return send(res, 400, { error: { code: 'RAG_QUERY_FAILED', message: err.message || 'RAG query failed' } }); }
  }
  if (req.method === 'POST' && url === '/m2m/v1/checkout') { if (!authorized(req)) return send(res, 403, { error: { code: 'FORBIDDEN', message: 'M2M authentication required' } }); const b = await body(req); if (!b.product_id) return send(res, 422, { error: { code: 'VALIDATION_ERROR', message: 'product_id is required' } }); const target = products().find(p => p.id === b.product_id); if (!target) return send(res, 404, { error: { code: 'NOT_FOUND', message: 'Product not available' } }); return send(res, 200, { checkout_route: '/api/checkout/create', product_id: target.id, status: 'READY', requires_payment: true, human_approval_required: false, next: 'POST /api/checkout/create with product_id and silo' }); }
  if (req.method === 'GET' && url.startsWith('/m2m/v1/proof/')) { const ref = path.basename(url); const file = path.join(PROOF_DIR, ref.endsWith('.json') ? ref : `${ref}.json`); if (!fs.existsSync(file)) return send(res, 404, { error: { code: 'NOT_FOUND', message: 'Proof not found' } }); return send(res, 200, JSON.parse(fs.readFileSync(file, 'utf8'))); }
  if (req.method === 'GET' && url === '/m2m/v1/marketplace/manifest') return send(res, 200, { schema:'dreamledger.a2a-marketplace.manifest.v1', name:'DreamLedger B2B + A2A Marketplace', discovery:['/m2m/v1/marketplace/capabilities','/m2m/v1/marketplace/search'], commerce:['/m2m/v1/marketplace/quote','/m2m/v1/marketplace/authorize'], human_web:'/marketplace.html', b2b_web:'/b2b', a2a_web:'/a2a', agent_card:'/marketplace/agent-card.json', authority_required:['identity','consent','payment','external_account_actions'], truth_boundary:'UNVERIFIED until settled external payment, fulfillment and independent evidence are observed.' });
  if (req.method === 'GET' && url === '/m2m/v1/marketplace/capabilities') { const list=products().map(machineProduct).map(p=>({capability_id:'PRODUCT:'+p.id,name:p.name,description:p.agentDescription,price:p.price,currency:p.currency,pricing_mode:'fixed',source:'DreamLedger product catalog',checkout_route:p.checkout_route,verification_hash:p.verification_hash})); return send(res,200,{schema:'dreamledger.a2a.capabilities.v1',capabilities:list,total:list.length}); }
  if (req.method === 'POST' && url === '/m2m/v1/marketplace/search') { const b=await body(req),q=String(b.query||'').trim().toLowerCase(),max=Number.isFinite(Number(b.filters?.max_price))?Number(b.filters.max_price):Infinity; const capabilities=products().map(machineProduct).filter(p=>{const hay=(p.name+' '+p.agentDescription+' '+p.attributes.silo).toLowerCase();return(!q||hay.includes(q))&&p.price<=max&&(!b.filters?.in_stock||p.inventory>0)}).map(p=>({capability_id:'PRODUCT:'+p.id,name:p.name,description:p.agentDescription,price:p.price,currency:p.currency,pricing_mode:'fixed',source:'DreamLedger product catalog',checkout_route:p.checkout_route,verification_hash:p.verification_hash})); return send(res,200,{schema:'dreamledger.a2a.search.v1',query:q,capabilities,total:capabilities.length}); }
  if (req.method === 'POST' && url === '/m2m/v1/marketplace/quote') { const b=await body(req),id=String(b.capability_id||b.product_id||'').replace(/^PRODUCT:/,''),target=products().find(p=>p.id===id); if(!target)return send(res,404,{error:{code:'NOT_FOUND',message:'Capability not available'}}); if(!M2M_QUOTE_SIGNING_SECRET)return send(res,503,{error:{code:'QUOTE_SIGNING_NOT_CONFIGURED',message:'Secure quote signing is not configured; checkout is unavailable'}}); const p=machineProduct(target),issuedAt=Date.now(),claims=[target.id,String(p.price),p.currency,String(issuedAt)].join('|'),signature=crypto.createHmac('sha256',M2M_QUOTE_SIGNING_SECRET).update(claims).digest('hex'); return send(res,200,{schema:'dreamledger.a2a.quote.v1',quote_id:'quote:'+target.id+':'+issuedAt+':'+signature,capability_id:'PRODUCT:'+target.id,product_id:target.id,silo:target.silo||target.attributes.silo,price:p.price,currency:p.currency,pricing_mode:'fixed',issued_at:new Date(issuedAt).toISOString(),expires_at:new Date(issuedAt+900000).toISOString(),valid_for_seconds:900,checkout_route:'/api/checkout/create',payment_required:true,human_authorization_required:true,commercial_truth:'QUOTE_NOT_PAYMENT'}); }
  if (req.method === 'POST' && url === '/m2m/v1/marketplace/authorize') { const human=await authorizedHuman(req); if(!human)return send(res,401,{error:{code:'AUTHENTICATED_HUMAN_REQUIRED',message:'Sign in with a verified DreamLedger account before authorizing checkout'}}); const b=await body(req),id=String(b.capability_id||b.product_id||'').replace(/^PRODUCT:/,''),target=products().find(p=>p.id===id); if(!target)return send(res,404,{error:{code:'NOT_FOUND',message:'Capability not available'}}); if(b.authorized!==true)return send(res,403,{error:{code:'AUTHORITY_REQUIRED',message:'Explicit buyer authorization is required before checkout handoff'}}); if(!M2M_QUOTE_SIGNING_SECRET)return send(res,503,{error:{code:'QUOTE_SIGNING_NOT_CONFIGURED',message:'Secure quote signing is not configured; checkout is unavailable'}}); const quoteParts=String(b.quote_id||'').split(':'),issuedAt=Number(quoteParts[2]),signature=String(quoteParts[3]||''),p=machineProduct(target),claims=[target.id,String(p.price),p.currency,String(issuedAt)].join('|'),expected=crypto.createHmac('sha256',M2M_QUOTE_SIGNING_SECRET).update(claims).digest('hex'),sigA=Buffer.from(signature,'hex'),sigB=Buffer.from(expected,'hex'),validSignature=sigA.length===sigB.length&&sigA.length===32&&crypto.timingSafeEqual(sigA,sigB); if(quoteParts.length!==4||quoteParts[0]!=='quote'||quoteParts[1]!==target.id||!Number.isFinite(issuedAt)||issuedAt>Date.now()+5000||Date.now()-issuedAt>900000||!validSignature)return send(res,409,{error:{code:'QUOTE_EXPIRED_OR_MISMATCHED',message:'Quote signature, product, price or expiry is invalid. Request a fresh quote.'}}); return send(res,200,{schema:'dreamledger.a2a.authorization.v1',capability_id:'PRODUCT:'+target.id,authorization:'APPROVED_FOR_CHECKOUT_HANDOFF',authorized_by_user_id:human.id,checkout_route:'/api/checkout/create',product_id:target.id,silo:target.silo,price:p.price,currency:p.currency,quote_id:b.quote_id,quote_validated:true,human_authorization_required:true,commercial_truth:'AUTHORIZED_ACTION_NOT_PAYMENT'}); }
  if (req.method === 'GET' && url === '/m2m/v1/marketplace/orders') return send(res,200,{schema:'dreamledger.a2a.orders.v1',status:'DELEGATED_TO_EXISTING_COMMERCE_RAIL',route:'/api/marketplace/orders',truth:'Orders are not revenue until settled and fulfilled.'});
  return send(res, 404, { error: { code: 'NOT_FOUND', message: 'M2M endpoint not found' } });
}
module.exports = { handle };
