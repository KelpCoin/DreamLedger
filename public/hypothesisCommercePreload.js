'use strict';
const crypto = require('crypto');
const http = require('http');
const { URL } = require('url');

const SUPABASE_URL = String(process.env.SUPABASE_URL || '');
const SUPABASE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const STRIPE_SECRET = String(process.env.STRIPE_SECRET_KEY || '');
const PUBLIC_BASE = String(process.env.PUBLIC_BASE_URL || 'https://dreamledger.org').replace(/\/$/, '');

async function readBody(req, max = 100000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > max) throw new Error('Request too large');
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function json(res, status, value) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(value));
}

function html(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

async function supabase(pathname, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase configuration unavailable');
  const response = await fetch(SUPABASE_URL + pathname, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + SUPABASE_KEY,
      Accept: 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  if (!response.ok) throw new Error('Supabase HTTP ' + response.status);
  return text ? JSON.parse(text) : null;
}

async function getSilo(siloId) {
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(siloId)) return null;
  const rows = await supabase('/rest/v1/cube_silos?select=id,label,public_route,inventory_mode,cross_game,cross_silo_view&id=eq.' + encodeURIComponent(siloId) + '&limit=1');
  return Array.isArray(rows) ? rows[0] || null : null;
}

function hypothesisFor(silo) {
  const label = String(silo.label || silo.id);
  const clean = label.replace(/["<>]/g, '').slice(0, 180);
  return {
    hypothesis_id: 'HYP-' + silo.id,
    silo_id: silo.id,
    title: 'Hypothesis: ' + clean,
    statement: 'HYPOTHESIS ONLY: a buyer may value a paid, source-grounded evaluation or artifact related to the ' + clean + ' silo. Demand is UNVERIFIED until an independent external buyer pays and the resulting fulfillment is evidenced.',
    truth_status: 'UNVERIFIED',
    source_basis: 'SYNTHETIC_FROM_CUBE_SILO',
    price_nzd: 29,
    fulfillment_type: 'hypothesis_research_request',
    public_route: '/hypotheses/' + silo.id
  };
}

async function createCheckout(hypothesis, email) {
  if (!STRIPE_SECRET) throw new Error('Stripe configuration unavailable');
  const form = new URLSearchParams();
  form.set('mode', 'payment');
  form.set('success_url', PUBLIC_BASE + hypothesis.public_route + '?paid=1&session_id={CHECKOUT_SESSION_ID}');
  form.set('cancel_url', PUBLIC_BASE + hypothesis.public_route + '?cancelled=1');
  form.set('client_reference_id', hypothesis.hypothesis_id);
  form.set('line_items[0][price_data][currency]', 'nzd');
  form.set('line_items[0][price_data][unit_amount]', String(hypothesis.price_nzd * 100));
  form.set('line_items[0][price_data][product_data][name]', hypothesis.title);
  form.set('line_items[0][price_data][product_data][description]', 'UNVERIFIED hypothesis commission. Payment commissions a source-grounded evaluation; payment does not prove the hypothesis.');
  form.set('line_items[0][quantity]', '1');
  form.set('metadata[hypothesis_id]', hypothesis.hypothesis_id);
  form.set('metadata[silo_id]', hypothesis.silo_id);
  form.set('metadata[truth_status]', hypothesis.truth_status);
  form.set('metadata[source_basis]', hypothesis.source_basis);
  form.set('metadata[sku_id]', 'HYPOTHESIS-COMMISSION-001');
  form.set('metadata[fulfillment_type]', hypothesis.fulfillment_type);
  form.set('payment_intent_data[metadata][hypothesis_id]', hypothesis.hypothesis_id);
  form.set('payment_intent_data[metadata][silo_id]', hypothesis.silo_id);
  form.set('payment_intent_data[metadata][truth_status]', hypothesis.truth_status);
  form.set('payment_intent_data[metadata][source_basis]', hypothesis.source_basis);
  form.set('payment_intent_data[metadata][sku_id]', 'HYPOTHESIS-COMMISSION-001');
  if (email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) form.set('customer_email', email);

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + STRIPE_SECRET,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: form
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload && payload.error && payload.error.message ? payload.error.message : 'Stripe Checkout creation failed');
  return payload;
}

function hypothesisPage(h) {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="index,follow"><link rel="canonical" href="' + PUBLIC_BASE + h.public_route + '"><title>' + esc(h.title) + ' | DreamLedger</title><style>body{margin:0;background:#07080c;color:#f4f1e8;font:16px system-ui,sans-serif}main{max-width:780px;margin:auto;padding:36px 20px}.card{background:#10131a;border:1px solid #303746;border-radius:18px;padding:26px}.tag{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#e0b85c;font-weight:800}h1{font-size:clamp(34px,7vw,58px);line-height:.95;letter-spacing:-.05em}p{color:#b0b6c2;line-height:1.6}.truth{border-left:3px solid #e0b85c;padding-left:14px}.buy{display:inline-block;margin-top:18px;background:#f0b90b;color:#080a0d;text-decoration:none;font-weight:900;padding:13px 18px;border-radius:10px;border:0;cursor:pointer}.meta{font-size:12px;color:#7e8795}input{display:block;width:100%;box-sizing:border-box;margin-top:8px;padding:12px;border-radius:8px;border:1px solid #3a4250;background:#090b10;color:#fff}label{font-size:12px;color:#9da5b1}</style></head><body><main><p><a href="/" style="color:#f4f1e8">DreamLedger</a> / Hypotheses</p><section class="card"><div class="tag">CUBE hypothesis · UNVERIFIED</div><h1>' + esc(h.title) + '</h1><p class="truth">' + esc(h.statement) + '</p><p>This page is a public economic experiment, not a claim that demand exists. The hypothesis is generated from a CUBE silo and carries no buyer evidence. Paying here means commissioning an evaluation of the hypothesis.</p><p><strong>Commission price: NZ$' + h.price_nzd.toFixed(2) + '</strong></p><form id="checkout"><label>Email (optional)<input name="email" type="email" maxlength="200" autocomplete="email"></label><button class="buy" type="submit">Commission this hypothesis</button></form><p class="meta">Hypothesis ID: ' + esc(h.hypothesis_id) + '<br>Source basis: ' + esc(h.source_basis) + '<br>Payment attribution: Stripe metadata + client reference ID<br>Revenue truth: settled external payment only, followed by fulfillment evidence.</p><p id="status" class="meta"></p></section></main><script>document.getElementById("checkout").addEventListener("submit",async function(e){e.preventDefault();const status=document.getElementById("status");status.textContent="Opening secure Stripe Checkout...";try{const email=this.email.value;const r=await fetch("/api/hypothesis-checkout",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({hypothesis_id:' + JSON.stringify(h.hypothesis_id) + ',email:email})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Checkout failed");location.href=d.checkout_url}catch(err){status.textContent=err.message||"Checkout failed"}});</script></body></html>';
}

if (!global.__dreamledgerHypothesisCommercePreload) {
  const originalCreateServer = http.createServer;
  http.createServer = function wrappedCreateServer(handler) {
    const wrapped = async function hypothesisCommerceHandler(req, res) {
      const pathname = String(req.url || '/').split('?')[0];

      if (req.method === 'GET' && pathname === '/hypotheses') {
        const body = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DreamLedger Hypotheses</title></head><body style="font-family:system-ui;background:#07080c;color:#eee;max-width:900px;margin:auto;padding:30px"><h1>CUBE Hypotheses</h1><p>Public, explicitly UNVERIFIED economic hypotheses. There are no buyer claims here unless independently evidenced.</p><p>Individual hypothesis routes are generated from the live CUBE silo registry. Use a silo route such as <code>/hypotheses/CUBE-AUTO-0025</code>.</p></body></html>';
        return html(res, 200, body);
      }

      const match = pathname.match(/^\/hypotheses\/([^/]+)\/?$/);
      if (req.method === 'GET' && match) {
        try {
          const silo = await getSilo(decodeURIComponent(match[1]));
          if (!silo) return html(res, 404, '<h1>Hypothesis not found</h1>');
          return html(res, 200, hypothesisPage(hypothesisFor(silo)));
        } catch (err) {
          return json(res, 503, {error: err.message || 'Hypothesis surface unavailable'});
        }
      }

      if (req.method === 'POST' && pathname === '/api/hypothesis-checkout') {
        try {
          const body = JSON.parse((await readBody(req)).toString('utf8'));
          const requested = String(body && body.hypothesis_id || '');
          if (!requested.startsWith('HYP-')) throw new Error('Invalid hypothesis_id');
          const siloId = requested.slice(4);
          const silo = await getSilo(siloId);
          if (!silo) throw new Error('Hypothesis not found');
          const h = hypothesisFor(silo);
          const session = await createCheckout(h, String(body.email || '').trim());
          return json(res, 200, {ok:true, hypothesis_id:h.hypothesis_id, checkout_session_id:session.id, checkout_url:session.url});
        } catch (err) {
          return json(res, 400, {ok:false,error:err.message || 'Checkout creation failed'});
        }
      }

      return handler(req, res);
    };
    return originalCreateServer.call(this, wrapped);
  };
  global.__dreamledgerHypothesisCommercePreload = true;
}
