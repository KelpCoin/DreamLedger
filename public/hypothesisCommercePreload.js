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

const MECHANISMS = [
  ['monitoring','a continuously updated alert service for qualifying changes'],
  ['benchmarking','a source-grounded benchmark comparing current conditions against peers'],
  ['price-gap','a price-dislocation report identifying actionable differences across public markets'],
  ['public-record','a structured public-record investigation with source links and timestamps'],
  ['directory','a verified directory or supplier shortlist built from public evidence'],
  ['change-detection','a change-monitoring feed showing what changed, when, and where'],
  ['research-on-demand','a paid research request converted into a standardized evidence packet'],
  ['data-extraction','a normalized dataset extracted from public sources'],
  ['compliance-radar','a recurring watchlist for relevant regulatory or compliance changes'],
  ['opportunity-radar','an opportunity feed ranking observable events against explicit criteria'],
  ['historical-analysis','a historical dataset and trend analysis supporting a concrete decision'],
  ['competitor-watch','a public-source competitor monitoring report'],
  ['inventory-watch','a stock, availability, or listing monitor built from observable signals'],
  ['procurement','a supplier and purchasing comparison backed by current public prices'],
  ['route-arbitrage','a route, location, date, or configuration comparison exposing price differences'],
  ['grant-radar','a structured grant, funding, or assistance opportunity monitor'],
  ['tender-radar','a public procurement and tender opportunity monitor'],
  ['planning-radar','a planning, consent, permit, or development-change monitor'],
  ['property-radar','a property-event screening service based on public records'],
  ['job-radar','a filtered employment opportunity dataset with direct source links'],
  ['software-comparison','a current vendor/API/software comparison based on documented capabilities'],
  ['evidence-map','a source-grounded evidence map answering one sharply defined question'],
  ['literature-map','a structured scientific or technical literature evidence map'],
  ['patent-map','a public patent landscape and competitor-technology map'],
  ['marketplace-radar','a marketplace listing monitor identifying defined opportunity patterns'],
  ['used-equipment','a used-equipment valuation and comparable-sales report'],
  ['vehicle-intelligence','a vehicle price/comparable and availability research packet'],
  ['parts-intelligence','a parts availability and price comparison'],
  ['food-price','a grocery or ingredient price comparison across public listings'],
  ['energy-watch','a public energy-price and tariff comparison monitor'],
  ['insurance-research','a structured comparison of publicly available insurance conditions'],
  ['local-gap','a local-market gap analysis based on observable supply and demand signals'],
  ['seo-gap','a public search-intent and content-gap research packet'],
  ['domain-research','a domain/brand opportunity research packet based on defined criteria'],
  ['lead-research','a compliant public-business research dataset'],
  ['customer-language','a synthesis of recurring public questions into purchasable research products'],
  ['calculator','a decision calculator backed by explicit public inputs'],
  ['scoring-model','a transparent scoring model for a narrowly defined decision'],
  ['watchlist','a personalized watchlist generated from public evidence'],
  ['digest','a recurring evidence digest for a specific market or topic'],
  ['archive','a continuously maintained historical archive of changing public information'],
  ['verification','an independent verification service for a customer-supplied claim'],
  ['fact-pack','a concise source-linked fact pack answering a buyer-defined question'],
  ['due-diligence','a bounded public-source due-diligence packet'],
  ['anomaly-detection','an anomaly report identifying unusual changes in public data'],
  ['forecast-inputs',"a source-grounded dataset of observable inputs for a buyer's own forecast"],
  ['migration-map','a migration or transition opportunity map from public signals'],
  ['vendor-watch','a vendor pricing, availability, or product-change monitor'],
  ['product-watch','a product availability and price-change monitor'],
  ['regulatory-watch','a regulatory announcement and effective-date monitor'],
  ['construction-watch','a construction/project pipeline monitor'],
  ['business-change','a business opening, closing, relocation, or ownership-change monitor'],
  ['funding-watch','a public company or organization funding-event monitor'],
  ['research-subscription','a recurring research service assembled from reusable evidence pipelines'],
  ['data-subscription','a recurring normalized dataset refreshed from public sources'],
  ['alert-subscription','a recurring alert stream triggered by explicit customer criteria'],
  ['commission-market','a public commission surface where buyers request evaluation of a hypothesis'],
  ['report-market','a standardized paid report generated from a repeatable research recipe'],
  ['api-market','a machine-readable endpoint exposing a repeatedly requested transformation'],
  ['evidence-api','a machine-readable source/evidence response for a narrowly defined question'],
  ['comparison-engine','a continuously refreshed comparison engine'],
  ['opportunity-index','a public index ranking observable opportunities under transparent rules'],
  ['signal-library','a reusable library of external signals that can be combined into new products']
];

function hypothesisFor(silo) {
  const label = String(silo.label || silo.id);
  const clean = label.replace(/["<>]/g, '').slice(0, 180);
  const numeric = Array.from(String(silo.id || '')).reduce((n,ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const mechanism = MECHANISMS[numeric % MECHANISMS.length];
  const mechanismName = mechanism[0];
  const mechanismDescription = mechanism[1];
  return {
    hypothesis_id: 'HYP-' + silo.id,
    silo_id: silo.id,
    title: 'Hypothesis: ' + clean + ' / ' + mechanismName,
    statement: 'HYPOTHESIS ONLY: a buyer may value ' + mechanismDescription + ' related to the ' + clean + ' silo. Demand is UNVERIFIED until an independent external buyer pays and the resulting fulfillment is evidenced.',
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

      if (req.method === 'GET' && pathname === '/hypotheses/sitemap.xml') {
        try {
          const countRows = await supabase('/rest/v1/cube_silos?select=id&limit=1');
          const totalRows = await supabase('/rest/v1/cube_silos?select=id&order=id.asc&limit=1');
          const total = Number(process.env.CUBE_SILO_COUNT || 1000017);
          const parts = Math.max(1, Math.ceil(total / 50000));
          const indexes = Array.from({length: parts}, (_, i) => '<sitemap><loc>' + esc(PUBLIC_BASE + '/hypotheses/sitemap-' + i + '.xml') + '</loc></sitemap>').join('');
          const xml = '<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + indexes + '</sitemapindex>';
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/xml; charset=utf-8');
          res.setHeader('Cache-Control', 'public, max-age=3600');
          res.end(xml);
          return;
        } catch (err) {
          return json(res, 503, {error: err.message || 'Hypothesis sitemap unavailable'});
        }
      }

      const sitemapPart = pathname.match(/^\/hypotheses\/sitemap-(\d+)\.xml$/);
      if (req.method === 'GET' && sitemapPart) {
        try {
          const part = Number(sitemapPart[1]);
          if (!Number.isInteger(part) || part < 0 || part > 100) return html(res, 404, '<h1>Sitemap part not found</h1>');
          const rows = await supabase('/rest/v1/cube_silos?select=id&order=id.asc&limit=50000&offset=' + String(part * 50000));
          const urls = (Array.isArray(rows) ? rows : []).map(s => '<url><loc>' + esc(PUBLIC_BASE + '/hypotheses/' + encodeURIComponent(s.id)) + '</loc></url>').join('');
          const xml = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls + '</urlset>';
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/xml; charset=utf-8');
          res.setHeader('Cache-Control', 'public, max-age=3600');
          res.end(xml);
          return;
        } catch (err) {
          return json(res, 503, {error: err.message || 'Hypothesis sitemap part unavailable'});
        }
      }

      if (req.method === 'GET' && pathname === '/hypotheses') {
        try {
          const rows = await supabase('/rest/v1/cube_silos?select=id,label&order=id.asc&limit=100');
          const links = (Array.isArray(rows) ? rows : []).map(s => '<li><a href="/hypotheses/' + encodeURIComponent(s.id) + '" style="color:#f0c85a">' + esc('HYP-' + s.id) + '</a> · ' + esc(s.label || s.id) + '</li>').join('');
          const body = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="index,follow"><title>DreamLedger Hypotheses</title></head><body style="font-family:system-ui;background:#07080c;color:#eee;max-width:900px;margin:auto;padding:30px"><h1>CUBE Hypotheses</h1><p>Public, explicitly UNVERIFIED economic hypotheses. There are no buyer claims here unless independently evidenced.</p><p>Every silo has a public hypothesis URL. Each page exposes a secure Stripe Checkout commission flow. Payment commissions evaluation and does not prove the hypothesis.</p><p><a href="/hypotheses/sitemap.xml">Complete hypothesis sitemap index</a></p><ol>' + links + '</ol></body></html>';
          return html(res, 200, body);
        } catch (err) {
          return json(res, 503, {error: err.message || 'Hypothesis index unavailable'});
        }
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
