'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const PRICING = path.join(ROOT, 'catalog', 'truth-oracle', 'pricing.json');
const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL || 'https://dreamledger.org').replace(/\/$/, '');
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';

function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function send(res, status, body) {
  if (res.writableEnded) return true;
  const payload = JSON.stringify(body);
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(payload);
  return true;
}
function form(params) {
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) out.set(key, String(value));
  return out;
}
async function stripeGet(endpoint) {
  if (!STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not configured');
  const response = await fetch('https://api.stripe.com/v1/' + endpoint, {headers:{Authorization:'Bearer ' + STRIPE_SECRET_KEY}});
  const text = await response.text();
  let data; try { data = JSON.parse(text); } catch { data = {raw:text}; }
  if (!response.ok) throw new Error(data?.error?.message || 'Stripe API ' + response.status);
  return data;
}
async function stripePost(endpoint, params, idempotencyKey) {
  if (!STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not configured');
  const response = await fetch('https://api.stripe.com/v1/' + endpoint, {method:'POST',headers:{Authorization:'Bearer ' + STRIPE_SECRET_KEY,'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':idempotencyKey},body:form(params)});
  const text = await response.text();
  let data; try { data = JSON.parse(text); } catch { data = {raw:text}; }
  if (!response.ok) throw new Error(data?.error?.message || 'Stripe API ' + response.status);
  return data;
}
function plans() { return read(PRICING).plans || []; }
function paidPlan(tier) { return plans().find(p => p.tier === tier && Number(p.price_nzd_month) > 0 && p.stripe_price_id) || null; }

async function handle(req, res, url) {
  if (req.method === 'GET' && url === '/api/truth-oracle/plans') {
    return send(res, 200, {plans: plans().map(p => ({tier:p.tier, price_nzd_month:Number(p.price_nzd_month), disclosure_class:p.disclosure_class, description:p.description}))});
  }
  if (req.method === 'POST' && url === '/api/truth-oracle/checkout') {
    let raw=''; for await (const chunk of req) { raw += chunk; if (raw.length > 20000) return send(res, 413, {error:'Request too large'}); }
    let body={}; try { body=JSON.parse(raw||'{}'); } catch { return send(res,400,{error:'Invalid JSON'}); }
    const plan=paidPlan(String(body.tier||''));
    if (!plan) return send(res,400,{error:'Unknown or unavailable Truth Oracle tier'});
    try {
      const session=await stripePost('checkout/sessions',{
        mode:'subscription',
        'integration_identifier':'dreamledger-truth-' + crypto.randomBytes(4).toString('hex'),
        'line_items[0][price]':plan.stripe_price_id,
        'line_items[0][quantity]':'1',
        'success_url':PUBLIC_BASE + '/truth-oracle?checkout=success&session_id={CHECKOUT_SESSION_ID}',
        'cancel_url':PUBLIC_BASE + '/truth-oracle?checkout=cancelled',
        'allow_promotion_codes':'true',
        'metadata[silo]':'truth-oracle',
        'metadata[truth_oracle_tier]':plan.tier,
        'metadata[disclosure_class]':plan.disclosure_class,
        'metadata[product_key]':plan.product_key || '',
        'subscription_data[metadata][silo]':'truth-oracle',
        'subscription_data[metadata][truth_oracle_tier]':plan.tier,
        'subscription_data[metadata][disclosure_class]':plan.disclosure_class
      },'dreamledger-truth-checkout-' + plan.tier + '-' + crypto.randomUUID());
      return send(res,200,{ok:true,tier:plan.tier,session_id:session.id,checkout_url:session.url});
    } catch(err) { return send(res,502,{error:err.message}); }
  }
  if (req.method === 'GET' && url.startsWith('/api/truth-oracle/access')) {
    const query = new URL('http://truth.local' + (req.url || '')).searchParams;
    const sessionId = query.get('session_id');
    if (!sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return send(res,400,{error:'A valid checkout session is required'});
    try {
      const session=await stripeGet('checkout/sessions/' + encodeURIComponent(sessionId) + '?expand[]=subscription');
      const subscription=session.subscription;
      const active=Boolean(session.mode==='subscription' && session.payment_status==='paid' && subscription && ['active','trialing'].includes(subscription.status));
      const tier=String(session.metadata?.truth_oracle_tier || subscription?.metadata?.truth_oracle_tier || '');
      return send(res,200,{authenticated:false,entitled:active,tier:active?tier:null,disclosure_class:active?String(session.metadata?.disclosure_class || subscription?.metadata?.disclosure_class || ''):null,truth_unchanged:true});
    } catch(err) { return send(res,502,{error:err.message}); }
  }
  return false;
}

module.exports = { handle };
