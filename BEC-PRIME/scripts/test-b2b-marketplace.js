'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');

process.env.SUPABASE_URL = 'https://supabase.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
process.env.SUPABASE_ANON_KEY = 'anon-test-key';
const { handle } = require('../routes/b2b-marketplace');

function response() {
  return {
    statusCode: 0, headers: {}, body: '',
    get writableEnded() { return this.ended === true; },
    writeHead(status, headers) { this.statusCode = status; this.headers = headers; },
    end(value = '') { this.body = String(value); this.ended = true; }
  };
}
function request(method, url, body = null, headers = {}) {
  const req = Readable.from(body === null ? [] : [JSON.stringify(body)]);
  req.method = method;
  req.url = url;
  req.headers = headers;
  return req;
}
const parse = res => JSON.parse(res.body);

test('B2B writes require a Supabase bearer session', async () => {
  const oldFetch = global.fetch;
  let called = false;
  global.fetch = async () => { called = true; throw new Error('must not call'); };
  try {
    const res = response();
    await handle(request('POST', '/api/b2b/rfqs', { title: 'RFQ', description: 'Need parts' }), res, '/api/b2b/rfqs');
    assert.equal(res.statusCode, 401);
    assert.equal(parse(res).code, 'AUTH_REQUIRED');
    assert.equal(called, false);
  } finally { global.fetch = oldFetch; }
});

test('B2B database outage fails closed and does not claim persistence', async () => {
  const oldFetch = global.fetch;
  global.fetch = async () => { throw new Error('ECONNREFUSED'); };
  try {
    const res = response();
    await handle(request('GET', '/api/b2b/search?q=bolt'), res, '/api/b2b/search');
    assert.equal(res.statusCode, 503);
    assert.equal(parse(res).code, 'B2B_DATA_UNAVAILABLE');
    assert.match(parse(res).error, /no transaction was recorded/i);
  } finally { global.fetch = oldFetch; }
});

test('RFQ creation requires idempotency and writes through the database API', async () => {
  const oldFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: '00000000-0000-4000-8000-000000000001', email: 'buyer@example.com', email_confirmed_at: '2026-01-01T00:00:00Z' }), { status: 200 });
    }
    if (String(url).includes('/rest/v1/marketplace_b2b_rfqs')) {
      const payload = JSON.parse(options.body);
      return new Response(JSON.stringify([{ id: '00000000-0000-4000-8000-000000000002', ...payload, created_at: '2026-10-10T00:00:00Z' }]), { status: 201 });
    }
    throw new Error('Unexpected URL ' + url);
  };
  try {
    const noKey = response();
    await handle(request('POST', '/api/b2b/rfqs', { title: 'Copper', description: 'Need copper sheet' }, { authorization: 'Bearer user-token' }), noKey, '/api/b2b/rfqs');
    assert.equal(noKey.statusCode, 422);
    assert.equal(calls.length, 1, 'only auth check should run before rejecting missing idempotency key');

    const res = response();
    await handle(request('POST', '/api/b2b/rfqs', { title: 'Copper', description: 'Need copper sheet', budget_nzd: 25 }, { authorization: 'Bearer user-token', 'idempotency-key': 'test-rfq-1' }), res, '/api/b2b/rfqs');
    assert.equal(res.statusCode, 201);
    assert.equal(parse(res).commercial_truth, 'RFQ_RECORDED_NOT_ORDER_OR_REVENUE');
    assert.equal(parse(res).item.budget_nzd, 25);
    assert.ok(calls.some(x => x.url.includes('/rest/v1/marketplace_b2b_rfqs')));
  } finally { global.fetch = oldFetch; }
});


test('B2B listing submission requires seller payout readiness and enters review', async () => {
  const oldFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    if (String(url).endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id:'00000000-0000-4000-8000-000000000006', email:'seller@example.com', email_confirmed_at:'2026-01-01T00:00:00Z' }), { status:200 });
    if (String(url).includes('/rest/v1/marketplace_seller_accounts')) return new Response(JSON.stringify([{ seller_id:'00000000-0000-4000-8000-000000000007', onboarding_status:'complete', charges_enabled:true, payouts_enabled:true }]), { status:200 });
    if (String(url).includes('/rest/v1/marketplace_listings') && options.method==='POST') {
      const payload=JSON.parse(options.body);
      assert.equal(payload.status,'review');
      assert.equal(payload.agent_purchasable,false);
      return new Response(JSON.stringify([{ id:'00000000-0000-4000-8000-000000000008', ...payload, created_at:'2026-10-10T00:00:00Z' }]), { status:201 });
    }
    throw new Error('Unexpected URL '+url);
  };
  try {
    const res=response();
    await handle(request('POST','/api/b2b/listings',{title:'Custom machined bracket',description:'Made to drawing',price_nzd:49.99},{authorization:'Bearer verified-seller-token','idempotency-key':'listing-1'}),res,'/api/b2b/listings');
    assert.equal(res.statusCode,201);
    assert.equal(parse(res).item.status,'review');
    assert.equal(parse(res).commercial_truth,'LISTING_SUBMITTED_FOR_REVIEW_NOT_ORDER_OR_REVENUE');
  } finally { global.fetch=oldFetch; }
});


test('B2B moderation uses the existing versioned listing transition RPC', async () => {
  const oldFetch=global.fetch;
  const calls=[];
  global.fetch=async(url,options={})=>{
    calls.push({url:String(url),options});
    if(String(url).endsWith('/auth/v1/user'))return new Response(JSON.stringify({id:'00000000-0000-4000-8000-000000000009',email:'moderator@example.com',email_confirmed_at:'2026-01-01T00:00:00Z'}),{status:200});
    if(String(url).includes('/rest/v1/marketplace_listings?'))return new Response(JSON.stringify([{id:'00000000-0000-4000-8000-000000000010',status:'review',organization_id:'00000000-0000-4000-8000-000000000011',state_version:1}]),{status:200});
    if(String(url).includes('/rest/v1/marketplace_memberships?'))return new Response(JSON.stringify([{organization_id:'00000000-0000-4000-8000-000000000011',role:'moderator'}]),{status:200});
    if(String(url).endsWith('/rest/v1/rpc/transition_marketplace_listing')){
      const body=JSON.parse(options.body);
      assert.equal(body.p_to_state,'published');
      assert.equal(body.p_expected_version,1);
      return new Response(JSON.stringify({id:'00000000-0000-4000-8000-000000000010',status:'published',state_version:2}),{status:200});
    }
    throw new Error('Unexpected URL '+url);
  };
  try{
    const res=response();
    await handle(request('POST','/api/b2b/moderation/listings/00000000-0000-4000-8000-000000000010/approve',{expected_version:1,reason:'Approved after review'},{authorization:'Bearer moderator-token'}),res,'/api/b2b/moderation/listings/00000000-0000-4000-8000-000000000010/approve');
    assert.equal(res.statusCode,200);
    assert.equal(parse(res).listing.status,'published');
    assert.ok(calls.some(x=>x.url.endsWith('/rest/v1/rpc/transition_marketplace_listing')));
  }finally{global.fetch=oldFetch}
});

test('supplier cannot read competing offers on another buyer RFQ', async () => {
  const oldFetch = global.fetch;
  global.fetch = async url => {
    if (String(url).endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: '00000000-0000-4000-8000-000000000003', email: 'supplier@example.com', email_confirmed_at: '2026-01-01T00:00:00Z' }), { status: 200 });
    if (String(url).includes('/rest/v1/marketplace_b2b_rfqs')) return new Response(JSON.stringify([{ id: 'rfq', buyer_user_id: '00000000-0000-4000-8000-000000000004', status: 'open' }]), { status: 200 });
    if (String(url).includes('/rest/v1/marketplace_b2b_offers')) return new Response(JSON.stringify([{ id: 'offer', supplier_user_id: '00000000-0000-4000-8000-000000000005', amount_minor: 1000 }]), { status: 200 });
    throw new Error('Unexpected URL ' + url);
  };
  try {
    const res = response();
    await handle(request('GET', '/api/b2b/rfqs/rfq/offers', null, { authorization: 'Bearer user-token' }), res, '/api/b2b/rfqs/rfq/offers');
    assert.equal(res.statusCode, 403);
  } finally { global.fetch = oldFetch; }
});

test('listing idempotency rejects a replay with a changed category', async () => {
  const oldFetch = global.fetch;
  let submitted;
  global.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id:'00000000-0000-4000-8000-000000000006', email:'seller@example.com', email_confirmed_at:'2026-01-01T00:00:00Z' }), { status:200 });
    if (target.includes('/rest/v1/marketplace_seller_accounts')) return new Response(JSON.stringify([{ seller_id:'00000000-0000-4000-8000-000000000007', onboarding_status:'complete', charges_enabled:true, payouts_enabled:true }]), { status:200 });
    if (target.includes('/rest/v1/marketplace_listings') && options.method === 'POST') {
      submitted = JSON.parse(options.body);
      return new Response('', { status:201 });
    }
    if (target.includes('/rest/v1/marketplace_listings?') && target.includes('slug=eq.')) {
      return new Response(JSON.stringify([{ id:'00000000-0000-4000-8000-000000000008', ...submitted, category:'Tools', created_at:'2026-10-10T00:00:00Z' }]), { status:200 });
    }
    throw new Error('Unexpected URL ' + target);
  };
  try {
    const res = response();
    await handle(request('POST','/api/b2b/listings',{title:'Custom machined bracket',description:'Made to drawing',category:'Parts',price_nzd:49.99},{authorization:'Bearer verified-seller-token','idempotency-key':'same-listing-key'}),res,'/api/b2b/listings');
    assert.equal(res.statusCode,409);
    assert.equal(parse(res).code,'IDEMPOTENCY_CONFLICT');
  } finally { global.fetch = oldFetch; }
});

test('B2B order creation remains fail-closed until the canonical settlement rail is released', async () => {
  const oldFetch = global.fetch;
  global.fetch = async url => {
    if (String(url).endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id:'00000000-0000-4000-8000-000000000001', email:'buyer@example.com', email_confirmed_at:'2026-01-01T00:00:00Z' }), { status:200 });
    throw new Error('No database call should be needed for the deliberate release gate');
  };
  try {
    const res = response();
    await handle(request('POST','/api/b2b/orders',{offer_id:'offer-test'},{authorization:'Bearer buyer-token'}),res,'/api/b2b/orders');
    assert.equal(res.statusCode,503);
    assert.equal(parse(res).code,'B2B_CHECKOUT_NOT_RELEASED');
    assert.match(parse(res).error,/deliberately disabled/i);
  } finally { global.fetch = oldFetch; }
});

