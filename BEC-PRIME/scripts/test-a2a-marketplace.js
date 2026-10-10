'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');

process.env.M2M_QUOTE_SIGNING_SECRET = 'test-only-high-entropy-signing-secret';
process.env.SUPABASE_URL = 'https://supabase.invalid';
process.env.SUPABASE_ANON_KEY = 'anon-test-key';
const { handle } = require('../routes/m2m');

function response() {
  return {
    statusCode: 0, headers: {}, body: '',
    writeHead(status, headers) { this.statusCode = status; this.headers = headers; },
    end(value = '') { this.body = String(value); this.ended = true; }
  };
}
function request(method, url, body = null, headers = {}) {
  const req = Readable.from(body === null ? [] : [JSON.stringify(body)]);
  req.method = method; req.url = url; req.headers = headers;
  return req;
}
const parse = res => JSON.parse(res.body);

test('A2A checkout authorization requires a verified Supabase human session', async () => {
  const oldFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => { calls++; throw new Error('must not call without bearer token'); };
  try {
    const res = response();
    await handle(request('POST', '/m2m/v1/marketplace/authorize', { capability_id: 'PRODUCT:test', authorized: true }), res, '/m2m/v1/marketplace/authorize');
    assert.equal(res.statusCode, 401);
    assert.equal(parse(res).error.code, 'AUTHENTICATED_HUMAN_REQUIRED');
    assert.equal(calls, 0);
  } finally { global.fetch = oldFetch; }
});

test('A2A authorization rejects altered quote signatures', async () => {
  const oldFetch = global.fetch;
  global.fetch = async url => {
    if (String(url).endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: '00000000-0000-4000-8000-000000000001', email: 'buyer@example.com', email_confirmed_at: '2026-01-01T00:00:00Z' }), { status: 200 });
    throw new Error('Unexpected URL ' + url);
  };
  try {
    const catalog = response();
    await handle(request('GET', '/m2m/v1/marketplace/capabilities'), catalog, '/m2m/v1/marketplace/capabilities');
    const products = parse(catalog).capabilities || [];
    assert.ok(products.length, 'A2A catalog must contain at least one published capability');
    const item = products[0];
    const quoteRes = response();
    await handle(request('POST', '/m2m/v1/marketplace/quote', { capability_id: item.capability_id }), quoteRes, '/m2m/v1/marketplace/quote');
    assert.equal(quoteRes.statusCode, 200);
    const quote = parse(quoteRes);
    const parts = quote.quote_id.split(':');
    parts[3] = (parts[3][0] === '0' ? '1' : '0') + parts[3].slice(1);
    const bad = response();
    await handle(request('POST', '/m2m/v1/marketplace/authorize', { capability_id: item.capability_id, quote_id: parts.join(':'), authorized: true }, { authorization: 'Bearer verified-user-token' }), bad, '/m2m/v1/marketplace/authorize');
    assert.equal(bad.statusCode, 409);
    assert.equal(parse(bad).error.code, 'QUOTE_EXPIRED_OR_MISMATCHED');
  } finally { global.fetch = oldFetch; }
});


test('A2A discovers and signs quotes for explicitly agent-enabled marketplace listings', async () => {
  const oldFetch=global.fetch;
  const listing={id:'00000000-0000-4000-8000-000000000021',slug:'agent-ready-widget',title:'Agent-ready widget',description:'A seller-listed widget',category:'Parts',price:75.5,currency:'NZD',seller_id:'00000000-0000-4000-8000-000000000022',agent_purchasable:true,status:'published',created_at:'2026-10-10T00:00:00Z'};
  global.fetch=async url=>{
    if(String(url).endsWith('/auth/v1/user'))return new Response(JSON.stringify({id:'00000000-0000-4000-8000-000000000023',email:'buyer@example.com',email_confirmed_at:'2026-01-01T00:00:00Z'}),{status:200});
    if(String(url).includes('/rest/v1/marketplace_listings?'))return new Response(JSON.stringify([listing]),{status:200});
    throw new Error('Unexpected URL '+url);
  };
  try{
    const catalog=response();
    await handle(request('GET','/m2m/v1/marketplace/capabilities'),catalog,'/m2m/v1/marketplace/capabilities');
    const item=(parse(catalog).capabilities||[]).find(x=>x.capability_id==='LISTING:'+listing.id);
    assert.ok(item,'agent-enabled seller listing should be discoverable');
    assert.equal(item.checkout_available,false);
    const quoteRes=response();
    await handle(request('POST','/m2m/v1/marketplace/quote',{capability_id:item.capability_id}),quoteRes,'/m2m/v1/marketplace/quote');
    assert.equal(quoteRes.statusCode,200);
    const quote=parse(quoteRes);
    assert.equal(quote.price,75.5);
    const authRes=response();
    await handle(request('POST','/m2m/v1/marketplace/authorize',{capability_id:item.capability_id,quote_id:quote.quote_id,authorized:true},{authorization:'Bearer verified-user-token'}),authRes,'/m2m/v1/marketplace/authorize');
    assert.equal(authRes.statusCode,200);
    assert.equal(parse(authRes).seller_id,listing.seller_id);
    assert.equal(parse(authRes).checkout_route,'/api/a2a/checkout');
  }finally{global.fetch=oldFetch}
});

test('A2A authorization binds the accepted quote to the verified user', async () => {
  const oldFetch = global.fetch;
  global.fetch = async url => {
    if (String(url).endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: '00000000-0000-4000-8000-000000000002', email: 'buyer@example.com', email_confirmed_at: '2026-01-01T00:00:00Z' }), { status: 200 });
    throw new Error('Unexpected URL ' + url);
  };
  try {
    const catalog = response();
    await handle(request('GET', '/m2m/v1/marketplace/capabilities'), catalog, '/m2m/v1/marketplace/capabilities');
    const products = parse(catalog).capabilities || [];
    assert.ok(products.length, 'A2A catalog must contain at least one published capability');
    const item = products[0];
    const quoteRes = response();
    await handle(request('POST', '/m2m/v1/marketplace/quote', { capability_id: item.capability_id }), quoteRes, '/m2m/v1/marketplace/quote');
    const quote = parse(quoteRes);
    const authRes = response();
    await handle(request('POST', '/m2m/v1/marketplace/authorize', { capability_id: item.capability_id, quote_id: quote.quote_id, authorized: true }, { authorization: 'Bearer verified-user-token' }), authRes, '/m2m/v1/marketplace/authorize');
    assert.equal(authRes.statusCode, 200);
    assert.equal(parse(authRes).authorized_by_user_id, '00000000-0000-4000-8000-000000000002');
    assert.equal(parse(authRes).commercial_truth, 'AUTHORIZED_ACTION_NOT_PAYMENT');
  } finally { global.fetch = oldFetch; }
});
